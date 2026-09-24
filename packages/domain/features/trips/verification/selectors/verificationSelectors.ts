import type { TripRow } from "../../services/trips.service";
import type {
  DistanceSource,
  TripVerificationSnapshot,
} from "../types";
import { deriveVerificationState } from "../state/verificationState";
import { computeDistanceDiscrepancy } from "../verification.service";

export const ODOMETER_GPS_CONFLICT_THRESHOLD_KM = 10;

export type OdometerGpsComparisonHint = {
  text: string;
  hasConflict: boolean;
};

export function buildOdometerGpsComparisonHint(input: {
  startOdometerKm: number | null;
  endOdometerKm: number | null;
  odometerDistanceKm: number | null;
  gpsDistanceKm: number | null;
  distanceDiscrepancyKm: number | null;
}): OdometerGpsComparisonHint | null {
  const hasStart = input.startOdometerKm != null;
  const hasEnd = input.endOdometerKm != null;
  if (!hasStart || !hasEnd) return null;

  const odoTrip = input.odometerDistanceKm;
  const gps = input.gpsDistanceKm;

  if (gps == null && odoTrip == null) return null;

  if (gps == null) {
    return {
      text: `Odo trip ${formatKm(odoTrip)} · GPS unavailable`,
      hasConflict: false,
    };
  }

  if (odoTrip == null) {
    return {
      text: `GPS ${formatKm(gps)} tracked · odo trip pending`,
      hasConflict: false,
    };
  }

  const delta =
    input.distanceDiscrepancyKm ??
    computeDistanceDiscrepancy(odoTrip, gps);
  const hasConflict =
    delta != null && delta >= ODOMETER_GPS_CONFLICT_THRESHOLD_KM;

  if (hasConflict) {
    return {
      text: `Odo ${formatKm(odoTrip)} · GPS ${formatKm(gps)} · Δ ${formatKm(delta)} conflict`,
      hasConflict: true,
    };
  }

  const deltaLabel = delta != null ? formatKm(delta) : "0 KM";
  return {
    text: `GPS ${formatKm(gps)} verified · odo ${formatKm(odoTrip)} · Δ ${deltaLabel}`,
    hasConflict: false,
  };
}

export function toVerificationSnapshot(trip: TripRow): TripVerificationSnapshot {
  return {
    startOdometerKm: trip.start_odometer_km ?? null,
    endOdometerKm: trip.end_odometer_km ?? null,
    odometerDistanceKm: trip.odometer_distance_km ?? null,
    gpsDistanceKm: trip.gps_distance_km ?? null,
    distanceDiscrepancyKm: trip.distance_discrepancy_km ?? null,
    distanceSource: (trip.distance_source as DistanceSource | null) ?? null,
    state: deriveVerificationState(trip),
    odometerNotes: trip.odometer_notes ?? null,
    odometerUpdatedAt: trip.odometer_updated_at ?? null,
    odometerUpdatedBy: trip.odometer_updated_by ?? null,
  };
}

export function formatKm(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  return `${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 1 })} KM`;
}
