import {
  getTripOperationalDisplay,
} from "../../operations/display";
import type {
  TripFuelEntry,
  TripOtherExpenseEntry,
  TripTollEntry,
} from "../../trips/operations/types";
import { otherExpenseCategoryToCostCategory } from "../../trips/operations/shared/tripOtherExpenseCategories";
import type {
  TripCostActor,
  TripCostApprovalState,
  TripCostEvent,
  TripCostFinancialSnapshot,
  TripCostPostingState,
  TripCostSettlementState,
  TripCostSource,
} from "../domain/tripCostEvent";

type LedgerLookup = {
  fuel: Record<string, string>;
  toll: Record<string, string>;
  other: Record<string, string>;
};

function normalizeActor(owner: string | null | undefined): TripCostActor {
  const normalized = String(owner ?? "").toLowerCase();
  if (normalized === "driver") return "driver";
  if (normalized === "supplier" || normalized === "vendor" || normalized === "credit_vendor") {
    return "vendor";
  }
  return "organization";
}

type OperationalExpenseRow = {
  payment_owner?: string | null;
  approval_state?: string | null;
  reimbursement_state?: string | null;
};

/** Driver reimbursement requests use approval/reimbursement state `reported`. */
function resolveExpensePayer(row: OperationalExpenseRow): TripCostActor {
  const owner = normalizeActor(row.payment_owner);
  if (owner === "driver") return "driver";
  const approval = String(row.approval_state ?? "").toLowerCase();
  const reimbursement = String(row.reimbursement_state ?? "").toLowerCase();
  if (approval === "reported" && reimbursement === "reported") return "driver";
  return owner;
}

function toApprovalState(value: string | null | undefined): TripCostApprovalState {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "approved" || normalized === "settled") return "approved";
  if (normalized === "rejected") return "rejected";
  return "pending";
}

function toPostingState(input: {
  approvalState: TripCostApprovalState;
  ledgerState: string | null | undefined;
  postingState: string | null | undefined;
  hasLedger: boolean;
}): TripCostPostingState {
  const ledger = String(input.ledgerState ?? "").toLowerCase();
  const posting = String(input.postingState ?? "").toLowerCase();
  if (ledger === "void" || input.approvalState === "rejected") return "reversed";
  if (input.hasLedger || ledger === "posted" || posting === "posted") return "posted";
  if (posting === "failed") return "failed";
  return "unposted";
}

function toSettlementState(input: {
  reimbursementState: string | null | undefined;
  approvalState: TripCostApprovalState;
}): TripCostSettlementState {
  const reimbursement = String(input.reimbursementState ?? "").toLowerCase();
  if (reimbursement === "reimbursed") return "settled";
  if (reimbursement === "reimbursement_pending" || reimbursement === "approved") return "partial";
  if (input.approvalState === "approved" && reimbursement === "reported") return "partial";
  return "unpaid";
}

function toSource(value: string | null | undefined): TripCostSource {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "driver" || normalized === "driver_upload") return "driver_upload";
  if (normalized === "system" || normalized === "reconciliation") return "system";
  if (normalized === "integration") return "integration";
  return "ops_entry";
}

function normalizeAmount(value: number | null | undefined): number {
  return Math.round(Math.max(0, Number(value ?? 0) || 0) * 100) / 100;
}

export function mapFuelEntryToTripCostEvent(input: {
  row: TripFuelEntry;
  tripOperationalCode: string;
  ledgerTransactionId?: string | null;
}): TripCostEvent {
  const approvalState = toApprovalState(input.row.approval_state);
  const payer = resolveExpensePayer(input.row);
  const postingState = toPostingState({
    approvalState,
    ledgerState: input.row.ledger_state,
    postingState: input.row.posting_state ?? null,
    hasLedger: !!input.ledgerTransactionId,
  });
  const settlementState = toSettlementState({
    reimbursementState: input.row.reimbursement_state ?? null,
    approvalState,
  });
  return {
    id: `fuel:${input.row.id}`,
    tripId: input.row.trip_id,
    operationalCode: input.tripOperationalCode,
    category: "fuel",
    amount: normalizeAmount(input.row.amount_inr),
    currency: "INR",
    incurredBy: payer,
    payer,
    reimbursable: payer === "driver",
    approvalState,
    postingState,
    settlementState,
    approvedAt: input.row.approved_at ?? undefined,
    approvedBy: input.row.approved_by ?? undefined,
    reimbursedAt: input.row.reimbursed_at ?? undefined,
    ledgerTransactionId: input.ledgerTransactionId ?? undefined,
    pnlImpact: approvalState === "approved",
    source: toSource(input.row.source),
    createdAt: input.row.entered_at,
    updatedAt: input.row.updated_at,
  };
}

export function mapTollEntryToTripCostEvent(input: {
  row: TripTollEntry;
  tripOperationalCode: string;
  ledgerTransactionId?: string | null;
}): TripCostEvent {
  const approvalState = toApprovalState(input.row.approval_state);
  const payer = resolveExpensePayer(input.row);
  const postingState = toPostingState({
    approvalState,
    ledgerState: input.row.ledger_state,
    postingState: input.row.posting_state ?? null,
    hasLedger: !!input.ledgerTransactionId,
  });
  const settlementState = toSettlementState({
    reimbursementState: input.row.reimbursement_state ?? null,
    approvalState,
  });
  return {
    id: `toll:${input.row.id}`,
    tripId: input.row.trip_id,
    operationalCode: input.tripOperationalCode,
    category: "toll",
    amount: normalizeAmount(input.row.amount_inr),
    currency: "INR",
    incurredBy: payer,
    payer,
    reimbursable: payer === "driver",
    approvalState,
    postingState,
    settlementState,
    approvedAt: input.row.approved_at ?? undefined,
    approvedBy: input.row.approved_by ?? undefined,
    reimbursedAt: input.row.reimbursed_at ?? undefined,
    ledgerTransactionId: input.ledgerTransactionId ?? undefined,
    pnlImpact: approvalState === "approved",
    source: toSource(input.row.source),
    createdAt: input.row.entered_at,
    updatedAt: input.row.updated_at,
  };
}

