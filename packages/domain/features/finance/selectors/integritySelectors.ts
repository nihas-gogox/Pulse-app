import type { TripRow } from "../../trips/services/trips.service";
import type { TripCostEvent } from "@/features/finance/domain/tripCostEvent";
import type { VehicleExpenseEvent } from "@/features/fleet/domain/VehicleExpenseEvent";
import {
  selectAssetTripActualMargin,
  selectAssetTripOperationalCost,
  selectAssetTripOutstandingPayables,
  selectAssetTripPostedExpenses,
} from "./tripAccountingSelectors";

function sumAmounts(values: number[]): number {
  return Math.round(values.reduce((total, value) => total + Math.max(0, Number(value) || 0), 0) * 100) / 100;
}

function ratio(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 10000) / 100;
}

export interface TripPostingIntegrity {
  approvedCount: number;
  postedCount: number;
  unpostedApprovedCount: number;
  postingCoveragePct: number;
}

export interface TripAccountingIntegrity extends TripPostingIntegrity {
  health: "healthy" | "posting_drift" | "margin_drift" | "payable_exposure";
  marginInr: number;
  operationalCostInr: number;
  postedOperationalCostInr: number;
  outstandingPayablesInr: number;
  marginDriftInr: number;
}

export interface VehicleAllocationExposure {
  ownershipCostInr: number;
  allocatedAmountInr: number;
  unallocatedCostInr: number;
  allocationEfficiencyPct: number;
  overAllocatedCount: number;
  negativeBalanceCount: number;
}

export interface VehicleSettlementExposure {
  payableOpenCount: number;
  payableOutstandingInr: number;
}

export interface VehicleAccountingIntegrity {
  health:
    | "healthy"
    | "low_utilization"
    | "high_maintenance_load"
    | "negative_margin"
    | "allocation_drift"
    | "settlement_exposure";
  monthlyRevenueInr: number;
  operationalCostInr: number;
  ownershipCostInr: number;
  outstandingPayablesInr: number;
  unallocatedOverheadInr: number;
  netVehicleProfitabilityInr: number;
  allocationEfficiencyPct: number;
}

export interface FleetProfitabilityHealth {
  healthyVehicles: number;
  negativeMarginVehicles: number;
  allocationDriftVehicles: number;
  settlementExposureVehicles: number;
}

export function selectTripPostingIntegrity(events: TripCostEvent[]): TripPostingIntegrity {
  const approvedEvents = events.filter((event) => event.approvalState === "approved");
  const postedEvents = approvedEvents.filter((event) => event.postingState === "posted");
  const approvedCount = approvedEvents.length;
  const postedCount = postedEvents.length;
  return {
    approvedCount,
    postedCount,
    unpostedApprovedCount: Math.max(0, approvedCount - postedCount),
    postingCoveragePct: ratio(postedCount, Math.max(1, approvedCount)),
  };
}

export function selectTripAccountingIntegrity(input: {
  trip: TripRow;
  events: TripCostEvent[];
}): TripAccountingIntegrity {
  const posting = selectTripPostingIntegrity(input.events);
  const operationalCostInr = selectAssetTripOperationalCost(input.events);
  const postedOperationalCostInr = selectAssetTripPostedExpenses(input.events);
  const outstandingPayablesInr = selectAssetTripOutstandingPayables(input.events);
  const marginInr = selectAssetTripActualMargin(input);
  const marginDriftInr = Math.max(0, operationalCostInr - postedOperationalCostInr);
  let health: TripAccountingIntegrity["health"] = "healthy";
  if (posting.unpostedApprovedCount > 0) health = "posting_drift";
  else if (marginDriftInr > 0) health = "margin_drift";
  else if (outstandingPayablesInr > 0) health = "payable_exposure";
  return {
    ...posting,
    health,
    marginInr,
    operationalCostInr,
    postedOperationalCostInr,
    outstandingPayablesInr,
    marginDriftInr,
  };
}

