import { supabase } from "@pulse/core/lib/supabase";
import type {
  VehicleLedgerApprovalState,
  VehicleLedgerSourceType,
  VehicleOperationLedgerEntry,
} from "../types";

export interface VehicleOperationsLedgerSummary {
  tripCount: number;
  totalDistanceKm: number;
  approvedSpendInr: number;
  monthlyRevenueInr: number;
  operationalCostInr: number;
  ownershipCostInr: number;
  outstandingPayablesInr: number;
  unallocatedOverheadInr: number;
  allocationEfficiencyPct: number;
  netVehicleProfitabilityInr: number;
  approvedFuelSpendInr: number;
  approvedTollSpendInr: number;
  approvedMaintenanceSpendInr: number;
  approvedCostPerKm: number | null;
  approvedEntries: number;
  draftEntries: number;
  verifiedEntries: number;
  ignoredEntries: number;
}

const ALL_SOURCE_TYPES: VehicleLedgerSourceType[] = [
  "fuel",
  "toll",
  "maintenance",
  "repair",
  "service",
  "insurance",
  "permit",
  "manual_adjustment",
];

function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function resolveTripOrganizationVehicle(input: {
  tripId: string;
}): Promise<{
  error: Error | null;
  organizationId: string | null;
  vehicleId: string | null;
}> {
  const { data, error } = await supabase()
    .from("trips")
    .select("organization_id, vehicle_id")
    .eq("id", input.tripId)
    .single();
  if (error || !data) {
    return {
      error: new Error(error?.message ?? "Trip not found for ledger propagation"),
      organizationId: null,
      vehicleId: null,
    };
  }
  return {
    error: null,
    organizationId: String(data.organization_id ?? "") || null,
    vehicleId: String(data.vehicle_id ?? "") || null,
  };
}

export async function createVehicleOperationLedgerDraftFromSource(input: {
  sourceType: VehicleLedgerSourceType;
  sourceId: string;
  tripId?: string | null;
  amount: number;
  entryType?: "expense" | "adjustment";
}): Promise<{ error: Error | null; entry: VehicleOperationLedgerEntry | null }> {
  const tripId = String(input.tripId ?? "").trim();
  if (!tripId) {
    return { error: new Error("Trip id is required for source propagation"), entry: null };
  }
  const tripResolved = await resolveTripOrganizationVehicle({ tripId });
  if (tripResolved.error || !tripResolved.organizationId || !tripResolved.vehicleId) {
    return { error: tripResolved.error ?? new Error("Trip does not have a vehicle"), entry: null };
  }
  const payload = {
    organization_id: tripResolved.organizationId,
    vehicle_id: tripResolved.vehicleId,
    source_type: input.sourceType,
    source_id: input.sourceId,
    trip_id: tripId,
    entry_type: input.entryType ?? "expense",
    amount: Math.max(0, safeNumber(input.amount)),
    approval_state: "draft" as const,
  };
  const { data, error } = await supabase()
    .from("vehicle_operation_ledger_entries")
    .upsert(payload, { onConflict: "source_type,source_id" })
    .select("*")
    .single();
  if (error) return { error: new Error(error.message), entry: null };
  return { error: null, entry: data as VehicleOperationLedgerEntry };
}

const OPERATION_LEDGER_SOURCE_TYPES: VehicleLedgerSourceType[] = [
  "fuel",
  "toll",
  "maintenance",
  "repair",
  "service",
  "insurance",
  "permit",
  "manual_adjustment",
];

export function isVehicleOperationLedgerSourceType(
  value: string,
): value is VehicleLedgerSourceType {
  return OPERATION_LEDGER_SOURCE_TYPES.includes(value as VehicleLedgerSourceType);
}

/** After a row is posted to vehicle_ledger_entries, mirror approval on vehicle_operation_ledger_entries. */
export async function syncVehicleOperationLedgerFromPostedSource(input: {
  sourceType: VehicleLedgerSourceType;
  sourceId: string;
  tripId: string;
  amount: number;
  approvedBy?: string | null;
}): Promise<void> {
  if (!isVehicleOperationLedgerSourceType(input.sourceType)) return;
  await createVehicleOperationLedgerDraftFromSource({
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    tripId: input.tripId,
    amount: input.amount,
    entryType: "expense",
  });
  const { data } = await supabase()
    .from("vehicle_operation_ledger_entries")
    .select("id, approval_state")
    .eq("source_type", input.sourceType)
    .eq("source_id", input.sourceId)
    .maybeSingle();
  const entryId = String((data as { id?: string | null } | null)?.id ?? "").trim();
  if (!entryId) return;
  const currentState = String(
    (data as { approval_state?: string | null } | null)?.approval_state ?? "",
  ).toLowerCase();
  if (currentState === "approved") return;
  await updateVehicleOperationLedgerApprovalState({
    entryId,
    approvalState: "approved",
    approvedBy: input.approvedBy ?? null,
  });
}

