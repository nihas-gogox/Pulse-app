/**
 * Sync linked driver rows for the current user outside React Query's queryFn.
 * Call from: login (driver), invite accept, manual refresh — not on every poll.
 */
import { syncLinkedDriverRowsForCurrentUser } from '../features/drivers/services/drivers.service';
import { queryKeys } from './queryKeys';
import type { QueryClient } from '@tanstack/react-query';

export async function syncLinkedDriversForDriverHome(): Promise<{
  error: Error | null;
  linkedCount: number;
}> {
  return syncLinkedDriverRowsForCurrentUser();
}

/** Sync then invalidate linked-drivers so UI refetches without sync-in-queryFn. */
export async function syncAndInvalidateLinkedDrivers(
  queryClient: QueryClient,
  userId: string,
): Promise<void> {
  if (!userId) return;
  await syncLinkedDriverRowsForCurrentUser();
  await queryClient.invalidateQueries({
    queryKey: queryKeys.driverApp.linkedDrivers(userId),
  });
}
