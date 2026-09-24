import { getTripById } from "../../trips/services/trips.service";
import { getTripFuelEntries, updateTripFuelApprovalState } from "../../trips/operations/fuel/fuel.service";
import { getTripTollEntries, updateTripTollApprovalState } from "../../trips/operations/toll/toll.service";
import {
  getTripOtherExpenses,
  updateTripOtherExpenseApprovalState,
} from "../../trips/operations/other/otherExpense.service";
import { appendTripOperationalTimelineEventSafe } from "../../trips/operations/timeline/timelineEvents.service";
import { toFuelPostingCandidate } from "./postingSelectors";
import { decideFuelPostingRule } from "./vehiclePostingRules";
import { executeVehiclePostingRuntime } from "./runtime";

export async function evaluateAndPostFuelEntry(params: {
  tripId: string;
  fuelEntryId: string;
  approvedBy: string | null;
}) {
  const [tripRes, fuelRes] = await Promise.all([
    getTripById(params.tripId),
    getTripFuelEntries(params.tripId),
  ]);
  if (tripRes.error || !tripRes.trip) {
    return { error: tripRes.error ?? new Error("Trip not found"), posted: false, reason: "trip_missing" as const };
  }
  if (fuelRes.error) {
    return { error: fuelRes.error, posted: false, reason: "fuel_missing" as const };
  }
  const fuelEntry = fuelRes.entries.find((e) => e.id === params.fuelEntryId);
  if (!fuelEntry) {
    return { error: new Error("Fuel entry not found"), posted: false, reason: "fuel_missing" as const };
  }
  const candidate = toFuelPostingCandidate(fuelEntry);
  const decision = decideFuelPostingRule({ trip: tripRes.trip, candidate });
  if (decision === "post_vehicle_expense") {
    const post = await executeVehiclePostingRuntime({
      orgId: tripRes.trip.organization_id,
      tripId: tripRes.trip.id,
      vehicleId: tripRes.trip.vehicle_id ?? "",
      sourceType: "fuel",
      sourceId: fuelEntry.id,
      amount: Math.max(0, Number(fuelEntry.amount_inr) || 0),
      approvedBy: params.approvedBy ?? null,
      approvalState: "approved",
      metadata: {
        payment_owner: fuelEntry.payment_owner,
        payment_mode: fuelEntry.payment_mode,
      },
      paymentOwner: fuelEntry.payment_owner,
      forcePost: true,
    });
    if (post.error) return { error: post.error, posted: false, reason: "post_failed" as const };
    const nextLedgerState =
      post.reason === "posted" || post.reason === "already_posted" ? "posted" : "not_posted";
    await updateTripFuelApprovalState({
      entryId: fuelEntry.id,
      approvalState: "approved",
      approvedBy: params.approvedBy,
      ledgerState: nextLedgerState,
    });
    await appendTripOperationalTimelineEventSafe({
      organizationId: tripRes.trip.organization_id,
      tripId: tripRes.trip.id,
      eventType:
        post.reason === "posted" || post.reason === "already_posted"
          ? "posting_completed"
          : "posting_failed",
      sourceType: "fuel",
      sourceId: fuelEntry.id,
      actorUserId: params.approvedBy,
      payload: {
        reason: post.reason,
      },
    });
    return { error: null, posted: post.reason === "posted", reason: post.reason };
  }
  if (decision === "create_driver_reimbursement") {
    await updateTripFuelApprovalState({
      entryId: fuelEntry.id,
      approvalState: "approved",
      approvedBy: params.approvedBy,
      ledgerState: "not_posted",
    });
    await appendTripOperationalTimelineEventSafe({
      organizationId: tripRes.trip.organization_id,
      tripId: tripRes.trip.id,
      eventType: "reimbursement_flagged",
      sourceType: "fuel",
      sourceId: fuelEntry.id,
      actorUserId: params.approvedBy,
      payload: { paymentOwner: fuelEntry.payment_owner, reason: decision },
    });
    return { error: null, posted: false, reason: "driver_reimbursement" as const };
  }
  if (decision === "supplier_operational_adjustment") {
    await updateTripFuelApprovalState({
      entryId: fuelEntry.id,
      approvalState: "approved",
      approvedBy: params.approvedBy,
      ledgerState: "not_posted",
    });
    await appendTripOperationalTimelineEventSafe({
      organizationId: tripRes.trip.organization_id,
      tripId: tripRes.trip.id,
      eventType: "reimbursement_flagged",
      sourceType: "fuel",
      sourceId: fuelEntry.id,
      actorUserId: params.approvedBy,
      payload: { paymentOwner: fuelEntry.payment_owner, reason: decision },
    });
    return { error: null, posted: false, reason: "supplier_adjustment" as const };
  }
  return { error: null, posted: false, reason: "skip" as const };
}

