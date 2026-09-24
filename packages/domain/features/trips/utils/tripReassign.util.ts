import type { TripRow } from '../services/trips.service';
import {
  FIRST_ASSIGN_TARGET_STATUSES,
  isPreservableTripStatus,
} from './tripPreservableStatuses.util';

/**
 * True when assigning a driver for the first time should set status → `assigned`.
 * Reassign preserves trip stage — only driver_id and vehicle_id change.
 */
export function shouldMarkAssignedOnFirstAssign(
  trip: Pick<TripRow, 'status' | 'started_at' | 'completed_at'>,
): boolean {
  if (trip.started_at) return false;
  if (trip.completed_at) return false;
  const s = (trip.status ?? '').toLowerCase().trim();
  if (!s) return true;
  if (isPreservableTripStatus(s)) return false;
  return FIRST_ASSIGN_TARGET_STATUSES.has(s);
}

export function isMidTripStatus(status: string | null | undefined): boolean {
  return isPreservableTripStatus(status);
}
