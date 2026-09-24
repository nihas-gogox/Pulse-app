/**
 * Real distance covered so far for one trip, for Journey Metrics
 * (computeJourneyMetrics — see features/trips/domain/tripJourneyMetrics.ts).
 * Reuses the same batch RPC the Fleet Operations Dashboard uses
 * (getCheckpointDistanceSumsForTrips), called with a single trip id rather
 * than adding a parallel single-trip RPC.
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { getCheckpointDistanceSumsForTrips } from '../../features/tracking/services/trackingCheckpoint.service';
import { throwIfCancelled } from '@pulse/core/lib/supabaseAbort.util';

const POLL_MS = 30_000;

export function useTripCheckpointDistanceQuery(tripId: string | null): {
  distanceCoveredM: number;
  isLoading: boolean;
  error: Error | null;
} {
  const query = useQuery({
    queryKey: queryKeys.trips.checkpointDistance(tripId ?? ''),
    queryFn: async ({ signal }) => {
      const { distanceMByTripId, error } = await getCheckpointDistanceSumsForTrips(
        [tripId!],
        signal,
      );
      throwIfCancelled(signal, error);
      if (error) throw error;
      return distanceMByTripId.get(tripId!) ?? 0;
    },
    enabled: !!tripId,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
  });

  return {
    distanceCoveredM: query.data ?? 0,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
  };
}
