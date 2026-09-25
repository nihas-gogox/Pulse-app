import type { TripRow } from '../services/trips.service';

export interface TripVisibilityClientLike {
  id: string;
  is_integrated?: boolean;
  linked_organization_id?: string | null;
}

export interface TripVisibilitySupplierLike {
  id: string;
  supplier_type?: string | null;
  linked_organization_id?: string | null;
}

type TripPartyLookup<T extends { id: string }> = Map<string, T> | Record<string, T>;

function getFromLookup<T extends { id: string }>(
  lookup: TripPartyLookup<T>,
  id: string | null | undefined,
): T | null {
  if (!id) return null;
  if (lookup instanceof Map) return lookup.get(id) ?? null;
  return lookup[id] ?? null;
}

/**
 * True when the trip was created via indent → trip (award/convert).
 * False when created as a Direct trip (Add Trip / manual).
 * Hub cards surface this as product tags: Indent vs Direct.
 */
export function isLoadBasedTrip(
  trip: Pick<TripRow, 'indent_id'> | { indent_id?: string | null } | null | undefined,
): boolean {
  return trip?.indent_id != null;
}

/**
 * Trip is owned by another org and the viewer should use linked client/supplier maps (indent-based load
 * or aggregate partner trip with supplier_id). Used for finance party remap and ledger attribution.
 */
export function isCrossOrgIntegrationTrip(
  trip:
    | Pick<TripRow, 'organization_id' | 'indent_id' | 'supplier_id'>
    | null
    | undefined,
  viewerOrgId: string | null | undefined,
): boolean {
  if (viewerOrgId == null || !trip?.organization_id) return false;
  if (trip.organization_id === viewerOrgId) return false;
  return (
    isLoadBasedTrip(trip) ||
    !!(trip.supplier_id && String(trip.supplier_id).trim())
  );
}

export function isIntegratedClientRow(
  client: Pick<TripVisibilityClientLike, 'is_integrated' | 'linked_organization_id'> | null | undefined,
): boolean {
  return client?.is_integrated === true && !!client.linked_organization_id;
}

export function isIntegratedSupplierRow(
  supplier: Pick<TripVisibilitySupplierLike, 'supplier_type' | 'linked_organization_id'> | null | undefined,
): boolean {
  return supplier?.supplier_type === 'integrated' && !!supplier.linked_organization_id;
}

export function canOrgSeeTripAsIntegratedClient(
  trip: Pick<TripRow, 'indent_id' | 'client_id'> | null | undefined,
  viewerOrgId: string | null | undefined,
  clientById: TripPartyLookup<TripVisibilityClientLike>,
): boolean {
  if (!viewerOrgId || !isLoadBasedTrip(trip)) return false;
  const client = getFromLookup(clientById, trip?.client_id);
  return isIntegratedClientRow(client) && client?.linked_organization_id === viewerOrgId;
}

export function canOrgSeeTripAsIntegratedSupplier(
  trip: Pick<TripRow, 'indent_id' | 'supplier_id'> | null | undefined,
  viewerOrgId: string | null | undefined,
  supplierById: TripPartyLookup<TripVisibilitySupplierLike>,
): boolean {
  if (!viewerOrgId || !isLoadBasedTrip(trip)) return false;
  const supplier = getFromLookup(supplierById, trip?.supplier_id);
  return isIntegratedSupplierRow(supplier) && supplier?.linked_organization_id === viewerOrgId;
}

export function isTripVisibleToOrgViaIntegration(
  trip: Pick<TripRow, 'indent_id' | 'client_id' | 'supplier_id'> | null | undefined,
  viewerOrgId: string | null | undefined,
  opts: {
    clientById?: TripPartyLookup<TripVisibilityClientLike> | null;
    supplierById?: TripPartyLookup<TripVisibilitySupplierLike> | null;
  },
): boolean {
  return (
    (!!opts.clientById &&
      canOrgSeeTripAsIntegratedClient(trip, viewerOrgId, opts.clientById)) ||
    (!!opts.supplierById &&
      canOrgSeeTripAsIntegratedSupplier(trip, viewerOrgId, opts.supplierById))
  );
}

export function buildUniqueLinkedOrgIdMap<
  T extends { id: string; linked_organization_id?: string | null }
>(rows: readonly T[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const linkedOrgId = row.linked_organization_id ?? null;
    if (!linkedOrgId) continue;
    counts.set(linkedOrgId, (counts.get(linkedOrgId) ?? 0) + 1);
  }

  const unique = new Map<string, string>();
  for (const row of rows) {
    const linkedOrgId = row.linked_organization_id ?? null;
    if (!linkedOrgId) continue;
    if (counts.get(linkedOrgId) === 1) unique.set(linkedOrgId, row.id);
  }
  return unique;
}
