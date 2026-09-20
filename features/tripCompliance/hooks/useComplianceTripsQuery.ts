import { useOptionalOrganization } from "@/contexts/OrganizationContext";
import { buildComplianceTripSummaries } from "@/features/tripCompliance/services/tripComplianceRead.service";
import type { ComplianceStage, ComplianceTripSummary } from "@/features/tripCompliance/tripCompliance.types";
import { ensureComplianceChecklist } from "@/features/tripCompliance/utils/complianceChecklist.util";
import { getTripById, getTripsByOrganization } from "@/features/trips/services/trips.service";
import { queryKeys } from "@/lib/queryKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

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

/**
 * One Compliance page load = trips + trip_documents + flags + transactions +
 * one batched entity_documents read — no per-card RPC, no per-trip fetch.
 * Reuses `getTripsByOrganization`'s existing paginated trips read rather than
 * adding a second trips query pattern.
 */
export function useComplianceTripsQuery(page = 0) {
  const orgId = useComplianceOrgId();

  return useQuery({
    queryKey: queryKeys.tripCompliance.list(orgId, page),
    queryFn: async (): Promise<{ summaries: ComplianceTripSummary[]; hasMore: boolean }> => {
      if (!orgId) return { summaries: [], hasMore: false };
      const { error, trips, hasMore } = await getTripsByOrganization(orgId, {
        limit: COMPLIANCE_QUEUE_PAGE_SIZE,
        offset: page * COMPLIANCE_QUEUE_PAGE_SIZE,
      });
      if (error) throw error;
      const summaries = await buildComplianceTripSummaries(trips);
      return { summaries, hasMore: hasMore ?? false };
    },
    select: (data) => ({
      ...data,
      summaries: data.summaries.map(withChecklist),
    }),
    enabled: !!orgId,
    staleTime: 30_000,
  });
}

export function useComplianceStageFilter(summaries: ComplianceTripSummary[] | undefined) {
  const [stage, setStage] = useState<ComplianceStage | "all">("all");
  const filtered = useMemo(() => {
    if (!summaries) return [];
    if (stage === "all") return summaries;
    return summaries.filter((s) => s.stage === stage);
  }, [summaries, stage]);
  const counts = useMemo(() => {
    const next: Record<ComplianceStage | "all", number> = {
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

export function useInvalidateComplianceTrips() {
  const orgId = useComplianceOrgId();
  const qc = useQueryClient();
  return (tripId?: string) => {
    if (!orgId) return;
    void qc.invalidateQueries({ queryKey: ["q", "tripCompliance", "list", "vault-v2", orgId] });
    if (tripId) {
      void qc.invalidateQueries({ queryKey: queryKeys.tripCompliance.detail(orgId, tripId) });
    } else {
      void qc.invalidateQueries({ queryKey: ["q", "tripCompliance", "detail", "vault-v2", orgId] });
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
    staleTime: 30_000,
    select: (summary) => (summary ? withChecklist(summary) : null),
  });
}
