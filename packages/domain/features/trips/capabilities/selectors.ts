import type { TripRow } from "../services/trips.service";
import { isDcoOperatingTrip } from "../domain/tripDcoOperating";
import { getTripOperationalCapabilities } from "./capabilityEngine";

export function selectOperationsHubSections(trip: TripRow): string[] {
  const capabilities = getTripOperationalCapabilities(trip);
  if (isDcoOperatingTrip(trip) || capabilities.isAssetTrip) {
    const sections = [
      "Verification",
      "Fuel",
      "Toll",
      "Mileage",
    ];
    if (capabilities.canTrackVehicleEconomics) {
      sections.push("Vehicle Economics", "Maintenance");
    }
    return sections;
  }
  return [
    "Verification",
    "Commercial Cost",
    "Supplier Adjustments",
    "Brokerage Margin",
    "Settlement Exposure",
  ];
}
