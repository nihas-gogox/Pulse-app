import { fetchDriverTripStopOrders } from './fetchDriverTripStopOrders';
import { emptyDriverTripStopOrderMission } from './normalizeDriverTripStopOrders';
import type { DriverTripStopOrderMission } from './driverTripStopOrders.types';
import { queryKeys } from '@pulse/domain/lib/queryKeys';
import { useQuery } from '@tanstack/react-query';

export type DriverCommerceMissionState =
  | { status: 'loading'; mission: DriverTripStopOrderMission }
  | { status: 'error'; mission: DriverTripStopOrderMission; error: Error }
  | { status: 'ready'; mission: DriverTripStopOrderMission };

export function driverCommerceMissionQueryKey(tripId: string) {
  return queryKeys.driverApp.commerceMission(tripId);
}

export type UseDriverCommerceMissionOptions = {
  /**
   * Job Card must pass false (or omit the hook). Default true is for the
   * explicit mission screen only — that is the sole auto-hydrate path.
   */
  enabled?: boolean;
};

/**
 * Primitive A via TanStack Query — one in-flight RPC per tripId.
 */
export function useDriverCommerceMission(
  tripId: string | null,
  options?: UseDriverCommerceMissionOptions,
): DriverCommerceMissionState {
  const id = (tripId ?? '').trim();
  const enabled = (options?.enabled ?? true) && id.length > 0;

  const query = useQuery({
    queryKey: driverCommerceMissionQueryKey(id),
    queryFn: async (): Promise<DriverTripStopOrderMission> => {
      const result = await fetchDriverTripStopOrders(id);
      if (!result.ok) throw result.error;
      return result.mission;
    },
    enabled,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  if (!id) {
    return { status: 'ready', mission: emptyDriverTripStopOrderMission('') };
  }

  if (!enabled) {
    return { status: 'ready', mission: emptyDriverTripStopOrderMission(id) };
  }

  if (query.isPending) {
    return { status: 'loading', mission: emptyDriverTripStopOrderMission(id) };
  }

  if (query.isError) {
    const error =
      query.error instanceof Error ? query.error : new Error(String(query.error));
    return {
      status: 'error',
      mission: emptyDriverTripStopOrderMission(id),
      error,
    };
  }

  return {
    status: 'ready',
    mission: query.data ?? emptyDriverTripStopOrderMission(id),
  };
}
