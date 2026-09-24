import { queryKeys } from '../queryKeys';
import { driverInvitesReceivedQueryKey } from './useDriverInvitesQuery';
import { driverAvailabilityQueryKey } from './useDriverAvailabilityQuery';
import { syncLinkedDriversForDriverHome } from '../syncLinkedDriversForDriverHome';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/**
 * Invalidates all driver-home TanStack Query caches (drivers, pending OTP, invites,
 * A7.3 DCO availability). Manual refresh also re-syncs linked driver rows (not done
 * on poll).
 *
 * This is the mechanism the DCO Available surface relies on to reappear
 * automatically once a trip completes -- completeTrip() already calls this
 * helper today; adding the availability key here means no change to
 * completion mechanics themselves, just one more cache this existing call
 * refreshes.
 */
export function useInvalidateDriverHomeDashboard() {
  const qc = useQueryClient();

  return useCallback(
    async (userId: string, opts?: { syncLinkedDrivers?: boolean }) => {
      if (!userId) return;
      if (opts?.syncLinkedDrivers) {
        await syncLinkedDriversForDriverHome();
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.driverApp.root(userId) }),
        qc.invalidateQueries({ queryKey: driverInvitesReceivedQueryKey(userId) }),
        qc.invalidateQueries({ queryKey: driverAvailabilityQueryKey(userId) }),
      ]);
    },
    [qc],
  );
}
