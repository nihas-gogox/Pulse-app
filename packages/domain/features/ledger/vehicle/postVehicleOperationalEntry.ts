import { getTripOperationalCapabilities } from "../../trips/capabilities";
import { getTripById } from "../../trips/services/trips.service";
import { supabase } from "@pulse/core/lib/supabase";

export type VehiclePostingSourceType =
  | "fuel"
  | "toll"
  | "maintenance"
  | "service"
  | "tire"
  | "battery"
  | "permit"
  | "insurance"
  | "repair"
  | "manual_adjustment";

function isVehiclePostingEnabled(): boolean {
  return String(process.env.EXPO_PUBLIC_ENABLE_VEHICLE_LEDGER_POSTING ?? "false").toLowerCase() === "true";
}

export async function postVehicleOperationalEntry(input: {
  orgId: string;
  tripId: string;
  vehicleId: string;
  sourceType: VehiclePostingSourceType;
  sourceId: string;
  amount: number;
  approvedBy?: string | null;
  approvalState: "approved" | "rejected" | "reported" | "review_pending" | "settled";
  metadata?: Record<string, unknown>;
}) {
  if (!isVehiclePostingEnabled()) {
    return { error: null, posted: false, reason: "posting_disabled" as const };
  }
  if (input.approvalState !== "approved") {
    return { error: null, posted: false, reason: "approval_pending" as const };
  }
  const tripRes = await getTripById(input.tripId);
  if (tripRes.error || !tripRes.trip) {
    return { error: tripRes.error ?? new Error("Trip missing for posting"), posted: false, reason: "trip_missing" as const };
  }
  const capabilities = getTripOperationalCapabilities(tripRes.trip);
  if (!capabilities.isAssetTrip || capabilities.accountingMode !== "vehicle_economics") {
    return { error: null, posted: false, reason: "aggregation_or_non_owned" as const };
  }
  if (!tripRes.trip.vehicle_id || tripRes.trip.vehicle_id !== input.vehicleId) {
    return { error: null, posted: false, reason: "vehicle_missing" as const };
  }
  if (tripRes.trip.organization_id !== input.orgId) {
    return { error: null, posted: false, reason: "org_mismatch" as const };
  }

  const existing = await supabase()
    .from("vehicle_ledger_entries")
    .select("id")
    .eq("source_type", input.sourceType)
    .eq("source_id", input.sourceId)
    .maybeSingle();
  if (existing.error) {
    return { error: new Error(existing.error.message), posted: false, reason: "lookup_failed" as const };
  }
  if (existing.data?.id) {
    return { error: null, posted: false, reason: "already_posted" as const };
  }

  const payload = {
    organization_id: input.orgId,
    vehicle_id: input.vehicleId,
    trip_id: input.tripId,
    source_type: input.sourceType,
    source_id: input.sourceId,
    entry_type: "vehicle_operational_expense",
    debit: Math.max(0, Number(input.amount) || 0),
    credit: 0,
    amount: Math.max(0, Number(input.amount) || 0),
    approved_by: input.approvedBy ?? null,
    posted_at: new Date().toISOString(),
    metadata: input.metadata ?? {},
  };
  const inserted = await supabase().from("vehicle_ledger_entries").insert(payload).select("id").single();
  if (inserted.error) {
    return { error: new Error(inserted.error.message), posted: false, reason: "insert_failed" as const };
  }
  return { error: null, posted: true, reason: "posted" as const, postingId: inserted.data.id as string };
}
