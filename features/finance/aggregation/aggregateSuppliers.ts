/**
 * O(n) supplier aggregation. Mirrors customers: trips = count per supplier, sales = sum supplier_rate (partner rate), paid = ledger, due = unsettled.
 * due (payables) = from trips only (supplier_rate); paid = from ledger only (amount_out).
 * Unsettled = max(0, due - paid). Single source per metric. Strict O(n) via lookup maps.
 * When trip has no supplier_id but has supplier_name, match supplier by name (e.g. integrated/synced trips).
 * When tripsWhereOrgIsClient is passed, trips where current org is the client are attributed to the
 * integrated supplier whose linked_organization_id equals the trip's organization_id (trip owner).
 * Supplier payables are from trips only — not from awarded indents before conversion (no pre-trip quote roll-up).
 */
import type { FinancialRowData, AggregationTotals } from './types';
import type { LedgerTx, TripForSupplier, SupplierLike, TripPartyMap } from './types';
import {
  adjustedCost,
  adjustedRevenue,
  type TripAdjustment,
} from '@/features/trips/services/tripAdjustments';
import { isDcoOperatingTrip } from '@/features/trips/domain/tripDcoOperating';
import { buildUniqueLinkedOrgIdMap, isLoadBasedTrip } from '@/features/trips/visibility/tripVisibility';

/** Trip with organization_id (trip owner); used for "trips where we are the client". client_price = amount we were billed (use for due). */
export type TripWhereOrgIsClient = TripForSupplier & {
  organization_id: string;
  /** When we are the client, this is the amount we owe / were billed; use for due instead of supplier_rate. */
  client_price?: number;
};

function toNameKey(name: string): string {
  return (name || '').toLowerCase().trim();
}

function getSupplierDisplayName(s: SupplierLike): string {
  return (s.name || s.company_name || s.contact_person || 'Unnamed').trim() || 'Unnamed';
}

function normId(id: string | null | undefined): string {
  return id == null ? '' : String(id).trim();
}

function adjustmentsForTrip(
  adjustmentsByTripId: Record<string, TripAdjustment[]> | undefined,
  tripId: string | undefined,
): TripAdjustment[] {
  if (!adjustmentsByTripId || !tripId) return [];
  const k = String(tripId).trim().toLowerCase();
  return adjustmentsByTripId[k] ?? [];
}

