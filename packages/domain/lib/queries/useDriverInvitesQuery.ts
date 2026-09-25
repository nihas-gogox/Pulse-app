/**
 * Driver app: received fleet invites (RPC get_driver_invites_received).
 * TanStack Query dedupes concurrent mounts; refetchInterval replaces manual setInterval polling.
 */
import type { DriverInviteRow } from '../../features/drivers/services/drivers.service';
import { getDriverInvitesReceived } from '../../features/drivers/services/drivers.service';
import { useAppStateIsActive } from '@pulse/core/lib/hooks/useAppStateIsActive';
import { queryKeys } from '../queryKeys';
import {
  infrastructureRetryDelay,
  infrastructureShouldRetry,
} from '@pulse/core/lib/queryRetry';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

const INVITES_STALE_MS = 30_000;
const EMPTY_INVITES: DriverInviteRow[] = [];
const POLL_PENDING_MS = 15_000;
const POLL_IDLE_MS = 60_000;

function hasPendingInvites(invites: DriverInviteRow[] | undefined): boolean {
  return (
    invites?.some((i) => String(i.status ?? '').toLowerCase() === 'pending') ?? false
  );
}

export function driverInvitesReceivedQueryKey(userId: string) {
  return queryKeys.driverInvites.received(userId);
}

export function useDriverInvitesQuery(userId: string | null) {
  const appActive = useAppStateIsActive();
  const uid = userId ?? '';

  const query = useQuery({
    queryKey: driverInvitesReceivedQueryKey(uid),
    queryFn: async () => {
      const { error, invites } = await getDriverInvitesReceived();
      if (error) throw error;
      return invites ?? [];
    },
    enabled: !!uid,
    staleTime: INVITES_STALE_MS,
    gcTime: 10 * 60_000,
    retry: infrastructureShouldRetry,
    retryDelay: infrastructureRetryDelay,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchInterval: (q) => {
      if (!appActive) return false;
      return hasPendingInvites(q.state.data) ? POLL_PENDING_MS : POLL_IDLE_MS;
    },
  });

  const pendingInvites = useMemo(
    () =>
      (query.data ?? []).filter(
        (i) => String(i.status ?? '').toLowerCase() === 'pending',
      ),
    [query.data],
  );

  const refreshInvites = useCallback(async () => {
    await query.refetch();
  }, [query.refetch]);

  return {
    ...query,
    allInvites: query.data ?? EMPTY_INVITES,
    pendingInvites,
    pendingCount: pendingInvites.length,
    refreshInvites,
  };
}

export function useInvalidateDriverInvitesReceived() {
  const qc = useQueryClient();
  return (userId: string) => {
    void qc.invalidateQueries({ queryKey: driverInvitesReceivedQueryKey(userId) });
  };
}
