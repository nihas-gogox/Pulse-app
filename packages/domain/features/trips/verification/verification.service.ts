import { supabase } from "@pulse/core/lib/supabase";
import type { TripRow } from "../services/trips.service";
import { appendTripOperationalTimelineEventSafe } from "../operations/timeline/timelineEvents.service";
import type {
  DistanceSource,
  OdometerVerificationState,
  TripVerificationSnapshot,
  VerificationSide,
} from "../../../../../features/trips/verification/types";

export interface SaveTripVerificationInput {
  tripId: string;
  side: VerificationSide;
  odometerKm: number | null;
  gpsDistanceKm?: number | null;
  notes?: string | null;
  updatedBy: string | null;
  markBusinessVerified?: boolean;
}

export interface SaveTripVerificationBothInput {
  tripId: string;
  startOdometerKm: number | null;
  endOdometerKm: number | null;
  gpsDistanceKm?: number | null;
  notes?: string | null;
  updatedBy: string | null;
  markBusinessVerified?: boolean;
}

function roundKm(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 10) / 10;
}

export function computeOdometerDistance(
  startKm: number | null,
  endKm: number | null,
): number | null {
  if (startKm == null || endKm == null) return null;
  const delta = endKm - startKm;
  if (!Number.isFinite(delta) || delta < 0) return null;
  return roundKm(delta);
}

export function computeDistanceDiscrepancy(
  odometerDistanceKm: number | null,
  gpsDistanceKm: number | null,
): number | null {
  if (odometerDistanceKm == null || gpsDistanceKm == null) return null;
  return roundKm(Math.abs(odometerDistanceKm - gpsDistanceKm));
}

export function deriveDistanceSource(
  odometerDistanceKm: number | null,
  gpsDistanceKm: number | null,
): DistanceSource | null {
  const hasOdo = odometerDistanceKm != null;
  const hasGps = gpsDistanceKm != null;
  if (hasOdo && hasGps) return "hybrid";
  if (hasOdo) return "odometer";
  if (hasGps) return "gps";
  return null;
}

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

export function toVerificationSnapshot(trip: TripRow): TripVerificationSnapshot {
  return {
    startOdometerKm: trip.start_odometer_km ?? null,
    endOdometerKm: trip.end_odometer_km ?? null,
    odometerDistanceKm: trip.odometer_distance_km ?? null,
    gpsDistanceKm: trip.gps_distance_km ?? null,
    distanceDiscrepancyKm: trip.distance_discrepancy_km ?? null,
    distanceSource: (trip.distance_source as DistanceSource | null) ?? null,
    state:
      (trip.odometer_verification_state as OdometerVerificationState | null) ??
      "none",
    odometerNotes: trip.odometer_notes ?? null,
    odometerUpdatedAt: trip.odometer_updated_at ?? null,
    odometerUpdatedBy: trip.odometer_updated_by ?? null,
  };
}

export async function saveTripVerification(
  input: SaveTripVerificationInput,
): Promise<{ error: Error | null; trip: TripRow | null }> {
  const { data: current, error: readError } = await supabase()
    .from("trips")
    .select(
      "id, start_odometer_km, end_odometer_km, gps_distance_km, odometer_verification_state",
    )
    .eq("id", input.tripId)
    .maybeSingle();

  if (readError) return { error: new Error(readError.message), trip: null };
  if (!current) return { error: new Error("Trip not found"), trip: null };

  const startKm =
    input.side === "start"
      ? roundKm(input.odometerKm)
      : roundKm(current.start_odometer_km as number | null);
  const endKm =
    input.side === "end"
      ? roundKm(input.odometerKm)
      : roundKm(current.end_odometer_km as number | null);
  const gpsDistanceKm =
    input.gpsDistanceKm !== undefined
      ? roundKm(input.gpsDistanceKm)
      : roundKm(current.gps_distance_km as number | null);
  const odometerDistanceKm = computeOdometerDistance(startKm, endKm);
  const discrepancyKm = computeDistanceDiscrepancy(odometerDistanceKm, gpsDistanceKm);
  const distanceSource = deriveDistanceSource(odometerDistanceKm, gpsDistanceKm);
  const state = deriveVerificationState(
    {
      start_odometer_km: startKm,
      end_odometer_km: endKm,
      distance_discrepancy_km: discrepancyKm,
      gps_distance_km: gpsDistanceKm,
      odometer_verification_state:
        (current.odometer_verification_state as string | null) ?? null,
    },
    { markBusinessVerified: input.markBusinessVerified },
  );

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    start_odometer_km: startKm,
    end_odometer_km: endKm,
    odometer_distance_km: odometerDistanceKm,
    gps_distance_km: gpsDistanceKm,
    distance_discrepancy_km: discrepancyKm,
    distance_source: distanceSource,
    odometer_verification_state: state,
    odometer_notes: (input.notes ?? "").trim() || null,
    odometer_updated_by: input.updatedBy,
    odometer_updated_at: new Date().toISOString(),
  };

  const { data: row, error } = await supabase()
    .from("trips")
    .update(updates)
    .eq("id", input.tripId)
    .select()
    .maybeSingle();

  if (error) return { error: new Error(error.message), trip: null };
  const persisted = (row ?? null) as TripRow | null;
  if (persisted != null) {
    await appendTripOperationalTimelineEventSafe({
      organizationId: persisted.organization_id,
      tripId: persisted.id,
      eventType: "odometer_added",
      sourceType: "odometer",
      sourceId: persisted.id,
      actorUserId: input.updatedBy ?? null,
      payload: {
        side: input.side,
        odometerKm: input.odometerKm,
        discrepancyKm,
        verificationState: state,
      },
    });
    if (discrepancyKm != null && discrepancyKm > 0) {
      await appendTripOperationalTimelineEventSafe({
        organizationId: persisted.organization_id,
        tripId: persisted.id,
        eventType: "discrepancy_detected",
        sourceType: "odometer",
        sourceId: persisted.id,
        actorUserId: input.updatedBy ?? null,
        payload: {
          discrepancyKm,
          distanceSource,
        },
      });
    }
  }
  return { error: null, trip: persisted };
}

