/**
 * Compliance queue — same trip source as `/trips` (`useTripsQuery` → getTripsForOrg),
 * then:
 *  1. Filter Loading → Completed pipeline
 *  2. Build compliance summaries for the **full** pipeline (stage totals)
 *  3. Paginate only the visible list (UI), not the totals query
 */
import { useOptionalOrganization } from "@/contexts/OrganizationContext";
import {
  buildComplianceTripSummaries,
} from "@/features/tripCompliance/services/tripComplianceRead.service";
import type { ComplianceStage, ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";
import { ensureComplianceChecklist } from "@/features/tripCompliance/utils/complianceChecklist.util";
import { selectCompliancePipelineTrips } from "@/features/tripCompliance/utils/compliancePipelineTrips.util";
import { getTripById } from "@/features/trips/services/trips.service";
import { useTripsQuery } from "@/lib/queries/useTripsQuery";
import { queryKeys } from "@/lib/queryKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

/** Cards/table page size — totals always use the full pipeline. */
export const COMPLIANCE_QUEUE_PAGE_SIZE = 30;

function withChecklist(summary: ComplianceTripSummary): ComplianceTripSummary {
  const next: ComplianceTripSummary = {
    ...summary,
    vehicleDocuments: summary.vehicleDocuments ?? [],
    driverDocuments: summary.driverDocuments ?? [],
  };
  const checklist = ensureComplianceChecklist(next);
  return next.checklist === checklist ? next : { ...next, checklist };
}

function useComplianceOrgId(): string {
  const orgCtx = useOptionalOrganization();
  return orgCtx?.currentOrganization?.id ?? "";
}

export type ComplianceStageCounts = Record<ComplianceStage | "all", number>;

export type ComplianceQueueResult = {
  /** Full pipeline summaries — source of truth for stage totals. */
  summaries: ComplianceTripSummary[];
  /** Current page slice after stage + search filtering (set by screen). */
  pipelineTripCount: number;
  tripsLoading: boolean;
  summariesLoading: boolean;
  isError: boolean;
  error: Error | null;
  isFetching: boolean;
  refetch: () => void;
};

/**
 * Loads the same trip catalog as Trip Operations, filters to Loading→Completed,
 * then builds batched compliance summaries for **all** matching trips so chip
 * counts are global — not page-scoped.
 */
export function useComplianceTripsQuery(_page = 0): ComplianceQueueResult & {
  data: { summaries: ComplianceTripSummary[]; hasMore: boolean } | undefined;
  isLoading: boolean;
} {
  const orgId = useComplianceOrgId();
  const tripsQuery = useTripsQuery(orgId || null);

  const pipelineTrips = useMemo(
    () => selectCompliancePipelineTrips(tripsQuery.data ?? []),
    [tripsQuery.data],
  );

  const tripsRevision = tripsQuery.dataUpdatedAt || 0;

  const summariesQuery = useQuery({
    queryKey: queryKeys.tripCompliance.pipeline(orgId, tripsRevision),
    queryFn: async (): Promise<ComplianceTripSummary[]> => {
      if (pipelineTrips.length === 0) return [];
      return buildComplianceTripSummaries(pipelineTrips);
    },
    enabled: !!orgId && tripsQuery.isSuccess,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    select: (rows) => rows.map(withChecklist),
  });

  const summaries = summariesQuery.data ?? [];
  const isLoading =
    (tripsQuery.isPending && !tripsQuery.data) ||
    (summariesQuery.isPending && tripsQuery.isSuccess && !summariesQuery.data);
  const isFetching = tripsQuery.isFetching || summariesQuery.isFetching;
  const isError = tripsQuery.isError || summariesQuery.isError;
  const error = (tripsQuery.error ?? summariesQuery.error) as Error | null;

  const refetch = () => {
    void tripsQuery.refetch();
    void summariesQuery.refetch();
  };

  return {
    data: {
      summaries,
      // hasMore is unused for network paging — UI paginates client-side.
      hasMore: false,
    },
    summaries,
    pipelineTripCount: pipelineTrips.length,
    tripsLoading: tripsQuery.isPending && !tripsQuery.data,
    summariesLoading: summariesQuery.isPending && !summariesQuery.data,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  };
}

export function useComplianceStageFilter(summaries: ComplianceTripSummary[] | undefined) {
  const [stage, setStage] = useState<ComplianceStage | "all">("all");
  const filtered = useMemo(() => {
    if (!summaries) return [];
    if (stage === "all") return summaries;
    // Mutually exclusive chips — one derived stage per trip.
    return summaries.filter((s) => s.stage === stage);
  }, [summaries, stage]);

  const counts = useMemo((): ComplianceStageCounts => {
    const next: ComplianceStageCounts = {
      all: summaries?.length ?? 0,
      pending_for_docs: 0,
      compliance_pending: 0,
      compliance_verified: 0,
      advance_payment_processed: 0,
      hard_copy_pod_received: 0,
      balance_pending: 0,
      payment_settled: 0,
    };
    for (const summary of summaries ?? []) {
      if (summary.stage in next) next[summary.stage] += 1;
    }
    return next;
  }, [summaries]);

  return { stage, setStage, filtered, counts };
}

/** Client-side page over an already-filtered summary list. */
export function useComplianceListPagination<T>(
  items: T[],
  opts?: { pageSize?: number; resetKey?: string | number },
) {
  const pageSize = opts?.pageSize ?? COMPLIANCE_QUEUE_PAGE_SIZE;
  const resetKey = opts?.resetKey ?? "";
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize) || 1);

  useEffect(() => {
    setPage(0);
  }, [resetKey, pageSize]);

  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  const pageItems = useMemo(() => {
    const start = page * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  return {
    page,
    setPage,
    pageSize,
    pageCount,
    pageItems,
    total: items.length,
    hasPrev: page > 0,
    hasNext: page < pageCount - 1,
  };
}

export function useInvalidateComplianceTrips() {
  const orgId = useComplianceOrgId();
  const qc = useQueryClient();
  return (tripId?: string) => {
    if (!orgId) return;
    void qc.invalidateQueries({ queryKey: ["q", "tripCompliance", "pipeline", "v1", orgId] });
    void qc.invalidateQueries({ queryKey: queryKeys.trips.finite(orgId) });
    if (tripId) {
      void qc.invalidateQueries({ queryKey: queryKeys.tripCompliance.detail(orgId, tripId) });
    } else {
      void qc.invalidateQueries({ queryKey: ["q", "tripCompliance", "detail", "v1", orgId] });
    }
  };
}

export function useComplianceTripQuery(tripId: string | undefined) {
  const orgId = useComplianceOrgId();

  return useQuery({
    queryKey: queryKeys.tripCompliance.detail(orgId, tripId ?? ""),
    queryFn: async (): Promise<ComplianceTripSummary | null> => {
      if (!orgId || !tripId) return null;
      const { error, trip } = await getTripById(tripId);
      if (error) throw error;
      if (!trip || trip.organization_id !== orgId) return null;
      const summaries = await buildComplianceTripSummaries([trip]);
      return summaries[0] ?? null;
    },
    enabled: !!orgId && !!tripId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    select: (summary) => (summary ? withChecklist(summary) : null),
  });
}