export async function evaluateAndPostTollEntry(params: {
  tripId: string;
  tollEntryId: string;
  approvedBy: string | null;
}) {
  const [tripRes, tollRes] = await Promise.all([
    getTripById(params.tripId),
    getTripTollEntries(params.tripId),
  ]);
  if (tripRes.error || !tripRes.trip) {
    return { error: tripRes.error ?? new Error("Trip not found"), posted: false, reason: "trip_missing" as const };
  }
  if (tollRes.error) {
    return { error: tollRes.error, posted: false, reason: "toll_missing" as const };
  }
  const tollEntry = tollRes.entries.find((e) => e.id === params.tollEntryId);
  if (!tollEntry) {
    return { error: new Error("Toll entry not found"), posted: false, reason: "toll_missing" as const };
  }
  const post = await executeVehiclePostingRuntime({
    orgId: tripRes.trip.organization_id,
    tripId: tripRes.trip.id,
    vehicleId: tripRes.trip.vehicle_id ?? "",
    sourceType: "toll",
    sourceId: tollEntry.id,
    amount: Math.max(0, Number(tollEntry.amount_inr) || 0),
    approvedBy: params.approvedBy ?? null,
    approvalState: "approved",
    metadata: {
      payment_owner: tollEntry.payment_owner,
      payment_mode: tollEntry.payment_mode,
      is_estimated: tollEntry.is_estimated,
    },
    paymentOwner: tollEntry.payment_owner,
    forcePost: true,
  });
  if (post.error) return { error: post.error, posted: false, reason: "post_failed" as const };
  const nextLedgerState =
    post.reason === "posted" || post.reason === "already_posted" ? "posted" : "not_posted";
  await updateTripTollApprovalState({
    entryId: tollEntry.id,
    approvalState: "approved",
    approvedBy: params.approvedBy,
    ledgerState: nextLedgerState,
  });
  await appendTripOperationalTimelineEventSafe({
    organizationId: tripRes.trip.organization_id,
    tripId: tripRes.trip.id,
    eventType:
      post.reason === "posted" || post.reason === "already_posted"
        ? "posting_completed"
        : "posting_failed",
    sourceType: "toll",
    sourceId: tollEntry.id,
    actorUserId: params.approvedBy,
    payload: {
      reason: post.reason,
    },
  });
  return { error: null, posted: post.reason === "posted", reason: post.reason };
}

export async function evaluateAndPostOtherExpenseEntry(params: {
  tripId: string;
  otherEntryId: string;
  approvedBy: string | null;
}) {
  const [tripRes, otherRes] = await Promise.all([
    getTripById(params.tripId),
    getTripOtherExpenses(params.tripId),
  ]);
  if (tripRes.error || !tripRes.trip) {
    return { error: tripRes.error ?? new Error("Trip not found"), posted: false, reason: "trip_missing" as const };
  }
  if (otherRes.error) {
    return { error: otherRes.error, posted: false, reason: "other_missing" as const };
  }
  const otherEntry = otherRes.entries.find((e) => e.id === params.otherEntryId);
  if (!otherEntry) {
    return { error: new Error("Expense entry not found"), posted: false, reason: "other_missing" as const };
  }
  const post = await executeVehiclePostingRuntime({
    orgId: tripRes.trip.organization_id,
    tripId: tripRes.trip.id,
    vehicleId: tripRes.trip.vehicle_id ?? "",
    sourceType: "manual_adjustment",
    sourceId: otherEntry.id,
    amount: Math.max(0, Number(otherEntry.amount_inr) || 0),
    approvedBy: params.approvedBy ?? null,
    approvalState: "approved",
    metadata: {
      payment_owner: otherEntry.payment_owner,
      payment_mode: otherEntry.payment_mode,
      expense_category: otherEntry.expense_category,
      description: otherEntry.description,
    },
    paymentOwner: otherEntry.payment_owner,
    forcePost: true,
  });
  if (post.error) return { error: post.error, posted: false, reason: "post_failed" as const };
  const nextLedgerState =
    post.reason === "posted" || post.reason === "already_posted" ? "posted" : "not_posted";
  await updateTripOtherExpenseApprovalState({
    entryId: otherEntry.id,
    approvalState: "approved",
    approvedBy: params.approvedBy,
    ledgerState: nextLedgerState,
  });
  await appendTripOperationalTimelineEventSafe({
    organizationId: tripRes.trip.organization_id,
    tripId: tripRes.trip.id,
    eventType:
      post.reason === "posted" || post.reason === "already_posted"
        ? "posting_completed"
        : "posting_failed",
    sourceType: "trip_expense",
    sourceId: otherEntry.id,
    actorUserId: params.approvedBy,
    payload: { reason: post.reason, category: otherEntry.expense_category },
  });
  return { error: null, posted: post.reason === "posted", reason: post.reason };
}
