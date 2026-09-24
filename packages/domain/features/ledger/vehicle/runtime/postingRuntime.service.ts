import { getTripOperationalCapabilities } from "../../../trips/capabilities";
import { getTripById } from "../../../trips/services/trips.service";
import {
  isVehicleOperationLedgerSourceType,
  syncVehicleOperationLedgerFromPostedSource,
} from "../../../trips/operations/vehicle/vehicleOperationsLedger.service";
import { supabase } from "@pulse/core/lib/supabase";
import type { VehiclePostingSourceType } from "../postVehicleOperationalEntry";
import { syncOperationalExpenseToCashLedger } from "../syncOperationalExpenseToCashLedger.service";

type PostingState = "pending" | "approved" | "posted" | "rejected" | "failed";

function isVehiclePostingEnabled(): boolean {
  return String(process.env.EXPO_PUBLIC_ENABLE_VEHICLE_LEDGER_POSTING ?? "false").toLowerCase() === "true";
}

type OperationalSourceTable = "fuel" | "toll" | "other";

async function updateSourcePostingState(input: {
  sourceType: OperationalSourceTable;
  sourceId: string;
  state: PostingState;
  errorMessage?: string | null;
  incrementRetry?: boolean;
}) {
  const table =
    input.sourceType === "fuel"
      ? "trip_fuel_entries"
      : input.sourceType === "toll"
        ? "trip_toll_entries"
        : "trip_other_expenses";
  const patch: Record<string, unknown> = {
    posting_state: input.state,
    posting_error: input.errorMessage ?? null,
  };
  if (input.incrementRetry) {
    const rowRes = await supabase()
      .from(table)
      .select("retry_count")
      .eq("id", input.sourceId)
      .single();
    const retryCount = Number((rowRes.data as { retry_count?: number } | null)?.retry_count ?? 0);
    patch.retry_count = Number.isFinite(retryCount) ? retryCount + 1 : 1;
    patch.last_retry_at = new Date().toISOString();
  }
  await supabase().from(table).update(patch).eq("id", input.sourceId);
}

