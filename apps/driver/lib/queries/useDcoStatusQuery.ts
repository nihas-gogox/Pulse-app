/**
 * DCO (driver-cum-owner / independent owner-operator) admin-approval
 * status for the signed-in driver. Unrelated to the pre-existing "DCO
 * Available" A7.3 surface (queryKeys.driverApp.availability) — same
 * three-letter acronym, different domain; see dcoOwnerOperator's own note.
 */
import { useAuth } from '@pulse/domain/contexts/AuthContext';
import {
  getMyDcoProfile,
  type DcoProfile,
  type DcoStatus,
} from '../../features/driver/services/dco.service';
import { queryKeys } from '@pulse/domain/lib/queryKeys';
import {
  infrastructureRetryDelay,
  infrastructureShouldRetry,
} from '@pulse/core/lib/queryRetry';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export function useDcoStatusQuery(userId?: string | null) {
  const { status: authStatus, profile } = useAuth();
  const uid = userId ?? profile?.uid ?? '';
  const isDriver = profile?.role === 'driver';

  const query = useQuery({
    queryKey: queryKeys.driverApp.dcoOwnerOperator(uid),
    queryFn: async (): Promise<DcoProfile | null> => {
      const { error, profile: dcoProfile } = await getMyDcoProfile(uid);
      if (error) throw error;
      return dcoProfile;
    },
    enabled: !!uid && isDriver && authStatus !== 'restoring',
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    retry: infrastructureShouldRetry,
    retryDelay: infrastructureRetryDelay,
    refetchOnWindowFocus: false,
  });

  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    if (!uid) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.driverApp.dcoOwnerOperator(uid),
    });
  }, [queryClient, uid]);

  const status: DcoStatus = query.data?.status ?? 'NONE';

  return {
    ...query,
    dcoProfile: query.data ?? null,
    status,
    isDcoApproved: status === 'APPROVED',
    invalidate,
  };
}