export function mapOtherEntryToTripCostEvent(input: {
  row: TripOtherExpenseEntry;
  tripOperationalCode: string;
  ledgerTransactionId?: string | null;
}): TripCostEvent {
  const approvalState = toApprovalState(input.row.approval_state);
  const payer = resolveExpensePayer(input.row);
  const postingState = toPostingState({
    approvalState,
    ledgerState: input.row.ledger_state,
    postingState: input.row.posting_state ?? null,
    hasLedger: !!input.ledgerTransactionId,
  });
  const settlementState = toSettlementState({
    reimbursementState: input.row.reimbursement_state ?? null,
    approvalState,
  });
  return {
    id: `other:${input.row.id}`,
    tripId: input.row.trip_id,
    operationalCode: input.tripOperationalCode,
    category: otherExpenseCategoryToCostCategory(input.row.expense_category),
    amount: normalizeAmount(input.row.amount_inr),
    currency: "INR",
    incurredBy: payer,
    payer,
    reimbursable: payer === "driver",
    approvalState,
    postingState,
    settlementState,
    approvedAt: input.row.approved_at ?? undefined,
    approvedBy: input.row.approved_by ?? undefined,
    reimbursedAt: input.row.reimbursed_at ?? undefined,
    ledgerTransactionId: input.ledgerTransactionId ?? undefined,
    pnlImpact: approvalState === "approved",
    source: toSource(input.row.source),
    createdAt: input.row.entered_at,
    updatedAt: input.row.updated_at,
  };
}

export function mapTripOperationalRowsToCostEvents(input: {
  fuelEntries: TripFuelEntry[];
  tollEntries: TripTollEntry[];
  otherEntries?: TripOtherExpenseEntry[];
  tripDisplay: {
    trip_operational_code?: string | null;
    trip_code?: string | null;
    display_trip_id?: string | null;
    trip_number?: string | null;
  };
  ledgerBySource?: Partial<LedgerLookup>;
}): TripCostEvent[] {
  const tripOperationalCode = getTripOperationalDisplay(input.tripDisplay);
  const fuelLedger = input.ledgerBySource?.fuel ?? {};
  const tollLedger = input.ledgerBySource?.toll ?? {};
  const otherLedger = input.ledgerBySource?.other ?? {};
  const fuel = input.fuelEntries.map((row) =>
    mapFuelEntryToTripCostEvent({
      row,
      tripOperationalCode,
      ledgerTransactionId: fuelLedger[row.id] ?? null,
    }),
  );
  const toll = input.tollEntries.map((row) =>
    mapTollEntryToTripCostEvent({
      row,
      tripOperationalCode,
      ledgerTransactionId: tollLedger[row.id] ?? null,
    }),
  );
  const other = (input.otherEntries ?? []).map((row) =>
    mapOtherEntryToTripCostEvent({
      row,
      tripOperationalCode,
      ledgerTransactionId: otherLedger[row.id] ?? null,
    }),
  );
  return [...fuel, ...toll, ...other].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );
}

export function deriveTripCostFinancialSnapshot(input: {
  events: TripCostEvent[];
  distanceKm?: number | null;
}): TripCostFinancialSnapshot {
  let approvalPendingCount = 0;
  let approvedAwaitingPostingCount = 0;
  let postedCount = 0;
  let settlementPendingCount = 0;
  let settledCount = 0;
  let payableOutstandingInr = 0;
  let postedOperationalCostInr = 0;
  let approvedOperationalCostInr = 0;

  for (const event of input.events) {
    if (event.approvalState === "pending") approvalPendingCount += 1;
    if (event.approvalState === "approved") {
      approvedOperationalCostInr += event.amount;
      if (event.postingState !== "posted") approvedAwaitingPostingCount += 1;
    }
    if (event.postingState === "posted") {
      postedCount += 1;
      postedOperationalCostInr += event.amount;
    }
    if (event.settlementState === "settled") settledCount += 1;
    if (event.settlementState !== "settled" && event.reimbursable && event.approvalState === "approved") {
      settlementPendingCount += 1;
      payableOutstandingInr += event.amount;
    }
  }

  const distance = Math.max(0, Number(input.distanceKm ?? 0) || 0);
  const costPerKm = distance > 0 ? Math.round((postedOperationalCostInr / distance) * 100) / 100 : null;
  return {
    totalEvents: input.events.length,
    approvalPendingCount,
    approvedAwaitingPostingCount,
    postedCount,
    settlementPendingCount,
    settledCount,
    payableOutstandingInr: Math.round(payableOutstandingInr * 100) / 100,
    postedOperationalCostInr: Math.round(postedOperationalCostInr * 100) / 100,
    approvedOperationalCostInr: Math.round(approvedOperationalCostInr * 100) / 100,
    costPerKm,
  };
}
