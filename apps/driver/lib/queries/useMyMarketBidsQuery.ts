import { useAuth } from '@pulse/domain/contexts/AuthContext';
import { listMyMarketBids } from '../../features/driver/services/marketBids.service';
import { queryKeys } from '@pulse/domain/lib/queryKeys';
import {
  infrastructureRetryDelay,
  infrastructureShouldRetry,
} from '@pulse/core/lib/queryRetry';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/** All of this bidder's own market_bids rows — My Bids screen. */
export function useMyMarketBidsQuery(userId?: string | null) {
  const { status, profile } = useAuth();
  const uid = userId ?? profile?.uid ?? '';

  const query = useQuery({
    queryKey: queryKeys.driverApp.myMarketBids(uid),
    queryFn: async () => {
      const { error, bids } = await listMyMarketBids(uid);
      if (error) throw error;
      return bids;
    },
    enabled: !!uid && status !== 'restoring',
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
      queryKey: queryKeys.driverApp.myMarketBids(uid),
    });
  }, [queryClient, uid]);

  return { ...query, bids: query.data ?? [], invalidate };
}
