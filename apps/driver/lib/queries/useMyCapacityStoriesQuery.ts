import { useAuth } from '@pulse/domain/contexts/AuthContext';
import { listMyFleetOwnerCapacityStories } from '../../features/driver/services/fleetOwnerCapacityStory.service';
import { useDriverFleetOwnerQuery } from './useDriverFleetOwnerQuery';
import { queryKeys } from '@pulse/domain/lib/queryKeys';
import {
  infrastructureRetryDelay,
  infrastructureShouldRetry,
} from '@pulse/core/lib/queryRetry';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

export function useMyCapacityStoriesQuery(userId?: string | null) {
  const { status, profile } = useAuth();
  const uid = userId ?? profile?.uid ?? '';
  const { isFleetOwner } = useDriverFleetOwnerQuery(uid);

  const query = useQuery({
    queryKey: queryKeys.driverApp.capacityStories(uid),
    queryFn: async () => {
      const { error, stories } = await listMyFleetOwnerCapacityStories(uid);
      if (error) throw error;
      return stories;
    },
    enabled: !!uid && isFleetOwner && status !== 'restoring',
    staleTime: 20_000,
    retry: infrastructureShouldRetry,
    retryDelay: infrastructureRetryDelay,
  });

  const qc = useQueryClient();
  const invalidate = useCallback(() => {
    if (!uid) return;
    void qc.invalidateQueries({ queryKey: queryKeys.driverApp.capacityStories(uid) });
  }, [qc, uid]);

  return {
    ...query,
    stories: query.data ?? [],
    activeStories: (query.data ?? []).filter((s) => s.is_active),
    invalidate,
  };
}
