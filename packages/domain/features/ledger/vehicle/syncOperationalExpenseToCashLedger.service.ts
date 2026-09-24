import { createLedgerEntry } from "../../finance/services/finance.service";
import { VEHICLE_EXPENSE_TYPES } from "../../finance/accounting/accountingModel";
import { formatOtherExpenseCategoryLabel } from "../../trips/operations/shared/tripOtherExpenseCategories";
import { getTripById } from "../../trips/services/trips.service";
import { getVehicleById } from "../../vehicles/services/vehicles.service";
import { formatIndianVehicleNumber } from "@pulse/core/lib/format";
import { supabase } from "@pulse/core/lib/supabase";
import type { VehiclePostingSourceType } from "./postVehicleOperationalEntry";

const VOPS_MARKER_PREFIX = "[[VOPS:";
const VOPS_MARKER_SUFFIX = "]]";

export function buildOperationalExpenseLedgerMarker(
  sourceType: string,
  sourceId: string,
): string {
  return `${VOPS_MARKER_PREFIX}${sourceType}:${sourceId}${VOPS_MARKER_SUFFIX}`;
}

function mapSourceToLedgerCategory(input: {
  sourceType: VehiclePostingSourceType;
  metadata?: Record<string, unknown>;
}): { partyName: string; category: string } {
  if (input.sourceType === "fuel") {
    return { partyName: "Fuel", category: "FUEL" };
  }
  if (input.sourceType === "toll") {
    return { partyName: "Toll", category: "TOLL" };
  }
  if (input.sourceType === "maintenance" || input.sourceType === "repair" || input.sourceType === "service") {
    return { partyName: "Maintenance", category: "MAINTENANCE" };
  }
  if (input.sourceType === "manual_adjustment") {
    const rawCategory = String(input.metadata?.expense_category ?? "misc").toLowerCase();
    const label = formatOtherExpenseCategoryLabel(rawCategory);
    switch (rawCategory) {
      case "maintenance":
        return { partyName: label, category: "MAINTENANCE" };
      case "fastag":
        return { partyName: label, category: "TOLL" };
      case "challan":
        return { partyName: label, category: "OTHER" };
      default:
        return { partyName: label, category: "OTHER" };
    }
  }
  const fallback = input.sourceType.toUpperCase().replaceAll("_", " ");
  const category = VEHICLE_EXPENSE_TYPES.includes(
    fallback as (typeof VEHICLE_EXPENSE_TYPES)[number],
  )
    ? fallback
    : "OTHER";
  return { partyName: fallback, category };
}

function normalizePaymentMode(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized || normalized === "unknown" || normalized === "pending") return null;
  if (normalized === "cash") return "Cash";
  if (normalized === "fastag") return "FASTag";
  if (normalized === "card") return "Card";
  if (normalized === "credit") return "Credit";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

async function findExistingOperationalCashLedgerRow(input: {
  orgId: string;
  tripId: string;
  marker: string;
}): Promise<boolean> {
  const { data, error } = await supabase()
    .from("transactions")
    .select("id")
    .eq("organization_id", input.orgId)
    .eq("trip_id", input.tripId)
    .ilike("description", `%${input.marker}%`)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}

