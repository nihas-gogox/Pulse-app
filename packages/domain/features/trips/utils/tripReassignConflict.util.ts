/** Returned when trip.updated_at changed before reassign PATCH (concurrent dispatcher). */
export const TRIP_REASSIGN_STALE_ERROR =
  'TRIP_REASSIGN_STALE:This trip was updated by someone else. Reload and try again.';

export function isTripReassignStaleError(message: string | null | undefined): boolean {
  return (message ?? '').startsWith('TRIP_REASSIGN_STALE:');
}

export function tripReassignStaleUserMessage(message: string | null | undefined): string {
  if (isTripReassignStaleError(message)) {
    return message!.slice('TRIP_REASSIGN_STALE:'.length);
  }
  return message ?? 'This trip was updated by someone else. Reload and try again.';
}
