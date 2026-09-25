/**
 * Finance customer trip membership (get_customer_ledger_inputs):
 * trips owned by the viewer org, attributed by client id or exact client name.
 * Linked-org indent trips (the other org's own operations) are not this customer's trips.
 */

type ViewerClientTrip = {
  organization_id?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  deleted_at?: string | null;
};

type ViewerClient = {
  id: string;
  name?: string | null;
  contact_person?: string | null;
};

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isViewerOwnedClientTrip(
  trip: ViewerClientTrip,
  orgId: string,
  client: ViewerClient,
): boolean {
  if (trip.deleted_at) return false;
  if (norm(trip.organization_id) !== norm(orgId)) return false;
  const clientId = norm(client.id);
  if (clientId && norm(trip.client_id) === clientId) return true;
  const nameKey = norm(client.name || client.contact_person);
  const tripName = norm(trip.client_name);
  return nameKey.length > 0 && tripName === nameKey;
}

export function viewerOwnedClientTrips<T extends ViewerClientTrip>(
  trips: readonly T[],
  orgId: string,
  client: ViewerClient,
): T[] {
  return trips.filter((trip) => isViewerOwnedClientTrip(trip, orgId, client));
}

/** Ledger trip ids, with rows taken from the page catalog when the org trip query missed them. */
export function ledgerClientTripRows<T extends { id: string }>(
  catalog: readonly T[],
  aligned: readonly T[],
  tripIds: readonly string[],
): T[] {
  const byId = new Map<string, T>();
  for (const trip of catalog) if (trip.id) byId.set(trip.id, trip);
  for (const trip of aligned) if (trip.id) byId.set(trip.id, trip);
  const rows: T[] = [];
  const seen = new Set<string>();
  for (const id of tripIds) {
    const trip = byId.get(id);
    if (!trip || seen.has(trip.id)) continue;
    seen.add(trip.id);
    rows.push(trip);
  }
  return rows;
}
