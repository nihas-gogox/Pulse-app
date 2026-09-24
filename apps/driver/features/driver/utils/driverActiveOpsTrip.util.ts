import {
  isActiveMission,
  isAggregateTrip,
  isCompletedStatus,
} from "@pulse/domain/features/drivers/utils/driverUtils.util";
import type { TripRow } from "@pulse/domain/features/trips/services/trips.service";
import { isDcoOperatingTrip } from "@pulse/domain/features/trips/domain/tripDcoOperating";
import { isAssetExecutionTrip } from "@pulse/domain/features/trips/domain/tripExecutionModel";

function normalizeStatus(status: string | null | undefined): string {
  return String(status ?? "").trim().toLowerCase();
}

/** Trip is underway — DB status or started_at indicates execution has begun. */
export function isDriverTripInProgress(trip: TripRow): boolean {
  if (isCompletedStatus(trip.status)) return false;
  if (isActiveMission(trip.status)) return true;
  if (trip.started_at) return true;

  const status = normalizeStatus(trip.status);
  return status === "accepted" || status === "at_pickup" || status === "confirmed";
}

/** Driver accepted this trip id and it is not completed yet (includes pre-pickup assigned). */
export function isDriverAcceptedOpsTrip(
  trip: TripRow,
  acceptedTripId: string | null | undefined,
): boolean {
  if (!acceptedTripId?.trim() || isCompletedStatus(trip.status)) return false;
  return String(trip.id).trim().toLowerCase() === acceptedTripId.trim().toLowerCase();
}

export type ResolveDriverOpsActiveTripInput = {
  trips: TripRow[];
  pendingTrips?: TripRow[];
  acceptedTripId?: string | null;
};

/**
 * Trip eligible for header expense / odometer shortcuts:
 * 1) in-progress execution, or
 * 2) driver-accepted trip id (assigned → pickup, before status flips to in_progress).
 */
export function resolveDriverOpsActiveTrip({
  trips,
  pendingTrips = [],
  acceptedTripId,
}: ResolveDriverOpsActiveTripInput): TripRow | null {
  const inProgress = trips.find(isDriverTripInProgress);
  if (inProgress) return inProgress;

  if (!acceptedTripId?.trim()) return null;

  const want = acceptedTripId.trim().toLowerCase();
  const pool = [...trips, ...pendingTrips];
  return (
    pool.find(
      (trip) =>
        String(trip.id).trim().toLowerCase() === want &&
        !isCompletedStatus(trip.status),
    ) ?? null
  );
}

/** @deprecated Use resolveDriverOpsActiveTrip */
export function findDriverActiveOpsTrip(trips: TripRow[]): TripRow | null {
  return resolveDriverOpsActiveTrip({ trips });
}

export function driverOpsTripCapabilities(trip: TripRow | null | undefined) {
  if (!trip) {
    return { showExpense: true, showOdometer: true, isAsset: false };
  }
  if (isDcoOperatingTrip(trip)) {
    return { showExpense: true, showOdometer: true, isAsset: false };
  }
  const isAsset = isAssetExecutionTrip(trip);
  return {
    showExpense: isAsset && !isAggregateTrip(trip),
    showOdometer: isAsset,
    isAsset,
  };
}

/** Pick the best odometer entry screen without a launcher step. */
export function resolveDefaultOdometerVerificationSide(
  trip: TripRow | null | undefined,
): "start" | "end" | "both" {
  if (!trip) return "both";
  const hasStart =
    trip.start_odometer_km != null && Number.isFinite(Number(trip.start_odometer_km));
  const hasEnd =
    trip.end_odometer_km != null && Number.isFinite(Number(trip.end_odometer_km));
  if (!hasStart) return "start";
  if (!hasEnd) return "end";
  return "both";
}