export async function saveTripVerificationBoth(
  input: SaveTripVerificationBothInput,
): Promise<{ error: Error | null; trip: TripRow | null }> {
  const { data: current, error: readError } = await supabase()
    .from("trips")
    .select(
      "id, start_odometer_km, end_odometer_km, gps_distance_km, odometer_verification_state",
    )
    .eq("id", input.tripId)
    .maybeSingle();

  if (readError) return { error: new Error(readError.message), trip: null };
  if (!current) return { error: new Error("Trip not found"), trip: null };

  const startKm = roundKm(input.startOdometerKm);
  const endKm = roundKm(input.endOdometerKm);
  const gpsDistanceKm =
    input.gpsDistanceKm !== undefined
      ? roundKm(input.gpsDistanceKm)
      : roundKm(current.gps_distance_km as number | null);
  const odometerDistanceKm = computeOdometerDistance(startKm, endKm);
  const discrepancyKm = computeDistanceDiscrepancy(odometerDistanceKm, gpsDistanceKm);
  const distanceSource = deriveDistanceSource(odometerDistanceKm, gpsDistanceKm);
  const state = deriveVerificationState(
    {
      start_odometer_km: startKm,
      end_odometer_km: endKm,
      distance_discrepancy_km: discrepancyKm,
      gps_distance_km: gpsDistanceKm,
      odometer_verification_state:
        (current.odometer_verification_state as string | null) ?? null,
    },
    { markBusinessVerified: input.markBusinessVerified },
  );

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    start_odometer_km: startKm,
    end_odometer_km: endKm,
    odometer_distance_km: odometerDistanceKm,
    gps_distance_km: gpsDistanceKm,
    distance_discrepancy_km: discrepancyKm,
    distance_source: distanceSource,
    odometer_verification_state: state,
    odometer_notes: (input.notes ?? "").trim() || null,
    odometer_updated_by: input.updatedBy,
    odometer_updated_at: new Date().toISOString(),
  };

  const { data: row, error } = await supabase()
    .from("trips")
    .update(updates)
    .eq("id", input.tripId)
    .select()
    .maybeSingle();

  if (error) return { error: new Error(error.message), trip: null };
  const persisted = (row ?? null) as TripRow | null;
  if (persisted != null) {
    await appendTripOperationalTimelineEventSafe({
      organizationId: persisted.organization_id,
      tripId: persisted.id,
      eventType: "odometer_added",
      sourceType: "odometer",
      sourceId: persisted.id,
      actorUserId: input.updatedBy ?? null,
      payload: {
        side: "both",
        startOdometerKm: startKm,
        endOdometerKm: endKm,
        discrepancyKm,
        verificationState: state,
      },
    });
    if (discrepancyKm != null && discrepancyKm > 0) {
      await appendTripOperationalTimelineEventSafe({
        organizationId: persisted.organization_id,
        tripId: persisted.id,
        eventType: "discrepancy_detected",
        sourceType: "odometer",
        sourceId: persisted.id,
        actorUserId: input.updatedBy ?? null,
        payload: {
          discrepancyKm,
          distanceSource,
        },
      });
    }
  }
  return { error: null, trip: persisted };
}
