/**
 * Live driver presence for the Business Trip Stages panel's Driver Card
 * (speed, heading, last-GPS age). driver_presence is NOT on the
 * supabase_realtime publication (checked: no ADD TABLE for it anywhere in
 * supabase/migrations/), so this polls rather than subscribing — the
 * imperative map marker path (useLiveDriverMarker) uses Broadcast instead,
 * which is a separate mechanism from this plain-text readout.
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import {
  getDriverPresenceForTrip,
  type DriverPresenceRow,
} from '../../features/tracking/services/driverPresence.service';

const POLL_MS = 10_000;

export function useTripDriverPresenceQuery(tripId: string | null): {
  presence: DriverPresenceRow | null;
  isLoading: boolean;
  error: Error | null;
} {
  const query = useQuery({
    queryKey: queryKeys.trips.driverPresence(tripId ?? ''),
    queryFn: async () => {
      const { presence, error } = await getDriverPresenceForTrip(tripId!);
      if (error) throw error;
      return presence;
    },
    enabled: !!tripId,
    staleTime: POLL_MS,
    refetchInterval: POLL_MS,
  });

  return {
    presence: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
  };
}
