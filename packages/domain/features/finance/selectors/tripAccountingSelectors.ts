import type { TripRow } from "../../trips/services/trips.service";
import type { TripCostEvent } from "../domain/tripCostEvent";
import type { TripCommercialAdjustment } from "../domain/tripCommercialAdjustment";

function roundCurrency(amount: number): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

function isPostedAssetCost(event: TripCostEvent): boolean {
  return event.postingState === "posted" && event.approvalState === "approved";
}

export function selectAssetTripOperationalCost(events: TripCostEvent[]): number {
  return roundCurrency(
    events
      .filter(isPostedAssetCost)
      .reduce((sum, event) => sum + Math.max(0, Number(event.amount) || 0), 0),
  );
}

export function selectAssetTripFuelCost(events: TripCostEvent[]): number {
  return roundCurrency(
    events
      .filter((event) => event.category === "fuel" && isPostedAssetCost(event))
      .reduce((sum, event) => sum + Math.max(0, Number(event.amount) || 0), 0),
  );
}

export function selectAssetTripTollCost(events: TripCostEvent[]): number {
  return roundCurrency(
    events
      .filter((event) => event.category === "toll" && isPostedAssetCost(event))
      .reduce((sum, event) => sum + Math.max(0, Number(event.amount) || 0), 0),
  );
}

export function selectAssetTripMaintenanceCost(events: TripCostEvent[]): number {
  return roundCurrency(
    events
      .filter((event) => event.category === "maintenance" && isPostedAssetCost(event))
      .reduce((sum, event) => sum + Math.max(0, Number(event.amount) || 0), 0),
  );
}

export function selectAssetTripActualMargin(input: {
  trip: TripRow;
  events: TripCostEvent[];
}): number {
  const revenue = Math.max(0, Number(input.trip.client_price ?? 0) || 0);
  const operationalCost = selectAssetTripOperationalCost(input.events);
  return roundCurrency(revenue - operationalCost);
}

export function selectAssetTripOutstandingPayables(events: TripCostEvent[]): number {
  return roundCurrency(
    events
      .filter(
        (event) =>
          event.reimbursable &&
          event.approvalState === "approved" &&
          event.settlementState !== "settled",
      )
      .reduce((sum, event) => sum + Math.max(0, Number(event.amount) || 0), 0),
  );
}

export function selectAssetTripPostedExpenses(events: TripCostEvent[]): number {
  return roundCurrency(
    events
      .filter((event) => event.postingState === "posted")
      .reduce((sum, event) => sum + Math.max(0, Number(event.amount) || 0), 0),
  );
}

export function selectAssetTripMarginImpact(input: {
  trip: TripRow;
  events: TripCostEvent[];
}): number {
  const revenue = Math.max(0, Number(input.trip.client_price ?? 0) || 0);
  if (!revenue) return 0;
  const margin = selectAssetTripActualMargin(input);
  return roundCurrency(((revenue - margin) / revenue) * 100);
}

export function selectAssetTripCostPerKm(input: {
  trip: TripRow;
  events: TripCostEvent[];
}): number | null {
  const distance = Math.max(0, Number(input.trip.distance ?? 0) || 0);
  if (!distance) return null;
  return roundCurrency(selectAssetTripOperationalCost(input.events) / distance);
}

export function selectAggregateTripSupplierCost(input: {
  trip: TripRow;
  adjustments: TripCommercialAdjustment[];
}): number {
  const baseSupplierCost = Math.max(0, Number(input.trip.supplier_rate ?? 0) || 0);
  const supplierDelta = input.adjustments.reduce((sum, adjustment) => {
    if (adjustment.direction === "increase_cost") return sum + Math.max(0, adjustment.amount);
    if (adjustment.direction === "reduce_cost") return sum - Math.max(0, adjustment.amount);
    return sum;
  }, 0);
  return roundCurrency(baseSupplierCost + supplierDelta);
}

export function selectAggregateTripCommercialAdjustments(
  adjustments: TripCommercialAdjustment[],
): number {
  return roundCurrency(
    adjustments.reduce((sum, adjustment) => {
      if (adjustment.direction === "increase_margin") return sum + Math.max(0, adjustment.amount);
      if (adjustment.direction === "reduce_margin") return sum - Math.max(0, adjustment.amount);
      if (adjustment.direction === "reduce_cost") return sum + Math.max(0, adjustment.amount);
      if (adjustment.direction === "increase_cost") return sum - Math.max(0, adjustment.amount);
      return sum;
    }, 0),
  );
}

export function selectAggregateTripBrokerageMargin(input: {
  trip: TripRow;
  adjustments: TripCommercialAdjustment[];
}): number {
  const revenue = Math.max(0, Number(input.trip.client_price ?? 0) || 0);
  const supplierCost = selectAggregateTripSupplierCost({
    trip: input.trip,
    adjustments: input.adjustments,
  });
  return roundCurrency(revenue - supplierCost);
}

export function selectAggregateTripNetMargin(input: {
  trip: TripRow;
  adjustments: TripCommercialAdjustment[];
}): number {
  return roundCurrency(
    selectAggregateTripBrokerageMargin(input) +
      selectAggregateTripCommercialAdjustments(input.adjustments),
  );
}