export function aggregateSuppliers(
  suppliers: readonly SupplierLike[],
  trips: readonly TripForSupplier[],
  transactions: readonly LedgerTx[],
  tripsWhereOrgIsClient?: TripWhereOrgIsClient[],
  tripPartyMap?: TripPartyMap | null,
  /** When provided, trip payables match Adjustment Registry (cost vs revenue where applicable). */
  adjustmentsByTripId?: Record<string, TripAdjustment[]>,
): { rows: FinancialRowData[]; totals: AggregationTotals } {
  const dueFromTrips: Record<string, number> = {};
  const sourced: Record<string, number> = {};
  const paidFromLedger: Record<string, number> = {};
  const supplierIds = new Set<string>();

  // O(suppliers): init per-supplier accumulators and build lookup maps. Use normalized id so trip.supplier_id matches even with whitespace.
  const supplierIdByNameKey: Record<string, string> = {};
  const normalizedIdToRawId: Record<string, string> = {};
  const supplierIdByLinkedOrgId = buildUniqueLinkedOrgIdMap(suppliers);
  const tripPartyByRef: Record<string, { supplier_id?: string | null; driver_id?: string | null }> = {};
  // Trips whose supplier couldn't be resolved to any loaded supplier (no id/name match) —
  // tracked so a row can still be synthesized for them below instead of the payable
  // silently vanishing from every count.
  const unresolvedDisplayNameById: Record<string, string> = {};

  for (let i = 0; i < suppliers.length; i++) {
    const s = suppliers[i];
    const id = s.id;
    supplierIds.add(id);
    dueFromTrips[id] = 0;
    sourced[id] = 0;
    paidFromLedger[id] = 0;
    const nid = normId(id);
    if (nid) normalizedIdToRawId[nid] = id;
    const nameKey = toNameKey(getSupplierDisplayName(s));
    if (nameKey) supplierIdByNameKey[nameKey] = id;
  }

  // O(trips): attribute each trip to supplier by supplier_id (normalized) or by supplier_name (aggregated trip = partner rate as due).
  for (let i = 0; i < trips.length; i++) {
    const t = trips[i];
    if (isDcoOperatingTrip(t)) continue;
    const tid = (t as { id?: string }).id;
    const adj = adjustmentsForTrip(adjustmentsByTripId, tid);
    const rawRate = Number(t.supplier_rate ?? 0);
    const rate =
      adjustmentsByTripId !== undefined ? adjustedCost(rawRate, adj) : rawRate;
    const tripSupplierIdNorm = normId(t.supplier_id);
    let sid: string | null =
      (tripSupplierIdNorm && normalizedIdToRawId[tripSupplierIdNorm]) ?? null;
    const nameKey = t.supplier_name ? toNameKey(t.supplier_name) : '';
    if (!sid && nameKey) {
      sid = supplierIdByNameKey[nameKey] ?? null;
    }
    if (!sid) {
      // No id match and no name match against any loaded supplier — route into a
      // synthetic bucket keyed by name rather than dropping the trip from every count.
      sid = nameKey ? `unlinked:${nameKey}` : 'unlinked:__unknown__';
    }
    if (!supplierIds.has(sid) && !unresolvedDisplayNameById[sid]) {
      unresolvedDisplayNameById[sid] = (t.supplier_name || '').trim() || 'Unknown Supplier';
    }
    dueFromTrips[sid] = (dueFromTrips[sid] ?? 0) + rate;
    sourced[sid] = (sourced[sid] ?? 0) + 1;
    const tripIdRef = normId((t as { id?: string | null }).id);
    const tripNoRef = normId((t as { trip_number?: string | null }).trip_number);
    const payload = { supplier_id: sid, driver_id: t.driver_id ?? null };
    if (tripIdRef) tripPartyByRef[tripIdRef] = payload;
    if (tripNoRef) tripPartyByRef[tripNoRef] = payload;
  }

  // O(tripsWhereOrgIsClient): attribute "trips where we are client" to integrated supplier by linked_organization_id.
  // Count aggregate (supplier_id) rows as well as indent-linked loads so payables stay aligned when indent_id is absent.
  const asClient = tripsWhereOrgIsClient ?? [];
  for (let i = 0; i < asClient.length; i++) {
    const t = asClient[i];
    if (isDcoOperatingTrip(t)) continue;
    if (!isLoadBasedTrip(t) && !normId(t.supplier_id)) continue;
    const ownerOrgId = t.organization_id;
    if (!ownerOrgId) continue;
    const sid = supplierIdByLinkedOrgId.get(ownerOrgId) ?? null;
    if (!sid) continue;
    const tid = (t as { id?: string }).id;
    const adj = adjustmentsForTrip(adjustmentsByTripId, tid);
    const baseAmt = Number(t.client_price ?? 0) || Number(t.supplier_rate ?? 0);
    const amount =
      adjustmentsByTripId !== undefined
        ? adjustedRevenue(baseAmt, adj)
        : baseAmt;
    dueFromTrips[sid] = (dueFromTrips[sid] ?? 0) + amount;
    sourced[sid] = (sourced[sid] ?? 0) + 1;
    const tripIdRef = normId((t as { id?: string | null }).id);
    const tripNoRef = normId((t as { trip_number?: string | null }).trip_number);
    const payload = { supplier_id: sid, driver_id: t.driver_id ?? null };
    if (tripIdRef) tripPartyByRef[tripIdRef] = payload;
    if (tripNoRef) tripPartyByRef[tripNoRef] = payload;
  }

  // O(transactions): paid from ledger (contact_type=supplier + contact_id, or tripPartyMap fallback).
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    const amtOut = Number(tx.amount_out ?? 0);
    if (!amtOut) continue;

    if (tx.contact_type === 'dco') continue;

    if (tx.contact_type === 'supplier' && tx.contact_id) {
      const raw = normId(tx.contact_id);
      const mapped = normalizedIdToRawId[raw] ?? raw;
      if (supplierIds.has(mapped)) {
        paidFromLedger[mapped] = (paidFromLedger[mapped] ?? 0) + amtOut;
        continue;
      }
      // contact_id may be the partner org's supplier uuid; fall through to tripPartyMap
    }

    const txTripIdRef = normId(tx.trip_id);
    const txTripNoRef = normId((tx as { trip_number?: string | null }).trip_number);
    const fallback =
      (tripPartyMap && tx.trip_id && tripPartyMap[tx.trip_id]) ||
      (txTripIdRef ? tripPartyByRef[txTripIdRef] : undefined) ||
      (txTripNoRef ? tripPartyByRef[txTripNoRef] : undefined);
    if (fallback) {
      const sid = fallback.supplier_id ?? fallback.driver_id ?? null;
      if (sid && supplierIds.has(sid)) {
        paidFromLedger[sid] = (paidFromLedger[sid] ?? 0) + amtOut;
      }
    }
  }

  // O(suppliers): build rows. Mirror customers: trips count, sales = supplier rate total (payables), paid, due = unsettled.
  const rows: FinancialRowData[] = [];
  let totalPayables = 0;
  let totalUnsettled = 0;

  for (let i = 0; i < suppliers.length; i++) {
    const s = suppliers[i];
    const id = s.id;
    const due = dueFromTrips[id] ?? 0;
    const paid = paidFromLedger[id] ?? 0;
    const unsettled = Math.max(0, due - paid);
    totalPayables += due;
    totalUnsettled += unsettled;
    const tripCount = sourced[id] ?? 0;
    rows.push({
      id,
      name: getSupplierDisplayName(s),
      subline: s.supplier_type === 'integrated' ? 'INTEGRATED' : s.supplier_type === 'offline' || s.supplier_type === 'marketplace' ? 'NON_INTEGRATED' : 'SECURE NODE',
      trips: tripCount,
      sourced: tripCount,
      due: unsettled,
      payables: due,
      paid,
      sales: due,
      is_integrated: s.supplier_type === 'integrated',
      linked_organization_id: s.linked_organization_id ?? undefined,
      contactPerson: (s.contact_person ?? '').trim() || undefined,
    });
  }

  // Trips whose supplier couldn't be resolved to any loaded supplier — synthesized here so
  // their payables still show up somewhere, instead of being computed and then never emitted.
  for (const [id, displayName] of Object.entries(unresolvedDisplayNameById)) {
    const due = dueFromTrips[id] ?? 0;
    const paid = paidFromLedger[id] ?? 0;
    const unsettled = Math.max(0, due - paid);
    totalPayables += due;
    totalUnsettled += unsettled;
    rows.push({
      id,
      name: displayName,
      subline: 'UNLINKED',
      trips: sourced[id] ?? 0,
      sourced: sourced[id] ?? 0,
      due: unsettled,
      payables: due,
      paid,
      sales: due,
    });
  }

  return {
    rows,
    totals: { totalIn: totalPayables, totalOut: totalUnsettled },
  };
}
