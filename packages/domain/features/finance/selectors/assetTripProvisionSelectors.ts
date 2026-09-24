import type { TripRow } from "../../trips/services/trips.service";
import type { TripCostEvent } from "@/features/finance/domain/tripCostEvent";
import { computeDriverCommissionForTrip } from "../aggregation/aggregateDrivers";
import type { DriverOfferForAggregation } from "@/features/finance/aggregation/types";
import { selectAssetTripOperationalCost } from "./tripAccountingSelectors";
import { formatINR } from "@pulse/core/lib/format";

function roundCurrency(amount: number): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

function parseIsoDay(iso: string | null | undefined): Date | null {
  if (!iso || !String(iso).trim()) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : null;
}

/** Calendar days on trip (inclusive), minimum 1. */
export function computeTripOperatedDays(trip: TripRow): number {
  const start =
    parseIsoDay(trip.pickup_date) ??
    parseIsoDay(trip.created_at) ??
    new Date();
  const end =
    parseIsoDay(trip.completed_at) ??
    parseIsoDay(trip.updated_at) ??
    start;
  const startMs = start.getTime();
  const endMs = Math.max(end.getTime(), startMs);
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((endMs - startMs) / dayMs) + 1);
}

function daysInCalendarMonth(reference: Date): number {
  return new Date(reference.getFullYear(), reference.getMonth() + 1, 0).getDate();
}

export function driverOfferFromDriverRow(
  driver:
    | {
        payable_amount?: number | null;
        commission_percent?: number | null;
        commission_per_km?: number | null;
      }
    | null
    | undefined,
): DriverOfferForAggregation | null {
  if (!driver) return null;
  return {
    payableAmount: driver.payable_amount ?? null,
    commissionPercent: driver.commission_percent ?? null,
    commissionPerKm: driver.commission_per_km ?? null,
  };
}

function isPostedApprovedCost(event: TripCostEvent): boolean {
  return event.postingState === "posted" && event.approvalState === "approved";
}

export function selectAssetTripReimbursablePostedCost(events: TripCostEvent[]): number {
  return roundCurrency(
    events
      .filter((event) => event.reimbursable && isPostedApprovedCost(event))
      .reduce((sum, event) => sum + Math.max(0, Number(event.amount) || 0), 0),
  );
}

export interface AssetTripPostedExpenseSplit {
  fuelInr: number;
  tollInr: number;
  loadingInr: number;
  otherInr: number;
  totalInr: number;
}

export function selectAssetTripPostedExpenseSplit(
  events: TripCostEvent[],
): AssetTripPostedExpenseSplit {
  let fuel = 0;
  let toll = 0;
  let loading = 0;
  let other = 0;
  for (const event of events) {
    if (!isPostedApprovedCost(event)) continue;
    const amt = Math.max(0, Number(event.amount) || 0);
    if (event.category === "fuel") fuel += amt;
    else if (event.category === "toll" || event.category === "fastag") toll += amt;
    else if (event.category === "loading" || event.category === "unloading") loading += amt;
    else other += amt;
  }
  return {
    fuelInr: roundCurrency(fuel),
    tollInr: roundCurrency(toll),
    loadingInr: roundCurrency(loading),
    otherInr: roundCurrency(other),
    totalInr: roundCurrency(fuel + toll + loading + other),
  };
}

export interface AssetTripReimbursementSplit {
  /** Driver-paid, posted, not yet marked reimbursed. */
  requestedInr: number;
  /** Driver-paid, posted, settlement marked reimbursed. */
  paidInr: number;
  totalDriverPaidInr: number;
}

export function selectAssetTripReimbursementSplit(
  events: TripCostEvent[],
): AssetTripReimbursementSplit {
  let requested = 0;
  let paid = 0;
  for (const event of events) {
    if (!event.reimbursable || !isPostedApprovedCost(event)) continue;
    const amt = Math.max(0, Number(event.amount) || 0);
    if (event.settlementState === "settled") paid += amt;
    else requested += amt;
  }
  return {
    requestedInr: roundCurrency(requested),
    paidInr: roundCurrency(paid),
    totalDriverPaidInr: roundCurrency(requested + paid),
  };
}

export type AssetProvisionCostBreakdownLine = {
  label: string;
  amount: number;
  variant?: "default" | "section" | "child" | "emphasis" | "good";
  /** Share of the revised trip cost, 0–100. Shown as a "(NN%)" suffix. */
  percentOfTotal?: number;
  /** Explanatory sub-text, e.g. how salary was derived. */
  note?: string;
};

