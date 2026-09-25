/**
 * Fleet Owner personal vehicle list / detail queries.
 */
import { useAuth } from '@pulse/domain/contexts/AuthContext';
import {
  getOwnerVehicleById,
  listOwnerVehicles,
  type OwnerVehicleRow,
} from '../../features/driver/services/ownerVehicles.service';
import { queryKeys } from '@pulse/domain/lib/queryKeys';
import {
  infrastructureRetryDelay,
  infrastructureShouldRetry,
} from '@pulse/core/lib/queryRetry';
import { useDriverFleetOwnerQuery } from './useDriverFleetOwnerQuery';
import { useDcoStatusQuery } from './useDcoStatusQuery';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export function useOwnerVehiclesQuery(userId?: string | null) {
  const { status, profile } = useAuth();
  const uid = userId ?? profile?.uid ?? '';
  const { isFleetOwner } = useDriverFleetOwnerQuery(uid);
  const { isDcoApproved } = useDcoStatusQuery(uid);
  const canOwnVehicles = isFleetOwner || isDcoApproved;

  const query = useQuery({
    queryKey: queryKeys.driverApp.ownerVehicles(uid),
    queryFn: async (): Promise<OwnerVehicleRow[]> => {
      const { error, vehicles } = await listOwnerVehicles(uid);
      if (error) throw error;
      return vehicles;
    },
    enabled: !!uid && canOwnVehicles && status !== 'restoring',
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    retry: infrastructureShouldRetry,
    retryDelay: infrastructureRetryDelay,
    refetchOnWindowFocus: true,
  });

  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    if (!uid) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.driverApp.ownerVehicles(uid),
    });
  }, [queryClient, uid]);

  return { ...query, vehicles: query.data ?? [], invalidate };
}

export function useOwnerVehicleDetailQuery(
  vehicleId: string | null | undefined,
  userId?: string | null,
) {
  const { status, profile } = useAuth();
  const uid = userId ?? profile?.uid ?? '';
  const { isFleetOwner } = useDriverFleetOwnerQuery(uid);
  const { isDcoApproved } = useDcoStatusQuery(uid);
  const id = vehicleId?.trim() || '';

  return useQuery({
    queryKey: queryKeys.driverApp.ownerVehicle(uid, id),
    queryFn: async (): Promise<OwnerVehicleRow | null> => {
      const { error, vehicle } = await getOwnerVehicleById(uid, id);
      if (error) throw error;
      return vehicle;
    },
    enabled: !!uid && !!id && (isFleetOwner || isDcoApproved) && status !== 'restoring',
    staleTime: 30_000,
    retry: infrastructureShouldRetry,
    retryDelay: infrastructureRetryDelay,
  });
}