export function selectVehicleAllocationExposure(events: VehicleExpenseEvent[]): VehicleAllocationExposure {
  const ownershipEvents = events.filter((event) => event.expenseScope === "common");
  const ownershipCostInr = sumAmounts(ownershipEvents.map((event) => event.amount));
  const allocatedAmountInr = sumAmounts(
    ownershipEvents.map((event) =>
      Math.max(0, Number(event.allocatedAmount ?? (event.allocationStatus === "allocated" ? event.amount : 0)) || 0),
    ),
  );
  const overAllocatedCount = ownershipEvents.filter(
    (event) => Number(event.allocatedAmount ?? 0) > Math.max(0, Number(event.amount) || 0),
  ).length;
  const negativeBalanceCount = ownershipEvents.filter(
    (event) => Number(event.allocatedAmount ?? 0) < 0 || Number(event.amount) < 0,
  ).length;
  return {
    ownershipCostInr,
    allocatedAmountInr,
    unallocatedCostInr: Math.max(0, ownershipCostInr - allocatedAmountInr),
    allocationEfficiencyPct: ratio(allocatedAmountInr, Math.max(1, ownershipCostInr)),
    overAllocatedCount,
    negativeBalanceCount,
  };
}

export function selectVehicleSettlementExposure(events: VehicleExpenseEvent[]): VehicleSettlementExposure {
  const openPayables = events.filter(
    (event) => event.approvalState === "approved" && event.settlementState !== "settled",
  );
  return {
    payableOpenCount: openPayables.length,
    payableOutstandingInr: sumAmounts(openPayables.map((event) => event.amount)),
  };
}

export function selectVehicleAccountingIntegrity(input: {
  monthlyRevenueInr: number;
  operationalCostInr: number;
  events: VehicleExpenseEvent[];
}): VehicleAccountingIntegrity {
  const allocation = selectVehicleAllocationExposure(input.events);
  const settlement = selectVehicleSettlementExposure(input.events);
  const ownershipCostInr = allocation.ownershipCostInr;
  const operationalCostInr = Math.max(0, Number(input.operationalCostInr) || 0);
  const monthlyRevenueInr = Math.max(0, Number(input.monthlyRevenueInr) || 0);
  const netVehicleProfitabilityInr =
    Math.round((monthlyRevenueInr - operationalCostInr - ownershipCostInr) * 100) / 100;
  const maintenanceCostInr = sumAmounts(
    input.events
      .filter((event) => event.category === "maintenance" || event.category === "service")
      .map((event) => event.amount),
  );
  let health: VehicleAccountingIntegrity["health"] = "healthy";
  if (settlement.payableOutstandingInr > 0) health = "settlement_exposure";
  else if (allocation.overAllocatedCount > 0 || allocation.negativeBalanceCount > 0) health = "allocation_drift";
  else if (netVehicleProfitabilityInr < 0) health = "negative_margin";
  else if (maintenanceCostInr > operationalCostInr * 0.5 && maintenanceCostInr > 0) health = "high_maintenance_load";
  else if (monthlyRevenueInr > 0 && allocation.allocationEfficiencyPct < 40) health = "low_utilization";
  return {
    health,
    monthlyRevenueInr,
    operationalCostInr,
    ownershipCostInr,
    outstandingPayablesInr: settlement.payableOutstandingInr,
    unallocatedOverheadInr: allocation.unallocatedCostInr,
    netVehicleProfitabilityInr,
    allocationEfficiencyPct: allocation.allocationEfficiencyPct,
  };
}

export function selectFleetProfitabilityHealth(input: {
  vehicles: Array<{
    monthlyRevenueInr: number;
    operationalCostInr: number;
    events: VehicleExpenseEvent[];
  }>;
}): FleetProfitabilityHealth {
  const summaries = input.vehicles.map((vehicle) =>
    selectVehicleAccountingIntegrity({
      monthlyRevenueInr: vehicle.monthlyRevenueInr,
      operationalCostInr: vehicle.operationalCostInr,
      events: vehicle.events,
    }),
  );
  return {
    healthyVehicles: summaries.filter((summary) => summary.health === "healthy").length,
    negativeMarginVehicles: summaries.filter((summary) => summary.health === "negative_margin").length,
    allocationDriftVehicles: summaries.filter((summary) => summary.health === "allocation_drift").length,
    settlementExposureVehicles: summaries.filter((summary) => summary.health === "settlement_exposure").length,
  };
}
