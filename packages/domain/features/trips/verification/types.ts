export type VerificationSide = "start" | "end";

export type OdometerVerificationState =
  | "none"
  | "partial"
  | "driver_verified"
  | "business_verified"
  | "gps_verified";

export type DistanceSource = "odometer" | "gps" | "hybrid" | "estimated";

export interface TripVerificationSnapshot {
  startOdometerKm: number | null;
  endOdometerKm: number | null;
  odometerDistanceKm: number | null;
  gpsDistanceKm: number | null;
  distanceDiscrepancyKm: number | null;
  distanceSource: DistanceSource | null;
  state: OdometerVerificationState;
  odometerNotes: string | null;
  odometerUpdatedAt: string | null;
  odometerUpdatedBy: string | null;
}
