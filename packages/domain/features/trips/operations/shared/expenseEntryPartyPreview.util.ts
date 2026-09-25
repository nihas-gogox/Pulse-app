import type { NumericEntryPartyPreview } from "@/components/mobile-input/NumericEntryPartyBanner";
import type { TripRow } from "../../services/trips.service";

/** Short trip date for expense keypad meta (e.g. "12 Sep 2026"). */
export function formatExpenseTripDate(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

export function formatExpenseTripRoute(trip: Pick<TripRow, "pickup_area" | "drop_location" | "drop_area">): string {
  const pickup = (trip.pickup_area || "").trim() || "Pickup";
  const drop = (trip.drop_location || trip.drop_area || "").trim() || "Drop";
  return `${pickup} → ${drop}`;
}

/**
 * Party preview for expense amount keypads — shipper + route + date,
 * matching the trip chrome on Log expense.
 */
export function buildExpenseEntryPartyPreview(
  trip: TripRow,
): NumericEntryPartyPreview {
  const shipper =
    (trip.organization_name || "").trim() ||
    (trip.client_name || "").trim() ||
    "Trip";
  const route = formatExpenseTripRoute(trip);
  const dateLabel = formatExpenseTripDate(trip.pickup_date);
  const tripCode =
    (trip.display_trip_id || trip.trip_number || trip.trip_code || "").trim() ||
    null;

  const detailParts = [dateLabel, tripCode].filter(Boolean);

  return {
    name: shipper,
    heroLine: route,
    detailLine: detailParts.length > 0 ? detailParts.join(" · ") : undefined,
    entityType: "client",
  };
}
