import type { TripRow } from "../services/trips.service";
import { isDcoOperatingTrip } from "../domain/tripDcoOperating";
import {
  isAggregateExecutionTrip,
  isAssetExecutionTrip,
} from "../domain/tripExecutionModel";

export type OperationalOwner =
  | "organization_vehicle"
  | "supplier_vehicle"
  | "dco_owned";
export type AccountingMode =
  | "vehicle_economics"
  | "supplier_operations"
  | "dco_operations";

export function isAssetTrip(trip: TripRow): boolean {
  return isAssetExecutionTrip(trip);
}

export function isAggregationTrip(trip: TripRow): boolean {
  return isAggregateExecutionTrip(trip);
}

export function getOperationalOwner(trip: TripRow): OperationalOwner {
  if (isDcoOperatingTrip(trip)) return "dco_owned";
  return isAssetTrip(trip) ? "organization_vehicle" : "supplier_vehicle";
}

export function getAccountingMode(trip: TripRow): AccountingMode {
  if (isDcoOperatingTrip(trip)) return "dco_operations";
  return isAssetTrip(trip) ? "vehicle_economics" : "supplier_operations";
}
