/**
 * A7.3 — the sole DCO availability truth. Wraps public.is_driver_available(),
 * the same backend function submit_market_bid / submit_driver_direct_bid /
 * accept_market_bid / accept_driver_direct_bid already gate on (see A6.3).
 * Never re-derive availability from a locally-fetched trips list or from
 * drivers.status (legacy dispatcher Online/Offline) -- those are different
 * concepts. This hook is the only thing that should answer "is this driver
 * currently eligible for new open-market work."
 */
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '@pulse/core/lib/supabase';
import { queryKeys } from '../queryKeys';
import {
  infrastructureRetryDelay,
  infrastructureShouldRetry,
} from '@pulse/core/lib/queryRetry';
import { useQuery } from '@tanstack/react-query';

export function driverAvailabilityQueryKey(userId: string) {
  return queryKeys.driverApp.availability(userId);
}

async function fetchIsDriverAvailable(userId: string): Promise<boolean> {
  const { data, error } = await supabase().rpc('is_driver_available', {
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export function useDriverAvailabilityQuery(userId?: string | null) {
  const { status, profile } = useAuth();
  const uid = userId ?? profile?.uid ?? '';

  const query = useQuery({
    queryKey: driverAvailabilityQueryKey(uid),
    queryFn: () => fetchIsDriverAvailable(uid),
    enabled: !!uid && status !== 'restoring',
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    retry: infrastructureShouldRetry,
    retryDelay: infrastructureRetryDelay,
    refetchOnWindowFocus: false,
  });

  return {
    ...query,
    /** true = eligible for new work, false = has a non-terminal trip,
     * undefined = not yet known (still loading / errored). */
    available: query.data,
  };
}
