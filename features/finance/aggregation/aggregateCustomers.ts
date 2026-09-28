/**
 * O(n) customer aggregation. Single source: received = ledger only; billed = trips only, never
 * pre-trip indents (a client isn't liable for a shipment until it's allocated — same rule
 * aggregateSuppliers.ts already follows for payables). Pending = sum of per-trip due (aligns with
 * ClientDetailScreen). Overpayment on one trip does not reduce due on another. Ledger-only parties:
 * pending from amount_out. Per-trip attribution: amount_in with trip_id → that trip; unlinked
 * client tx → trip with largest due.
 */
import type { FinancialRowData, AggregationTotals } from './types';
import type { LedgerTx, TripForCustomer, ClientLike, TripPartyMap } from './types';
import { adjustedRevenue } from '@/features/trips/services/tripAdjustments';
import type { TripAdjustment } from '@/features/trips/services/tripAdjustments';
import { buildUniqueLinkedOrgIdMap, isLoadBasedTrip } from '@/features/trips/visibility/tripVisibility';
import { allocateAmountsToLargestDueTrips } from '@/features/finance/utils/allocateToLargestDue';
import { computeLedgerDerivedPaidSeed } from '@/features/finance/utils/ledgerDerivedPaidSeed.util';

function toNameKey(name: string): string {
  return (name || '').toLowerCase().trim();
}

function normId(id: string | null | undefined): string {
  return id == null ? '' : String(id).trim().toLowerCase();
}

function getClientDisplayName(c: ClientLike): string {
  return (c.name || c.contact_person || 'Unnamed').trim() || 'Unnamed';
}

/** Line 1: org name when present, else display name. Contact person is shown on line 2 (contactPerson). */
function getClientRowName(c: ClientLike): string {
  const org = (c.name ?? '').trim();
  if (org) return org;
  return getClientDisplayName(c);
}

/** Per-trip data for a client. */
interface ClientTripInfo {
  tripId: string;
  sales: number;
  amountPaid: number;
}

function adjustmentsForTrip(
  adjustmentsByTripId: Record<string, TripAdjustment[]> | undefined,
  tripId: string | undefined,
): TripAdjustment[] {
  if (!adjustmentsByTripId || !tripId) return [];
  return adjustmentsByTripId[normId(tripId)] ?? [];
}

