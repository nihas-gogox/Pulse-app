import { useAuth } from '@pulse/domain/contexts/AuthContext';
import { listOpenMarketplaceLoadsForFleetOwner } from '../../features/driver/services/fleetOwnerLoads.service';
import { useDriverFleetOwnerQuery } from './useDriverFleetOwnerQuery';
import { queryKeys } from '@pulse/domain/lib/queryKeys';
import {
  infrastructureRetryDelay,
  infrastructureShouldRetry,
} from '@pulse/core/lib/queryRetry';
import { useQuery } from '@tanstack/react-query';

export function useFleetOwnerOpenLoadsQuery(userId?: string | null) {
  const { status, profile } = useAuth();
  const uid = userId ?? profile?.uid ?? '';
  const { isFleetOwner } = useDriverFleetOwnerQuery(uid);

  const query = useQuery({
    queryKey: queryKeys.driverApp.fleetOwnerOpenLoads(uid),
    queryFn: async () => {
      const { error, loads } = await listOpenMarketplaceLoadsForFleetOwner(50);
      if (error) throw error;
      return loads;
    },
    enabled: !!uid && isFleetOwner && status !== 'restoring',
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    retry: infrastructureShouldRetry,
    retryDelay: infrastructureRetryDelay,
    refetchOnWindowFocus: true,
  });

  return {
    ...query,
    loads: query.data ?? [],
  };
}
