/**
 * useTripRatings — driver rating average for a trip.
 *
 * TripRatingsBlock owns getRatingsForTrip. A second select(*) here stacked with
 * documents/ops on completed-trip open (see supabase_logs-37).
 */
export function useTripRatings(
  _tripId: string | null | undefined,
  _tripCompleted: boolean,
) {
  return { driverRatingAvg: null as number | null };
}