export async function updateVehicleOperationLedgerApprovalState(input: {
  entryId: string;
  approvalState: VehicleLedgerApprovalState;
  approvedBy?: string | null;
}): Promise<{ error: Error | null; entry: VehicleOperationLedgerEntry | null }> {
  const payload: {
    approval_state: VehicleLedgerApprovalState;
    approved_by?: string | null;
    approved_at?: string | null;
  } = {
    approval_state: input.approvalState,
  };
  if (input.approvalState === "approved") {
    payload.approved_by = input.approvedBy ?? null;
    payload.approved_at = new Date().toISOString();
  } else {
    payload.approved_by = null;
    payload.approved_at = null;
  }
  const { data, error } = await supabase()
    .from("vehicle_operation_ledger_entries")
    .update(payload)
    .eq("id", input.entryId)
    .select("*")
    .single();
  if (error) return { error: new Error(error.message), entry: null };
  return { error: null, entry: data as VehicleOperationLedgerEntry };
}

export async function syncVehicleOperationLedgerDraftAmountFromSource(input: {
  sourceType: VehicleLedgerSourceType;
  sourceId: string;
  tripId: string;
  amount: number;
}): Promise<{ error: Error | null }> {
  const draft = await createVehicleOperationLedgerDraftFromSource({
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    tripId: input.tripId,
    amount: input.amount,
    entryType: "expense",
  });
  if (draft.error) return { error: draft.error };
  const entryId = String(draft.entry?.id ?? "").trim();
  if (!entryId) return { error: null };
  const amountRes = await updateVehicleOperationLedgerAmount({
    entryId,
    amount: input.amount,
  });
  if (amountRes.error) return { error: amountRes.error };
  await updateVehicleOperationLedgerApprovalState({
    entryId,
    approvalState: "draft",
    approvedBy: null,
  });
  return { error: null };
}

export async function updateVehicleOperationLedgerAmount(input: {
  entryId: string;
  amount: number;
}): Promise<{ error: Error | null; entry: VehicleOperationLedgerEntry | null }> {
  const { data, error } = await supabase()
    .from("vehicle_operation_ledger_entries")
    .update({ amount: Math.max(0, safeNumber(input.amount)) })
    .eq("id", input.entryId)
    .select("*")
    .single();
  if (error) return { error: new Error(error.message), entry: null };
  return { error: null, entry: data as VehicleOperationLedgerEntry };
}

export async function getVehicleOperationLedgerEntries(params: {
  organizationId: string;
  vehicleId: string;
  approvalStates?: VehicleLedgerApprovalState[];
  limit?: number;
}): Promise<{ error: Error | null; entries: VehicleOperationLedgerEntry[] }> {
  const { organizationId, vehicleId, approvalStates, limit = 120 } = params;
  let query = supabase()
    .from("vehicle_operation_ledger_entries")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (approvalStates && approvalStates.length) {
    query = query.in("approval_state", approvalStates);
  }
  const { data, error } = await query;
  if (error) return { error: new Error(error.message), entries: [] };
  return { error: null, entries: (data ?? []) as VehicleOperationLedgerEntry[] };
}

