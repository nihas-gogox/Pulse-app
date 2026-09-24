import type { TripRow } from "../../services/trips.service";
import type { OdometerVerificationState } from "../../../../../../features/trips/verification/types";

export function deriveVerificationState(
  trip: Pick<
    TripRow,
    | "start_odometer_km"
    | "end_odometer_km"
    | "distance_discrepancy_km"
    | "gps_distance_km"
    | "odometer_verification_state"
  >,
  opts?: { markBusinessVerified?: boolean },
): OdometerVerificationState {
  if (opts?.markBusinessVerified) return "business_verified";
  if (
    trip.odometer_verification_state &&
    trip.odometer_verification_state === "business_verified"
  ) {
    return "business_verified";
  }
  const hasStart = trip.start_odometer_km != null;
  const hasEnd = trip.end_odometer_km != null;
  if (!hasStart && !hasEnd) return "none";
  if (hasStart !== hasEnd) return "partial";
  if (trip.gps_distance_km != null && trip.distance_discrepancy_km != null) {
    return "gps_verified";
  }
  return "driver_verified";
}