export function aggregateCustomers(
  clients: readonly ClientLike[],
  trips: readonly TripForCustomer[],
  transactions: readonly LedgerTx[],
  tripPartyMap?: TripPartyMap | null,
  /** When provided, billed amounts match trip detail / Adjustment Registry (revenue adjustments). */
  adjustmentsByTripId?: Record<string, TripAdjustment[]>,
): { rows: FinancialRowData[]; totals: AggregationTotals } {
  const ledgerByClientId: Record<string, { received: number; pending: number }> = {};
  const ledgerByPartyName: Record<string, { displayName: string; received: number; pending: number }> = {};

  // Single pass: ledger (customer-related only). Received = amount_in, pending = amount_out.
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (tx.contact_type === 'driver' || tx.contact_type === 'supplier') continue;
    if (tx.contact_type !== 'client') continue;

    const amtIn = Number(tx.amount_in ?? 0);
    const amtOut = Number(tx.amount_out ?? 0);

    if (tx.contact_type === 'client' && tx.contact_id) {
      const cid = tx.contact_id;
      if (!ledgerByClientId[cid]) ledgerByClientId[cid] = { received: 0, pending: 0 };
      ledgerByClientId[cid].received += amtIn;
      ledgerByClientId[cid].pending += amtOut;
    } else if (
      tx.contact_type === 'client' &&
      tx.trip_id &&
      tripPartyMap &&
      tripPartyMap[tx.trip_id]?.client_id
    ) {
      // Fallback: client tx with trip_id but no contact_id → attribute to trip's client. Non-client tx (e.g. vehicle maintenance) must not inflate customer due.
      const cid = tripPartyMap[tx.trip_id]!.client_id!;
      if (!ledgerByClientId[cid]) ledgerByClientId[cid] = { received: 0, pending: 0 };
      ledgerByClientId[cid].received += amtIn;
      ledgerByClientId[cid].pending += amtOut;
    } else {
      const name = (tx.party_name || '').trim() || '—';
      if (name !== '—') {
        const key = toNameKey(name);
        if (!ledgerByPartyName[key]) ledgerByPartyName[key] = { displayName: name, received: 0, pending: 0 };
        ledgerByPartyName[key].received += amtIn;
        ledgerByPartyName[key].pending += amtOut;
      }
    }
  }

  const clientNameKeys = new Set<string>();
  const clientIdByNameKey: Record<string, string> = {};
  const localClientIdSet = new Set<string>();
  for (let i = 0; i < clients.length; i++) {
    const k = toNameKey(getClientDisplayName(clients[i]));
    if (k) {
      clientNameKeys.add(k);
      clientIdByNameKey[k] = clients[i].id;
    }
    localClientIdSet.add(clients[i].id);
  }
  const linkedClientIdByOrgId = buildUniqueLinkedOrgIdMap(clients);

  const tripCount: Record<string, number> = {};
  const billedByClientId: Record<string, number> = {};
  const tripsByClientId: Record<string, ClientTripInfo[]> = {};
  for (let i = 0; i < clients.length; i++) {
    const id = clients[i].id;
    tripCount[id] = 0;
    billedByClientId[id] = 0;
    tripsByClientId[id] = [];
  }
  // Trips whose client resolves to an id outside the loaded `clients` list (archived/soft-deleted
  // client, cross-org id, RLS-filtered) or that can't be resolved to any client at all. Tracked so a
  // row can still be synthesized for them below instead of the trip silently vanishing from every count.
  const unresolvedDisplayNameById: Record<string, string> = {};

  // Single pass: trips -> billed, trip count, and per-trip list per client.
  // Priority:
  // 1) Supplier view (integrated): when we are the carrier, attribute to the shipper org's local client
  //    match using linked_organization_id === trip.organization_id. Prefer this for load-based trips
  //    where the trip.client_id/name is usually the shipper's end customer.
  // 2) Trip owner view: attribute by client_id (or by name fallback) using client_price.
  for (let i = 0; i < trips.length; i++) {
    const t = trips[i];
    const nameKey = toNameKey(t.client_name || '');

    let clientId: string | null | undefined = null;
    let useSupplierRate = false;

    // 1) Integration check: for load-based trips, check if originating org maps to a local client.
    if (t.organization_id && isLoadBasedTrip(t)) {
      const linkedClientId = linkedClientIdByOrgId.get(t.organization_id) ?? null;
      if (linkedClientId) {
        clientId = linkedClientId;
        useSupplierRate = true;
      }
    }

    // 2) Direct client on trip fallback (trip owner perspective or if no integration mapping).
    if (clientId == null) {
      clientId =
        t.client_id ??
        (nameKey ? clientIdByNameKey[nameKey] : undefined);
    }

    // Trip's client couldn't be resolved to any known client id (no client_id match and no client_name
    // match against a loaded client). Route into a synthetic bucket keyed by name rather than dropping
    // the trip from every count with no visible trace.
    if (clientId == null) {
      clientId = nameKey ? `unlinked:${nameKey}` : 'unlinked:__unknown__';
    }

    // Trips can reference a client_id that's not present in the loaded clients list (e.g. cross-org
    // trips, archived/soft-deleted clients, or the synthetic unlinked bucket above). Record a display
    // name so a row can still be synthesized for it below. Ensure per-client buckets exist before
    // incrementing/pushing.
    if (!localClientIdSet.has(clientId) && !unresolvedDisplayNameById[clientId]) {
      unresolvedDisplayNameById[clientId] = (t.client_name || '').trim() || 'Unknown Customer';
    }
    if (!tripsByClientId[clientId]) tripsByClientId[clientId] = [];

    // 3) Only use supplier_rate when we are the supplier (linkedClient match). For trips we own (client_id/name
    //    match), always use client_price — even if trip has indent_id. Client Detail uses same rule.
    //    Removed: if (t.indent_id != null) useSupplierRate = true — that incorrectly used supplier_rate for
    //    our own indent-origin trips, causing billing/due mismatch (e.g. 44k vs 47k, 21k vs 24k).
    const baseBilled = useSupplierRate
      ? Number(t.supplier_rate ?? 0)
      : Number(t.client_price ?? 0);
    const adj = adjustmentsForTrip(adjustmentsByTripId, (t as { id?: string }).id);
    const billedAmount =
      adjustmentsByTripId !== undefined
        ? adjustedRevenue(baseBilled, adj)
        : baseBilled;

    tripCount[clientId] = (tripCount[clientId] ?? 0) + 1;

    const tripId = normId((t as { id?: string }).id);
    if (tripId) {
      tripsByClientId[clientId].push({
        tripId,
        sales: billedAmount,
        amountPaid: Number((t as { amount_paid?: number }).amount_paid ?? 0),
      });
    }

    if (billedAmount > 0) {
      billedByClientId[clientId] = (billedByClientId[clientId] ?? 0) + billedAmount;
    }
  }

  // Client revenue/liability is recognized from trips only, never from an indent that hasn't
  // been allocated/converted to one yet — same rule aggregateSuppliers.ts already follows
  // ("Supplier payables are from trips only — not from awarded indents before conversion").
  // A client isn't liable for a shipment until it's actually been allocated; an open indent is
  // just a request.

  // Build trip ID sets per client for per-trip attribution.
  const tripIdsByClientId: Record<string, Set<string>> = {};
  for (const [cid, list] of Object.entries(tripsByClientId)) {
    tripIdsByClientId[cid] = new Set(list.map((x) => x.tripId));
  }

  const rows: FinancialRowData[] = [];
  let totalBilling = 0;
  let totalBalance = 0;

  /** Shared pending/received derivation, used both for loaded clients and synthesized unresolved rows. */
  function computeClientPendingReceived(id: string, nameKey: string): { pending: number; received: number } {
    const fromLedgerId = ledgerByClientId[id];
    const fromLedgerName = ledgerByPartyName[nameKey];

    const billed = billedByClientId[id] ?? 0;
    const ledgerReceived = (fromLedgerId?.received ?? 0) + (fromLedgerName?.received ?? 0);
    const pendingLedger = (fromLedgerId?.pending ?? 0) + (fromLedgerName?.pending ?? 0);
    const clientTrips = tripsByClientId[id] ?? [];
    const clientTripIds = tripIdsByClientId[id];

    let pending: number;
    if (clientTrips.length > 0 && clientTripIds) {
      // Per-trip attribution (aligns with ClientDetailScreen): overpayment on one trip does not reduce due on another.
      const isClientTx = (tx: LedgerTx) =>
        (tx.contact_id && tx.contact_id === id) ||
        (nameKey && (tx.party_name ?? '').trim().toLowerCase() === nameKey) ||
        (tx.trip_id && tripPartyMap?.[tx.trip_id]?.client_id === id);

      // amount_paid is ledger-synced (trg_sync_trip_payment_status) to already include any linked
      // client transaction's amount_in — seeding from it unconditionally AND adding amount_in below
      // double-counts. Pre-scan which trips have a linked client tx so the seed can be reset to 0 for
      // those, matching computeClientPaidSeed's rule in ClientDetailScreen.
      const tripIdsWithLinkedClientTx = new Set<string>();
      for (let ti = 0; ti < transactions.length; ti++) {
        const tx = transactions[ti];
        if (tx.contact_type !== 'client' || !isClientTx(tx)) continue;
        const normalizedTripId = normId(tx.trip_id);
        if (normalizedTripId && clientTripIds.has(normalizedTripId)) {
          tripIdsWithLinkedClientTx.add(normalizedTripId);
        }
      }

      const paidByTripId: Record<string, number> = {};
      for (const ct of clientTrips) {
        paidByTripId[ct.tripId] = computeLedgerDerivedPaidSeed({
          amountPaid: ct.amountPaid,
          hasLinkedTransaction: tripIdsWithLinkedClientTx.has(ct.tripId),
        });
      }
      const unlinkedClientAmounts: number[] = [];
      for (let ti = 0; ti < transactions.length; ti++) {
        const tx = transactions[ti];
        if (tx.contact_type === 'driver' || tx.contact_type === 'supplier') continue;
        if (tx.contact_type !== 'client') continue;
        if (!isClientTx(tx)) continue;
        const normalizedTripId = normId(tx.trip_id);
        const txTripKey = normalizedTripId && clientTripIds.has(normalizedTripId) ? normalizedTripId : undefined;
        if (txTripKey !== undefined) {
          paidByTripId[txTripKey] = (paidByTripId[txTripKey] ?? 0) + Number(tx.amount_in ?? 0);
        } else {
          unlinkedClientAmounts.push(Number(tx.amount_in ?? 0));
        }
      }
      const allocatedPaidByTripId = allocateAmountsToLargestDueTrips(
        clientTrips.map((ct) => ({
          tripId: ct.tripId,
          sales: ct.sales,
          paid: paidByTripId[ct.tripId] ?? 0,
        })),
        unlinkedClientAmounts,
      );
      pending = clientTrips.reduce(
        (sum, ct) => sum + Math.max(0, ct.sales - (allocatedPaidByTripId[ct.tripId] ?? 0)),
        0,
      );
    } else {
      // No trips with ids (indent-only or ledger-only): use legacy formula.
      pending = billed > 0 ? Math.max(0, billed - ledgerReceived) : pendingLedger;
    }

    // For clients with trips: derive received = billed - pending (matches ClientDetailScreen formula).
    // For ledger-only parties (no trips): use actual ledger payment data.
    const received = clientTrips.length > 0
      ? Math.max(0, billed - pending)
      : ledgerReceived;

    return { pending, received };
  }

  for (let i = 0; i < clients.length; i++) {
    const c = clients[i];
    const id = c.id;
    const displayName = getClientDisplayName(c);
    const nameKey = toNameKey(displayName);
    const billed = billedByClientId[id] ?? 0;
    const { pending, received } = computeClientPendingReceived(id, nameKey);

    totalBilling += billed;
    totalBalance += pending;

    rows.push({
      id,
      name: getClientRowName(c),
      subline: c.is_integrated === true ? 'INTEGRATED' : c.is_integrated === false ? 'NON_INTEGRATED' : 'SECURE NODE',
      trips: tripCount[id] ?? 0,
      received,
      pending,
      billed,
      is_integrated: c.is_integrated ?? false,
      linked_organization_id: c.linked_organization_id ?? undefined,
      contactPercent: c.contact_percent ?? undefined,
      contactPerson: (c.contact_person ?? '').trim() || undefined,
    });
  }

  // Trips whose client id fell outside the loaded `clients` list (or couldn't be resolved to a
  // client id at all) — synthesized here so their revenue/trip-count still shows up somewhere,
  // instead of being counted internally but never emitted as a row.
  for (const [id, displayName] of Object.entries(unresolvedDisplayNameById)) {
    const nameKey = toNameKey(displayName);
    const billed = billedByClientId[id] ?? 0;
    const { pending, received } = computeClientPendingReceived(id, nameKey);

    totalBilling += billed;
    totalBalance += pending;

    rows.push({
      id,
      name: displayName,
      subline: 'UNLINKED',
      trips: tripCount[id] ?? 0,
      received,
      pending,
      billed,
    });
  }

  for (const [key, tot] of Object.entries(ledgerByPartyName)) {
    if (clientNameKeys.has(key)) continue;
    totalBalance += tot.pending;
    rows.push({
      id: `ledger-party-${key}`,
      name: tot.displayName,
      subline: 'LEDGER',
      trips: 0,
      received: tot.received,
      pending: tot.pending,
    });
  }

  return {
    rows,
    totals: { totalIn: totalBilling, totalOut: totalBalance },
  };
}
