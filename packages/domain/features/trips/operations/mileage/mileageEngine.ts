import type { TripRow } from "../../services/trips.service";
import type {
  TripFuelEntry,
  TripTollEntry,
  VehicleMaintenanceEntry,
} from "../../../../../../features/trips/operations/types";
import type { TripOperationalCapabilities } from "../../capabilities";

function parseTripDistanceKm(distance: TripRow["distance"]): number | null {
  if (distance == null) return null;
  const n =
    typeof distance === "number"
      ? distance
      : Number.parseFloat(String(distance).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export interface TripMileageMetrics {
  distanceKm: number | null;
  totalFuelSpendInr: number;
  totalTollSpendInr: number;
  totalFuelLiters: number;
  kmPerLiter: number | null;
  fuelCostPerKm: number | null;
  loadedMileageKm: number | null;
  dryRunMileageKm: number | null;
  totalMaintenanceSpendInr: number;
  tripOperatingCostInr: number;
  operatingCostPerKm: number | null;
  operatingRatio: number | null;
  efficiencyTrend: "improving" | "stable" | "declining" | "insufficient_data";
}

export function computeTripMileageMetrics(params: {
  trip: TripRow;
  fuelEntries: TripFuelEntry[];
  tollEntries: TripTollEntry[];
  maintenanceEntries?: VehicleMaintenanceEntry[];
  capabilities?: TripOperationalCapabilities;
}): TripMileageMetrics {
  const distanceKm = parseTripDistanceKm(params.trip.distance);
  const canTrackMileage = params.capabilities?.canTrackMileage !== false;
  const canTrackFuel = params.capabilities?.canTrackFuel !== false;
  const totalFuelSpendInr = params.fuelEntries.reduce(
    (sum, e) => sum + Math.max(0, Number(e.amount_inr) || 0),
    0,
  );
  const totalTollSpendInr = params.tollEntries.reduce(
    (sum, e) => sum + Math.max(0, Number(e.amount_inr) || 0),
    0,
  );
  const totalMaintenanceSpendInr = (params.maintenanceEntries ?? []).reduce(
    (sum, e) => sum + Math.max(0, Number(e.amount_inr) || 0),
    0,
  );
  const totalFuelLiters = params.fuelEntries.reduce((sum, e) => {
    const n = Number(e.liters ?? 0);
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);

  const kmPerLiter =
    canTrackMileage && canTrackFuel && distanceKm != null && totalFuelLiters > 0
      ? distanceKm / totalFuelLiters
      : null;
  const fuelCostPerKm =
    canTrackMileage && canTrackFuel && distanceKm != null && distanceKm > 0
      ? totalFuelSpendInr / distanceKm
      : null;

  // Phase 2 foundation: simple loaded/dry split placeholder with deterministic derivation.
  const loadedMileageKm = canTrackMileage && distanceKm != null ? distanceKm : null;
  const dryRunMileageKm = canTrackMileage ? 0 : null;
  const tripOperatingCostInr = canTrackMileage
    ? totalFuelSpendInr + totalTollSpendInr + totalMaintenanceSpendInr
    : 0;
  const operatingCostPerKm =
    canTrackMileage && distanceKm != null && distanceKm > 0
      ? tripOperatingCostInr / distanceKm
      : null;
  const clientPrice = Math.max(0, Number(params.trip.client_price) || 0);
  const operatingRatio =
    canTrackMileage && clientPrice > 0
      ? Number(((tripOperatingCostInr / clientPrice) * 100).toFixed(2))
      : null;
  const efficiencyTrend =
    canTrackMileage && kmPerLiter != null
      ? kmPerLiter >= 3.5
        ? "improving"
        : kmPerLiter >= 2.5
          ? "stable"
          : "declining"
      : "insufficient_data";

  return {
    distanceKm,
    totalFuelSpendInr: Math.round((canTrackFuel ? totalFuelSpendInr : 0) * 100) / 100,
    totalTollSpendInr: Math.round(totalTollSpendInr * 100) / 100,
    totalFuelLiters: Math.round(totalFuelLiters * 1000) / 1000,
    kmPerLiter: kmPerLiter != null ? Math.round(kmPerLiter * 100) / 100 : null,
    fuelCostPerKm: fuelCostPerKm != null ? Math.round(fuelCostPerKm * 100) / 100 : null,
    loadedMileageKm,
    dryRunMileageKm,
    totalMaintenanceSpendInr: Math.round((canTrackMileage ? totalMaintenanceSpendInr : 0) * 100) / 100,
    tripOperatingCostInr: Math.round(tripOperatingCostInr * 100) / 100,
    operatingCostPerKm:
      operatingCostPerKm != null ? Math.round(operatingCostPerKm * 100) / 100 : null,
    operatingRatio,
    efficiencyTrend,
  };
}
