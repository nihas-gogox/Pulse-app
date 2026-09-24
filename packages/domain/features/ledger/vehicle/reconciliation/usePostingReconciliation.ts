import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../../../lib/queryKeys";
import { syncOperationalFinanceProjection } from "../../../finance/projections";
import {
  reconcileOperationalPosting,
  reconcileVehicleLedgerState,
  rebuildOperationalLedgerState,
} from "./reconciliation.service";

export function usePostingReconciliationState(tripId: string | null, enabled = true) {
  return useQuery({
    queryKey: tripId
      ? queryKeys.operations.postingReconciliationByTrip(tripId)
      : ["q", "trips", "operations", "reconciliation", "noop"],
    queryFn: async () => {
      const res = await reconcileVehicleLedgerState({ tripId: tripId! });
      if (res.error) throw res.error;
      return res;
    },
    enabled: enabled && !!tripId,
    staleTime: 20_000,
  });
}

export function useRunPostingReconciliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tripId: string; actorUserId: string | null }) => {
      const res = await reconcileOperationalPosting(input);
      if (res.error) throw res.error;
      return res;
    },
    onSuccess: (_res, vars) => {
      const summary = qc.getQueryData<{ trip?: { organization_id?: string | null; vehicle_id?: string | null } }>(
        queryKeys.trips.operationsSummary(vars.tripId),
      );
      const orgId = String(summary?.trip?.organization_id ?? "");
      if (orgId) {
        syncOperationalFinanceProjection({
          queryClient: qc,
          organizationId: orgId,
          tripId: vars.tripId,
          vehicleId: summary?.trip?.vehicle_id ?? null,
        });
      } else {
        qc.invalidateQueries({ queryKey: queryKeys.operations.postingReconciliationByTrip(vars.tripId) });
        qc.invalidateQueries({ queryKey: queryKeys.trips.operationsSummary(vars.tripId) });
        qc.invalidateQueries({ queryKey: queryKeys.trips.operationsTimeline(vars.tripId) });
      }
    },
  });
}

export function useRebuildOperationalLedgerState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tripId: string }) => {
      const res = await rebuildOperationalLedgerState(input);
      if (res.error) throw res.error;
      return res;
    },
    onSuccess: (_res, vars) => {
      const summary = qc.getQueryData<{ trip?: { organization_id?: string | null; vehicle_id?: string | null } }>(
        queryKeys.trips.operationsSummary(vars.tripId),
      );
      const orgId = String(summary?.trip?.organization_id ?? "");
      if (orgId) {
        syncOperationalFinanceProjection({
          queryClient: qc,
          organizationId: orgId,
          tripId: vars.tripId,
          vehicleId: summary?.trip?.vehicle_id ?? null,
        });
      } else {
        qc.invalidateQueries({ queryKey: queryKeys.operations.postingReconciliationByTrip(vars.tripId) });
        qc.invalidateQueries({ queryKey: queryKeys.trips.operationsSummary(vars.tripId) });
        qc.invalidateQueries({ queryKey: queryKeys.trips.operationsTimeline(vars.tripId) });
      }
    },
  });
}
