/**
 * Operational timeline for one trip — Layer 2 entry point (business UI).
 *
 * Data sources: geofence_events, trip_assignment_audit (driver_accepted),
 * trip_workflow_events (pod.uploaded, trip.completed). See
 * features/trips/domain/tripTimeline.ts for the collection/normalization
 * logic (Layer 1 — pure, no UI).
 *
 * Cache:    TanStack Query (staleTime 15s)
 * Realtime: subscribeSharedPostgresChanges on geofence_events inserts for
 *           this trip — the highest-frequency source. Assignment-audit and
 *           workflow events already invalidate via useTripWorkflowQuery's own
 *           channel elsewhere; this hook's own invalidation is scoped to what
 *           it alone is responsible for surfacing quickly (arrival/departure).
 */
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { subscribeSharedPostgresChanges } from '@pulse/core/lib/realtimeRegistry';
import { getTripTimeline, type TripTimelineEvent } from '../../features/trips/domain';
import { throwIfCancelled } from '@pulse/core/lib/supabaseAbort.util';

export function useTripTimelineQuery(
  tripId: string | null,
  assignedAt: string | null,
): {
  events: TripTimelineEvent[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const qc = useQueryClient();
  const key = queryKeys.trips.timeline(tripId ?? '');

  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const { events, error } = await getTripTimeline({
        tripId: tripId!,
        assignedAt,
        signal,
      });
      throwIfCancelled(signal, error);
      if (error) throw error;
      return events;
    },
    enabled: !!tripId,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!tripId) return;
    return subscribeSharedPostgresChanges(
      `trip_timeline_geofence:${tripId}`,
      [
        {
          event: 'INSERT',
          schema: 'public',
          table: 'geofence_events',
          filter: `trip_id=eq.${tripId}`,
        },
      ],
      () => {
        qc.invalidateQueries({ queryKey: key });
      },
    );
  }, [tripId, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
  };
}
