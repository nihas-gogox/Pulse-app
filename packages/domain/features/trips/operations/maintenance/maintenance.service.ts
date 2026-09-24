import * as tripDocumentsService from "../../services/tripDocuments.service";
import { supabase } from "@pulse/core/lib/supabase";
import type {
  SaveVehicleMaintenanceInput,
  VehicleMaintenanceEntry,
} from "../types";
import { appendTripOperationalTimelineEventSafe } from "../timeline/timelineEvents.service";

function toNullableText(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  return v.length ? v : null;
}

function toNullablePositive(value: number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export async function getVehicleMaintenanceEntries(input: {
  organizationId: string;
  vehicleId: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<{ error: Error | null; entries: VehicleMaintenanceEntry[] }> {
  const query = supabase()
    .from("vehicle_maintenance_entries")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("vehicle_id", input.vehicleId)
    .eq("status", "active")
    .order("entered_at", { ascending: false })
    .limit(input.limit ?? 60);
  const { data, error } = await (input.signal ? query.abortSignal(input.signal) : query);
  if (error) return { error: new Error(error.message), entries: [] };
  return { error: null, entries: (data ?? []) as VehicleMaintenanceEntry[] };
}

export async function createVehicleMaintenanceEntry(
  input: Omit<SaveVehicleMaintenanceInput, "invoiceLocalUri"> & {
    invoiceStoragePath?: string | null;
  },
): Promise<{ error: Error | null; entry: VehicleMaintenanceEntry | null }> {
  const payload = {
    organization_id: input.organizationId,
    vehicle_id: input.vehicleId,
    trip_id: input.tripId ?? null,
    maintenance_type: input.maintenanceType,
    amount_inr: Math.max(0, Number(input.amountInr) || 0),
    notes: toNullableText(input.notes),
    invoice_storage_path: toNullableText(input.invoiceStoragePath),
    next_due_km: toNullablePositive(input.nextDueKm),
    next_due_date: toNullableText(input.nextDueDate),
    entered_by: input.enteredBy,
    entered_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    status: "active",
  };
  const { data, error } = await supabase()
    .from("vehicle_maintenance_entries")
    .insert(payload)
    .select("*")
    .single();
  if (error) return { error: new Error(error.message), entry: null };
  if (payload.trip_id) {
    await appendTripOperationalTimelineEventSafe({
      organizationId: payload.organization_id,
      tripId: payload.trip_id,
      eventType: "maintenance_logged",
      sourceType: "maintenance",
      sourceId: String(data.id),
      actorUserId: payload.entered_by,
      payload: {
        maintenanceType: payload.maintenance_type,
        amountInr: payload.amount_inr,
      },
    });
  }
  return { error: null, entry: data as VehicleMaintenanceEntry };
}

export async function uploadMaintenanceInvoicePhoto(params: {
  tripId: string;
  userId: string;
  arrayBuffer: ArrayBuffer;
  fileName: string;
}): Promise<{ error: Error | null; storagePath: string | null }> {
  const res = await tripDocumentsService.uploadTripDocument(
    params.tripId,
    params.userId,
    {
      arrayBuffer: params.arrayBuffer,
      fileName: params.fileName,
      mimeType: "image/jpeg",
    },
    "maintenance_invoice_photo",
  );
  if (res.error || !res.doc) return { error: res.error, storagePath: null };
  return { error: null, storagePath: res.doc.storage_path };
}
