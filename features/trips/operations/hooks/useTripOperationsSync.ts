import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useIsOnline } from "@/contexts/NetworkContext";
import { flushOperationsOutbox } from "../offline/sync";
import { useQueryClient } from "@tanstack/react-query";
import {
  invalidateTripOperationalState,
  invalidateReconciliationState,
} from "@/lib/queries/operationalInvalidation";
import { queryKeys } from "@/lib/queryKeys";
import type { OperationsSyncResult } from "../offline/sync";

export function useTripOperationsSync(opts?: { enabled?: boolean }) {
  const enabled = opts?.enabled !== false;
  const isOnline = useIsOnline();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<OperationsSyncResult | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const runSync = useCallback(async () => {
    if (!isOnline) return;
    setIsSyncing(true);
    try {
      const result = await flushOperationsOutbox();
      setLastResult(result);
      setLastSyncedAt(Date.now());
      for (const tripId of result.processedTripIds) {
        const orgId = String(
          queryClient.getQueryData<{ organization_id?: string | null }>(
            queryKeys.trips.detail(tripId),
          )?.organization_id ?? "",
        );
        invalidateTripOperationalState({
          queryClient,
          tripId,
          organizationId: orgId || undefined,
        });
        if (orgId) {
          invalidateReconciliationState({
            queryClient,
            organizationId: orgId,
            tripId,
          });
        }
      }
      for (const tripId of result.failedTripIds) {
        const orgId = String(
          queryClient.getQueryData<{ organization_id?: string | null }>(
            queryKeys.trips.detail(tripId),
          )?.organization_id ?? "",
        );
        invalidateTripOperationalState({
          queryClient,
          tripId,
          organizationId: orgId || undefined,
        });
        if (orgId) {
          invalidateReconciliationState({
            queryClient,
            organizationId: orgId,
            tripId,
          });
        }
      }
      if (result.processed > 0 || result.failed > 0) {
        queryClient.invalidateQueries({ queryKey: ["q", "transactions"] });
        queryClient.invalidateQueries({ queryKey: ["q", "invoicing"] });
        queryClient.invalidateQueries({ queryKey: ["q", "analytics"] });
        queryClient.invalidateQueries({ queryKey: ["q", "operations", "control-center"] });
        queryClient.invalidateQueries({ queryKey: ["q", "operations", "health"] });
      }
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, queryClient]);

  useEffect(() => {
    if (!enabled || !isOnline) return;
    void runSync();
  }, [enabled, isOnline, runSync]);

  useFocusEffect(
    useCallback(() => {
      if (!enabled || !isOnline) return;
      void runSync();
      return undefined;
    }, [enabled, isOnline, runSync]),
  );

  return {
    isSyncing,
    lastResult,
    lastSyncedAt,
  };
}
