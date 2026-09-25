import { useAuth } from '@pulse/domain/contexts/AuthContext';
import { getMyMarketBidForIndent } from '../../features/driver/services/marketBids.service';
import { queryKeys } from '@pulse/domain/lib/queryKeys';
import {
  infrastructureRetryDelay,
  infrastructureShouldRetry,
} from '@pulse/core/lib/queryRetry';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

/** This bidder's own bid on one indent, if any — drives the Load detail Bid state. */
export function useMyMarketBidForIndentQuery(
  indentId: string,
  userId?: string | null,
) {
  const { status, profile } = useAuth();
  const uid = userId ?? profile?.uid ?? '';
  const id = indentId?.trim() || '';

  const query = useQuery({
    queryKey: queryKeys.driverApp.myMarketBidForIndent(uid, id),
    queryFn: async () => {
      const { error, bid } = await getMyMarketBidForIndent(uid, id);
      if (error) throw error;
      return bid;
    },
    enabled: !!uid && !!id && status !== 'restoring',
    staleTime: 15_000,
    gcTime: 10 * 60_000,
    retry: infrastructureShouldRetry,
    retryDelay: infrastructureRetryDelay,
    refetchOnWindowFocus: true,
  });

  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    if (!uid || !id) return;
    void queryClient.invalidateQueries({
      queryKey: queryKeys.driverApp.myMarketBidForIndent(uid, id),
    });
  }, [queryClient, uid, id]);

  return { ...query, bid: query.data ?? null, invalidate };
}