export async function syncOperationalExpenseToCashLedger(input: {
  orgId: string;
  tripId: string;
  vehicleId: string;
  sourceType: VehiclePostingSourceType;
  sourceId: string;
  amount: number;
  paymentOwner?: string | null;
  paymentMode?: string | null;
  metadata?: Record<string, unknown>;
  transactionDate?: string | null;
  approvedBy?: string | null;
}): Promise<{ error: Error | null; created: boolean; skipped: boolean }> {
  const amountOut = Math.max(0, Number(input.amount) || 0);
  if (amountOut <= 0) {
    return { error: null, created: false, skipped: true };
  }

  const marker = buildOperationalExpenseLedgerMarker(input.sourceType, input.sourceId);
  const alreadyExists = await findExistingOperationalCashLedgerRow({
    orgId: input.orgId,
    tripId: input.tripId,
    marker,
  });
  if (alreadyExists) {
    return { error: null, created: false, skipped: true };
  }

  const [tripRes, vehicleRes] = await Promise.all([
    getTripById(input.tripId),
    getVehicleById(input.orgId, input.vehicleId),
  ]);
  if (tripRes.error || !tripRes.trip) {
    return {
      error: tripRes.error ?? new Error("Trip not found for cash ledger sync"),
      created: false,
      skipped: false,
    };
  }

  const { partyName, category } = mapSourceToLedgerCategory({
    sourceType: input.sourceType,
    metadata: input.metadata,
  });
  const vehicleNumber =
    formatIndianVehicleNumber(vehicleRes.vehicle?.vehicle_number ?? "") ||
    String(tripRes.trip.vehicle_display_number ?? "").trim() ||
    null;
  const paymentMode = normalizePaymentMode(
    input.paymentMode ?? (input.metadata?.payment_mode as string | undefined) ?? null,
  );
  const owner = String(input.paymentOwner ?? input.metadata?.payment_owner ?? "").toLowerCase();
  const ownerNote =
    owner === "driver"
      ? " · Driver paid"
      : owner === "supplier"
        ? " · Supplier paid"
        : "";

  const baseDescription = `${category}${ownerNote} ${marker}`.trim();
  const transactionDate =
    String(input.transactionDate ?? "").slice(0, 10) ||
    String(tripRes.trip.pickup_date ?? "").slice(0, 10) ||
    new Date().toISOString().slice(0, 10);

  const ledgerPayload = {
    trip_id: input.tripId,
    trip_number: tripRes.trip.trip_number ?? tripRes.trip.display_trip_id ?? null,
    party_name: partyName,
    description: paymentMode ? `${baseDescription} · ${paymentMode}` : baseDescription,
    amount_in: 0,
    amount_out: amountOut,
    transaction_date: transactionDate,
    contact_id: null,
    contact_type: null,
    vehicle_number: vehicleNumber,
    ledger_entity_type: "vehicle",
    ledger_flow_type: "expense",
    ledger_category: category,
    ledgerWritePassthroughTripContext: true,
  } as const;

  let save = await createLedgerEntry(input.orgId, ledgerPayload);
  if (save.error) {
    save = await createLedgerEntry(input.orgId, {
      ...ledgerPayload,
      trip_id: null,
      ledgerWritePassthroughTripContext: false,
    });
  }

  if (save.error) {
    console.warn("[vehicle-cash-ledger] sync failed", {
      tripId: input.tripId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      message: save.error.message,
    });
    return { error: save.error, created: false, skipped: false };
  }
  return { error: null, created: true, skipped: false };
}

export async function backfillVehicleOperationalCashLedger(input: {
  organizationId: string;
  vehicleId: string;
  tripIds: string[];
}): Promise<{ created: number; failed: number }> {
  if (!input.tripIds.length) return { created: 0, failed: 0 };
  const { data, error } = await supabase()
    .from("vehicle_ledger_entries")
    .select("trip_id,source_type,source_id,amount,posted_at,metadata")
    .eq("organization_id", input.organizationId)
    .eq("vehicle_id", input.vehicleId)
    .in("trip_id", input.tripIds);
  if (error || !data?.length) return { created: 0, failed: 0 };

  let created = 0;
  let failed = 0;
  for (const row of data) {
    const tripId = String((row as { trip_id?: string | null }).trip_id ?? "").trim();
    const sourceType = String((row as { source_type?: string | null }).source_type ?? "").trim();
    const sourceId = String((row as { source_id?: string | null }).source_id ?? "").trim();
    if (!tripId || !sourceId) continue;
    const result = await syncOperationalExpenseToCashLedger({
      orgId: input.organizationId,
      tripId,
      vehicleId: input.vehicleId,
      sourceType: sourceType as VehiclePostingSourceType,
      sourceId,
      amount: Number((row as { amount?: number | null }).amount ?? 0) || 0,
      metadata: ((row as { metadata?: Record<string, unknown> }).metadata ?? {}) as Record<
        string,
        unknown
      >,
      transactionDate: String((row as { posted_at?: string | null }).posted_at ?? "").slice(0, 10),
    });
    if (result.error) failed += 1;
    else if (result.created) created += 1;
  }
  return { created, failed };
}