export async function executeVehiclePostingRuntime(input: {
  orgId: string;
  tripId: string;
  vehicleId: string;
  sourceType: VehiclePostingSourceType;
  sourceId: string;
  amount: number;
  approvedBy?: string | null;
  approvalState: "approved" | "rejected" | "reported" | "review_pending" | "settled";
  paymentOwner?: string | null;
  metadata?: Record<string, unknown>;
  /** When true, post on explicit approve even if EXPO_PUBLIC_ENABLE_VEHICLE_LEDGER_POSTING is off. */
  forcePost?: boolean;
}) {
  const sourceTableType: OperationalSourceTable | null =
    input.sourceType === "fuel" || input.sourceType === "toll"
      ? input.sourceType
      : input.sourceType === "manual_adjustment"
        ? "other"
        : null;
  if (!isVehiclePostingEnabled() && !input.forcePost) {
    if (sourceTableType) {
      await updateSourcePostingState({
        sourceType: sourceTableType,
        sourceId: input.sourceId,
        state: "pending",
      });
    }
    return { error: null, posted: false, reason: "posting_disabled" as const };
  }
  if (input.approvalState !== "approved") {
    if (sourceTableType) {
      await updateSourcePostingState({
        sourceType: sourceTableType,
        sourceId: input.sourceId,
        state: input.approvalState === "rejected" ? "rejected" : "pending",
      });
    }
    return { error: null, posted: false, reason: "approval_pending" as const };
  }
  if (String(input.paymentOwner ?? "").toLowerCase() === "unknown") {
    if (sourceTableType) {
      await updateSourcePostingState({
        sourceType: sourceTableType,
        sourceId: input.sourceId,
        state: "pending",
      });
    }
    return { error: null, posted: false, reason: "payment_owner_unknown" as const };
  }

  const tripRes = await getTripById(input.tripId);
  if (tripRes.error || !tripRes.trip) {
    if (sourceTableType) {
      await updateSourcePostingState({
        sourceType: sourceTableType,
        sourceId: input.sourceId,
        state: "failed",
        errorMessage: tripRes.error?.message ?? "Trip missing",
        incrementRetry: true,
      });
    }
    return { error: tripRes.error ?? new Error("Trip missing for posting"), posted: false, reason: "trip_missing" as const };
  }
  if (!String(input.vehicleId ?? "").trim()) {
    if (sourceTableType) {
      await updateSourcePostingState({
        sourceType: sourceTableType,
        sourceId: input.sourceId,
        state: "failed",
        errorMessage: "Trip has no vehicle assigned",
        incrementRetry: true,
      });
    }
    return { error: null, posted: false, reason: "vehicle_missing" as const };
  }
  const capabilities = getTripOperationalCapabilities(tripRes.trip);
  if (!capabilities.isAssetTrip || capabilities.accountingMode !== "vehicle_economics") {
    if (sourceTableType) {
      await updateSourcePostingState({
        sourceType: sourceTableType,
        sourceId: input.sourceId,
        state: "approved",
      });
    }
    return { error: null, posted: false, reason: "aggregation_or_non_owned" as const };
  }

  const existing = await supabase()
    .from("vehicle_ledger_entries")
    .select("id")
    .eq("source_type", input.sourceType)
    .eq("source_id", input.sourceId)
    .maybeSingle();
  if (existing.error) {
    if (sourceTableType) {
      await updateSourcePostingState({
        sourceType: sourceTableType,
        sourceId: input.sourceId,
        state: "failed",
        errorMessage: existing.error.message,
        incrementRetry: true,
      });
    }
    return { error: new Error(existing.error.message), posted: false, reason: "lookup_failed" as const };
  }
  if (existing.data?.id) {
    if (sourceTableType) {
      await updateSourcePostingState({
        sourceType: sourceTableType,
        sourceId: input.sourceId,
        state: "posted",
      });
    }
    if (isVehicleOperationLedgerSourceType(input.sourceType)) {
      await syncVehicleOperationLedgerFromPostedSource({
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        tripId: input.tripId,
        amount: input.amount,
        approvedBy: input.approvedBy,
      });
    }
    await syncOperationalExpenseToCashLedger({
      orgId: input.orgId,
      tripId: input.tripId,
      vehicleId: input.vehicleId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      amount: input.amount,
      paymentOwner: input.paymentOwner,
      paymentMode: (input.metadata?.payment_mode as string | undefined) ?? null,
      metadata: input.metadata,
      approvedBy: input.approvedBy,
    });
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
    metadata: {
      ...(input.metadata ?? {}),
      settlement_scope:
        String(input.paymentOwner ?? "").toLowerCase() === "driver"
          ? "driver_payable"
          : String(input.paymentOwner ?? "").toLowerCase() === "supplier"
            ? "vendor_payable"
            : "organization_expense",
    },
  };
  const inserted = await supabase().from("vehicle_ledger_entries").insert(payload).select("id").single();
  if (inserted.error) {
    if (sourceTableType) {
      await updateSourcePostingState({
        sourceType: sourceTableType,
        sourceId: input.sourceId,
        state: "failed",
        errorMessage: inserted.error.message,
        incrementRetry: true,
      });
    }
    return { error: new Error(inserted.error.message), posted: false, reason: "insert_failed" as const };
  }
  if (sourceTableType) {
    await updateSourcePostingState({
      sourceType: sourceTableType,
      sourceId: input.sourceId,
      state: "posted",
    });
  }
  if (isVehicleOperationLedgerSourceType(input.sourceType)) {
    await syncVehicleOperationLedgerFromPostedSource({
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      tripId: input.tripId,
      amount: input.amount,
      approvedBy: input.approvedBy,
    });
  }
  const cashSync = await syncOperationalExpenseToCashLedger({
    orgId: input.orgId,
    tripId: input.tripId,
    vehicleId: input.vehicleId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    amount: input.amount,
    paymentOwner: input.paymentOwner,
    paymentMode: (input.metadata?.payment_mode as string | undefined) ?? null,
    metadata: input.metadata,
    transactionDate: new Date().toISOString().slice(0, 10),
    approvedBy: input.approvedBy,
  });
  if (cashSync.error) {
    return { error: cashSync.error, posted: true, reason: "posted" as const, postingId: inserted.data.id as string };
  }
  return { error: null, posted: true, reason: "posted" as const, postingId: inserted.data.id as string };
}
