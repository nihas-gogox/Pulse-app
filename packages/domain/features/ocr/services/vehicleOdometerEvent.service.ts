import { supabase } from "@pulse/core/lib/supabase";

import type { OcrJobRow } from "../types/ocr.types";
import type { OdometerPhotoOcrResult } from "../../trips/verification/odometerPhotoOcr.service";

type PersistInput = {
  job: OcrJobRow;
  eventSide: "start" | "end";
  tripId: string | null;
  vehicleId: string | null;
  driverId: string | null;
  photoStoragePath: string | null;
};

function kmFromJob(job: OcrJobRow): { km: number; confidence: number | null } | null {
  const payload = job.result_json as { odometerKm?: OdometerPhotoOcrResult["odometerKm"] } | null;
  const field = payload?.odometerKm;
  if (!field || field.value == null || !Number.isFinite(field.value)) return null;
  return { km: field.value, confidence: field.confidence ?? job.confidence_score };
}

export async function persistVehicleOdometerEventFromJob(
  input: PersistInput,
): Promise<void> {
  const reading = kmFromJob(input.job);
  if (!reading) return;

  const { error } = await supabase().from("vehicle_odometer_events").insert({
    organization_id: input.job.organization_id,
    vehicle_id: input.vehicleId,
    trip_id: input.tripId,
    driver_id: input.driverId,
    ocr_job_id: input.job.id,
    event_side: input.eventSide,
    odometer_km: reading.km,
    confidence_score: reading.confidence,
    reading_source: "ocr",
    photo_storage_path: input.photoStoragePath,
    recorded_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function listVehicleOdometerEventsForTrip(tripId: string) {
  const { data, error } = await supabase()
    .from("vehicle_odometer_events")
    .select("*")
    .eq("trip_id", tripId)
    .order("recorded_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
