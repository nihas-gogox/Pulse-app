import { getTripsByDriverIds } from '@pulse/domain/features/trips/services/trips.service';
import { PRESERVABLE_TRIP_STATUSES } from '@pulse/domain/features/trips/utils/tripPreservableStatuses.util';
import { queryKeys } from '@pulse/domain/lib/queryKeys';
import {
  infrastructureRetryDelay,
  infrastructureShouldRetry,
} from '@pulse/core/lib/queryRetry';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

const ACTIVE_STATUSES = new Set<string>(PRESERVABLE_TRIP_STATUSES);

/**
 * Phase A5 — active/upcoming trip counts for the Pilot relationship summary.
 * Reuses getTripsByDriverIds (the same trips_driver_view read every other
 * driver trip list already goes through) and the existing PRESERVABLE_TRIP_STATUSES
 * vocabulary for "currently active" rather than inventing a new status list.
 * A separate fetch from DriverDailySummaryCard's own trips read (which
 * aggregates a different shape — today's earnings/trips), not a duplicate of
 * the employer/relationship data itself.
 */
export function usePilotWorkSummaryQuery(driverIds: string[]) {
  const driverIdsKey = useMemo(() => [...driverIds].sort().join(','), [driverIds]);

  const query = useQuery({
    queryKey: queryKeys.driverApp.pilotWorkSummary(driverIdsKey),
    queryFn: async () => {
      if (driverIds.length === 0) return { activeCount: 0, upcomingCount: 0 };
      const { error, trips } = await getTripsByDriverIds(driverIds, {
        limit: 100,
        offset: 0,
      });
      if (error) throw error;
      let activeCount = 0;
      let upcomingCount = 0;
      for (const t of trips ?? []) {
        if (ACTIVE_STATUSES.has(t.status)) activeCount += 1;
        else if (t.status === 'assigned') upcomingCount += 1;
      }
      return { activeCount, upcomingCount };
    },
    enabled: driverIds.length > 0,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    retry: infrastructureShouldRetry,
    retryDelay: infrastructureRetryDelay,
    refetchOnWindowFocus: true,
  });

  return {
    ...query,
    activeCount: query.data?.activeCount ?? 0,
    upcomingCount: query.data?.upcomingCount ?? 0,
  };
}
