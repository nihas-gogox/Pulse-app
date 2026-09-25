/**
 * Driver app: phone-preassigned trips waiting for OTP claim (RPC get_pending_otp_trips).
 */
import type { PendingOtpTripRow } from '../../features/trips/services/tripOtp.service';
import { getPendingOtpTrips } from '../../features/trips/services/tripOtp.service';
import { useAuth } from '../../contexts/AuthContext';
import { useAppStateIsActive } from '@pulse/core/lib/hooks/useAppStateIsActive';
import { queryKeys } from '../queryKeys';
import {
  infrastructureRetryDelay,
  infrastructureShouldRetry,
} from '@pulse/core/lib/queryRetry';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

const STALE_MS = 30_000;
const EMPTY_PENDING_OTP: PendingOtpTripRow[] = [];
const POLL_WITH_PENDING_MS = 30_000;
const POLL_IDLE_MS = 120_000;

export function pendingOtpTripsQueryKey(userId: string) {
  return queryKeys.driverApp.pendingOtpTrips(userId);
}

function hasPendingOtpTrips(trips: PendingOtpTripRow[] | undefined): boolean {
  return (trips?.length ?? 0) > 0;
}

export function usePendingOtpTripsQuery(userId: string | null) {
  const appActive = useAppStateIsActive();
  const { status } = useAuth();
  const uid = userId ?? '';

  const query = useQuery({
    queryKey: pendingOtpTripsQueryKey(uid),
    queryFn: async () => {
      const { error, trips } = await getPendingOtpTrips();
      if (error) throw error;
      return trips ?? [];
    },
    enabled: !!uid && status !== 'restoring',
    staleTime: STALE_MS,
    gcTime: 10 * 60_000,
    retry: infrastructureShouldRetry,
    retryDelay: infrastructureRetryDelay,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchInterval: (q) => {
      if (!appActive) return false;
      if (q.state.status === 'error') return false;
      return hasPendingOtpTrips(q.state.data) ? POLL_WITH_PENDING_MS : POLL_IDLE_MS;
    },
  });

  const refreshPendingOtpTrips = useCallback(async () => {
    await query.refetch();
  }, [query.refetch]);

  return {
    isPending: query.isPending,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    isFetched: query.isFetched,
    dataUpdatedAt: query.dataUpdatedAt,
    refetch: query.refetch,
    pendingTrips: query.data ?? EMPTY_PENDING_OTP,
    refreshPendingOtpTrips,
  };
}

export function useInvalidatePendingOtpTrips() {
  const qc = useQueryClient();
  return (userId: string) => {
    void qc.invalidateQueries({ queryKey: pendingOtpTripsQueryKey(userId) });
  };
}
