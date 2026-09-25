import type { TripRow } from "../services/trips.service";
import { isDcoOperatingTrip } from "../domain/tripDcoOperating";
import {
  getAccountingMode,
  getOperationalOwner,
  isAggregationTrip,
  isAssetTrip,
} from "./operationalModels";

export interface TripOperationalCapabilities {
  isAssetTrip: boolean;
  isAggregationTrip: boolean;
  canTrackFuel: boolean;
  canTrackToll: boolean;
  canTrackMileage: boolean;
  canTrackMaintenance: boolean;
  canTrackVehicleEconomics: boolean;
  canTrackVerification: boolean;
  requiresBusinessApproval: boolean;
  operationalOwner: "organization_vehicle" | "supplier_vehicle" | "dco_owned";
  accountingMode: "vehicle_economics" | "supplier_operations" | "dco_operations";
}

export function getTripOperationalCapabilities(
  trip: TripRow,
): TripOperationalCapabilities {
  const dco = isDcoOperatingTrip(trip);
  const assetTrip = isAssetTrip(trip);
  const aggregationTrip = isAggregationTrip(trip);
  const opsCapture = dco || assetTrip;
  return {
    isAssetTrip: assetTrip,
    isAggregationTrip: aggregationTrip,
    canTrackFuel: opsCapture,
    canTrackToll: opsCapture,
    canTrackMileage: opsCapture,
    canTrackMaintenance: !dco && assetTrip,
    canTrackVehicleEconomics: !dco && assetTrip,
    canTrackVerification: true,
    requiresBusinessApproval: true,
    operationalOwner: getOperationalOwner(trip),
    accountingMode: getAccountingMode(trip),
  };
}