export async function getVehicleOperationsLedger(params: {
  organizationId: string;
  vehicleId: string;
  limit?: number;
}): Promise<{ error: Error | null; summary: VehicleOperationsLedgerSummary | null }> {
  const { organizationId, vehicleId, limit = 30 } = params;
  try {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartIso = monthStart.toISOString();
    const [tripRes, ledgerRes] = await Promise.all([
      supabase()
      .from("trips")
      .select("id, odometer_distance_km, gps_distance_km, distance_source, client_price, created_at")
      .eq("organization_id", organizationId)
      .eq("vehicle_id", vehicleId)
      .order("created_at", { ascending: false })
      .limit(limit),
      getVehicleOperationLedgerEntries({
        organizationId,
        vehicleId,
        limit: Math.max(limit * 4, 120),
      }),
    ]);

    if (tripRes.error) return { error: new Error(tripRes.error.message), summary: null };
    const trips = (tripRes.data ?? []) as Array<{
      id: string;
      odometer_distance_km?: number | null;
      gps_distance_km?: number | null;
      distance_source?: string | null;
      client_price?: number | string | null;
      created_at?: string | null;
    }>;
    const tripIds = trips.map((t) => t.id).filter(Boolean);
    const totalDistanceKm = trips.reduce((sum, t) => {
      const preferred =
        t.distance_source === "gps" ? t.gps_distance_km : t.odometer_distance_km ?? t.gps_distance_km;
      return sum + (Number.isFinite(Number(preferred)) ? Number(preferred) : 0);
    }, 0);

    if (ledgerRes.error) return { error: ledgerRes.error, summary: null };
    const entries = ledgerRes.entries;
    const tripIdsForPayables = tripIds.length > 0 ? tripIds : ["00000000-0000-0000-0000-000000000000"];
    const [fuelPayableRes, tollPayableRes] = await Promise.all([
      supabase()
        .from("trip_fuel_entries")
        .select("amount_inr,approval_state,reimbursement_state,payment_owner,status,posting_state")
        .in("trip_id", tripIdsForPayables),
      supabase()
        .from("trip_toll_entries")
        .select("amount_inr,approval_state,reimbursement_state,payment_owner,status,posting_state")
        .in("trip_id", tripIdsForPayables),
    ]);
    if (fuelPayableRes.error) return { error: new Error(fuelPayableRes.error.message), summary: null };
    if (tollPayableRes.error) return { error: new Error(tollPayableRes.error.message), summary: null };
    const approvedEntries = entries.filter((e) => e.approval_state === "approved");
    const draftEntries = entries.filter((e) => e.approval_state === "draft").length;
    const verifiedEntries = entries.filter((e) => e.approval_state === "verified").length;
    const ignoredEntries = entries.filter((e) => e.approval_state === "ignored").length;
    const spendBySource = ALL_SOURCE_TYPES.reduce<Record<VehicleLedgerSourceType, number>>(
      (acc, source) => {
        acc[source] = approvedEntries
          .filter((e) => e.source_type === source)
          .reduce((sum, e) => sum + safeNumber(e.amount), 0);
        return acc;
      },
      {
        fuel: 0,
        toll: 0,
        maintenance: 0,
        repair: 0,
        service: 0,
        insurance: 0,
        permit: 0,
        manual_adjustment: 0,
      },
    );
    const approvedSpendInr = approvedEntries.reduce(
      (sum, e) => sum + safeNumber(e.amount),
      0,
    );
    const approvedMaintenanceSpendInr =
      spendBySource.maintenance +
      spendBySource.repair +
      spendBySource.service +
      spendBySource.insurance +
      spendBySource.permit;
    const operationalCostInr = spendBySource.fuel + spendBySource.toll;
    const ownershipCostInr = approvedMaintenanceSpendInr + spendBySource.manual_adjustment;
    const ownershipApprovedEntries = approvedEntries.filter((entry) =>
      ["maintenance", "repair", "service", "insurance", "permit", "manual_adjustment"].includes(
        entry.source_type,
      ),
    );
    const ownershipAllocatedInr = ownershipApprovedEntries
      .filter((entry) => !!entry.trip_id)
      .reduce((sum, entry) => sum + safeNumber(entry.amount), 0);
    const unallocatedOverheadInr = Math.max(0, ownershipCostInr - ownershipAllocatedInr);
    const allocationEfficiencyPct =
      ownershipCostInr > 0 ? Number(((ownershipAllocatedInr / ownershipCostInr) * 100).toFixed(2)) : 0;

    const monthlyRevenueInr = trips
      .filter((trip) => {
        const createdAt = String(trip.created_at ?? "").trim();
        return createdAt.length > 0 && createdAt >= monthStartIso;
      })
      .reduce((sum, trip) => sum + safeNumber(trip.client_price), 0);
    const payableRows = [...(fuelPayableRes.data ?? []), ...(tollPayableRes.data ?? [])] as Array<{
      amount_inr?: number | string | null;
      approval_state?: string | null;
      reimbursement_state?: string | null;
      payment_owner?: string | null;
      status?: string | null;
      posting_state?: string | null;
    }>;
    const outstandingPayablesInr = payableRows
      .filter((row) => {
        const paymentOwner = String(row.payment_owner ?? "").toLowerCase();
        const approval = String(row.approval_state ?? "").toLowerCase();
        const reimbursement = String(row.reimbursement_state ?? "").toLowerCase();
        const status = String(row.status ?? "").toLowerCase();
        const posting = String(row.posting_state ?? "").toLowerCase();
        if (status === "void" || status === "voided") return false;
        if (paymentOwner !== "driver") return false;
        if (approval !== "approved" && approval !== "settled") return false;
        if (posting !== "posted") return false;
        return reimbursement !== "reimbursed";
      })
      .reduce((sum, row) => sum + safeNumber(row.amount_inr), 0);
    const netVehicleProfitabilityInr = Number(
      (monthlyRevenueInr - operationalCostInr - ownershipCostInr - outstandingPayablesInr).toFixed(2),
    );
    const approvedCostPerKm =
      totalDistanceKm > 0 ? Number((approvedSpendInr / totalDistanceKm).toFixed(2)) : null;
    return {
      error: null,
      summary: {
        tripCount: tripIds.length,
        totalDistanceKm,
        approvedSpendInr,
        monthlyRevenueInr,
        operationalCostInr,
        ownershipCostInr,
        outstandingPayablesInr,
        unallocatedOverheadInr,
        allocationEfficiencyPct,
        netVehicleProfitabilityInr,
        approvedFuelSpendInr: spendBySource.fuel,
        approvedTollSpendInr: spendBySource.toll,
        approvedMaintenanceSpendInr,
        approvedCostPerKm,
        approvedEntries: approvedEntries.length,
        draftEntries,
        verifiedEntries,
        ignoredEntries,
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error("Failed to load vehicle ledger"),
      summary: null,
    };
  }
}
