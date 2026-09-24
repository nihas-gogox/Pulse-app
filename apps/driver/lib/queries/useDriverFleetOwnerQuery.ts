/**
 * Whether the signed-in driver has Fleet Owner capability enabled.
 * @see docs/DRIVER_FLEET_OWNER_PHASE1.md
 */
import { useAuth } from '@pulse/domain/contexts/AuthContext';
import {
  getDriverFleetOwnerProfile,
  type DriverFleetOwnerProfile,
} from '../../features/driver/services/driverFleetOwner.service';
import { queryKeys } from '@pulse/domain/lib/queryKeys';
import {
  infrastructureRetryDelay,
  infrastructureShouldRetry,
} from '@pulse/core/lib/queryRetry';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export function driverFleetOwnerQueryKey(userId: string) {
  return queryKeys.driverApp.fleetOwner(userId);
}

export function useDriverFleetOwnerQuery(userId?: string | null) {
  const { status, profile } = useAuth();
  const uid = userId ?? profile?.uid ?? '';
  const isDriver = profile?.role === 'driver';

  const query = useQuery({
    queryKey: driverFleetOwnerQueryKey(uid),
    queryFn: async (): Promise<DriverFleetOwnerProfile | null> => {
      const { error, profile: ownerProfile } =
        await getDriverFleetOwnerProfile(uid);
      if (error) throw error;
      return ownerProfile;
    },
    enabled: !!uid && isDriver && status !== 'restoring',
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: infrastructureShouldRetry,
    retryDelay: infrastructureRetryDelay,
    refetchOnWindowFocus: false,
  });

  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    if (!uid) return;
    void queryClient.invalidateQueries({
      queryKey: driverFleetOwnerQueryKey(uid),
    });
  }, [queryClient, uid]);

  return {
    ...query,
    isFleetOwner: Boolean(query.data),
    ownerProfile: query.data ?? null,
    invalidate,
  };
}
