/**
 * One TanStack Query for a trip's hard-copy POD record.
 * Modal, trip detail, and POD status all read this cache.
 */
import { fetchTripHardCopyPodState } from "@/features/trips/services/tripDocumentLrPod.service";
import { publishHardCopyPodState } from "@/lib/queries/invalidateHardCopyPodCaches";
import { queryKeys } from "@/lib/queryKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export function useTripHardCopyPodQuery(tripId: string | null | undefined) {
  const id = String(tripId ?? "").trim();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.trips.hardCopyPod(id),
    enabled: id.length > 0,
    staleTime: 15_000,
    queryFn: async () => {
      const { error, state } = await fetchTripHardCopyPodState(id);
      if (error) throw error;
      return state;
    },
  });

  useEffect(() => {
    if (!id || !query.data) return;
    publishHardCopyPodState(queryClient, id, query.data);
  }, [id, query.data, queryClient]);

  return {
    state: query.data ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
  };
}