export function buildAssetProvisionCostBreakdownLines(
  breakdown: AssetTripProvisionCostBreakdown,
): AssetProvisionCostBreakdownLine[] {
  const total = breakdown.totalBaseCostInr;
  const pct = (amount: number): number | undefined =>
    total > 0 ? roundCurrency((amount / total) * 100) : undefined;

  const lines: AssetProvisionCostBreakdownLine[] = [
    {
      label: "Driver commission",
      amount: breakdown.driverCommissionInr,
      percentOfTotal: pct(breakdown.driverCommissionInr),
    },
  ];
  if (breakdown.salaryAllocationInr > 0) {
    lines.push({
      label: `Salary · ${breakdown.daysOperated}d`,
      amount: breakdown.salaryAllocationInr,
      percentOfTotal: pct(breakdown.salaryAllocationInr),
      note:
        breakdown.monthlySalaryInr > 0
          ? `${formatINR(breakdown.monthlySalaryInr)}/mo ÷ ${breakdown.daysInMonth}d × ${breakdown.daysOperated}d`
          : undefined,
    });
  }

  const split = breakdown.postedExpenseSplit;
  if (split.totalInr > 0) {
    lines.push({
      label: "Posted trip expenses",
      amount: split.totalInr,
      variant: "section",
      percentOfTotal: pct(split.totalInr),
    });
    if (split.fuelInr > 0) {
      lines.push({ label: "Fuel", amount: split.fuelInr, variant: "child" });
    }
    if (split.tollInr > 0) {
      lines.push({ label: "Toll / FASTag", amount: split.tollInr, variant: "child" });
    }
    if (split.loadingInr > 0) {
      lines.push({
        label: "Loading / unload",
        amount: split.loadingInr,
        variant: "child",
      });
    }
    if (split.otherInr > 0) {
      lines.push({ label: "Other", amount: split.otherInr, variant: "child" });
    }
  }

  const reimb = breakdown.reimbursementSplit;
  if (reimb.totalDriverPaidInr > 0) {
    lines.push({
      label: "Driver reimbursement",
      amount: reimb.totalDriverPaidInr,
      variant: "section",
    });
    if (reimb.requestedInr > 0) {
      lines.push({
        label: "Requested (due)",
        amount: reimb.requestedInr,
        variant: "emphasis",
      });
    }
    if (reimb.paidInr > 0) {
      lines.push({
        label: "Paid (reimbursed)",
        amount: reimb.paidInr,
        variant: "good",
      });
    }
  }

  return lines.filter((line) => line.amount > 0 || line.variant === "section");
}

export interface AssetTripProvisionCostBreakdown {
  driverCommissionInr: number;
  salaryAllocationInr: number;
  postedOperationalCostInr: number;
  reimbursablePostedInr: number;
  postedExpenseSplit: AssetTripPostedExpenseSplit;
  reimbursementSplit: AssetTripReimbursementSplit;
  daysOperated: number;
  daysInMonth: number;
  monthlySalaryInr: number;
  totalBaseCostInr: number;
}

export function selectAssetTripProvisionCostBreakdown(input: {
  trip: TripRow;
  events: TripCostEvent[];
  driverOffer?: DriverOfferForAggregation | null;
}): AssetTripProvisionCostBreakdown {
  const daysOperated = computeTripOperatedDays(input.trip);
  const refDay =
    parseIsoDay(input.trip.pickup_date) ??
    parseIsoDay(input.trip.created_at) ??
    new Date();
  const daysInMonth = daysInCalendarMonth(refDay);
  const monthlySalaryInr = Math.max(
    0,
    Number(input.driverOffer?.payableAmount ?? 0) || 0,
  );
  const salaryAllocationInr =
    monthlySalaryInr > 0
      ? roundCurrency((monthlySalaryInr / daysInMonth) * daysOperated)
      : 0;
  const driverCommissionInr = roundCurrency(
    computeDriverCommissionForTrip(input.trip, input.driverOffer ?? null),
  );
  const postedOperationalCostInr = selectAssetTripOperationalCost(input.events);
  const postedExpenseSplit = selectAssetTripPostedExpenseSplit(input.events);
  const reimbursementSplit = selectAssetTripReimbursementSplit(input.events);
  const reimbursablePostedInr = reimbursementSplit.totalDriverPaidInr;
  const totalBaseCostInr = roundCurrency(
    driverCommissionInr + salaryAllocationInr + postedOperationalCostInr,
  );

  return {
    driverCommissionInr,
    salaryAllocationInr,
    postedOperationalCostInr,
    reimbursablePostedInr,
    postedExpenseSplit,
    reimbursementSplit,
    daysOperated,
    daysInMonth,
    monthlySalaryInr,
    totalBaseCostInr,
  };
}

/**
 * Driver-facing estimated earnings for one trip — same labor basis as Finance Hub
 * revised trip cost labor (commission + pro-rata salary). Excludes posted expenses.
 */
export function computeDriverTripEstEarningsInr(
  trip: TripRow,
  driverOffer?: DriverOfferForAggregation | null,
): number {
  const breakdown = selectAssetTripProvisionCostBreakdown({
    trip,
    events: [],
    driverOffer: driverOffer ?? null,
  });
  return roundCurrency(
    breakdown.driverCommissionInr + breakdown.salaryAllocationInr,
  );
}

export function selectAssetTripAdjustedNetMargin(input: {
  adjustedSaleInr: number;
  adjustedCostInr: number;
}): number {
  return roundCurrency(input.adjustedSaleInr - input.adjustedCostInr);
}

/**
 * Trip detail finance hero margin.
 * - Asset execution: adjusted client sale − adjusted trip execution cost (labor + posted expenses).
 * - Aggregate / market: adjusted client sale − adjusted supplier cost.
 * Losses are negative (never clamped to zero).
 */
export function selectTripManifestMargin(input: {
  adjustedSaleInr: number;
  adjustedCostInr: number;
}): number {
  return selectAssetTripAdjustedNetMargin(input);
}
