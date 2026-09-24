/**
 * DCO commercial operating mode. Independent of TripExecutionModel
 * (`asset` | `aggregate`), which stays the physical/ledger-lane classifier.
 *
 * Discriminator is ONLY `trips.operating_mode === 'DCO'`. Do not infer DCO from
 * supplier_id, trip_payout_mode, source, or driver relationship.
 */
export function isDcoOperatingTrip(
  trip: { operating_mode?: string | null } | null | undefined,
): boolean {
  return String(trip?.operating_mode ?? "").trim().toUpperCase() === "DCO";
}
