/**
 * Server-side equivalent of aggregateCustomers.ts's final per-client loop
 * (lines 216-273). get_customer_ledger_inputs (unbounded) replaces the
 * client-side scan of trips/transactions; the UNCHANGED allocateAmountsToLargestDueTrips
 * allocator and the exact same per-client pending/received formula are reused
 * here verbatim — this file adds no new allocation policy. Proven equivalent
 * against aggregateCustomers.ts in scripts/finance-equivalence/customerAggregation.verify.ts
 * (60/60 passing, including the tripless-client-with-ledger-activity and
 * duplicate-name-client cases). aggregateCustomers.ts itself is left unchanged
 * and still used by connectionGoalsAnalytics.util.ts and FinanceScreen.tsx's
 * date-filtered roster report (out of scope for this cutover — see report).
 */
import type { FinancialRowData, AggregationTotals, ClientLike } from './types';
import type { CustomerLedgerInputs } from '@/features/finance/services/ledgerAggregationRpc.service';
import { allocateAmountsToLargestDueTrips } from '@/features/finance/utils/allocateToLargestDue';

function getClientDisplayName(c: ClientLike): string {
  return (c.name || c.contact_person || 'Unnamed').trim() || 'Unnamed';
}

function getClientRowName(c: ClientLike): string {
  const org = (c.name ?? '').trim();
  if (org) return org;
  return getClientDisplayName(c);
}

/** Shared per-client pending/received derivation, used for loaded clients and unresolved ids alike. */
function computeClientPendingReceived(
  id: string,
  clientTrips: { tripId: string; sales: number; initialPaid: number }[],
  billed: number,
  unlinkedByClient: Map<string, number[]>,
  ledgerTotalsByClient: Map<string, { received: number; pending: number }>,
): { pending: number; received: number } {
  if (clientTrips.length > 0) {
    const allocated = allocateAmountsToLargestDueTrips(
      clientTrips.map((t) => ({ tripId: t.tripId, sales: t.sales, paid: t.initialPaid })),
      unlinkedByClient.get(id) ?? [],
    );
    const pending = clientTrips.reduce(
      (s, t) => s + Math.max(0, t.sales - (allocated[t.tripId] ?? 0)),
      0,
    );
    return { pending, received: Math.max(0, billed - pending) };
  }
  const totals = ledgerTotalsByClient.get(id);
  const ledgerReceived = totals?.received ?? 0;
  const ledgerPending = totals?.pending ?? 0;
  return {
    pending: billed > 0 ? Math.max(0, billed - ledgerReceived) : ledgerPending,
    received: ledgerReceived,
  };
}

export function aggregateCustomersFromRpc(
  clients: readonly ClientLike[],
  inputs: CustomerLedgerInputs,
): { rows: FinancialRowData[]; totals: AggregationTotals } {
  const tripInputsByClient = new Map<
    string,
    { tripId: string; sales: number; initialPaid: number }[]
  >();
  for (const ti of inputs.trip_inputs) {
    const list = tripInputsByClient.get(ti.client_id) ?? [];
    list.push({ tripId: ti.trip_id, sales: ti.sales, initialPaid: ti.initial_paid });
    tripInputsByClient.set(ti.client_id, list);
  }
  const unlinkedByClient = new Map<string, number[]>();
  for (const u of inputs.unlinked_payments) {
    const list = unlinkedByClient.get(u.client_id) ?? [];
    list.push(u.amount_in);
    unlinkedByClient.set(u.client_id, list);
  }
  const ledgerTotalsByClient = new Map(inputs.client_ledger_totals.map((c) => [c.client_id, c]));

  const rows: FinancialRowData[] = [];
  let totalBilling = 0;
  let totalBalance = 0;
  const loadedClientIds = new Set(clients.map((c) => c.id));

  for (let i = 0; i < clients.length; i++) {
    const c = clients[i];
    const id = c.id;
    const clientTrips = tripInputsByClient.get(id) ?? [];
    const billed = clientTrips.reduce((s, t) => s + t.sales, 0);
    const { pending, received } = computeClientPendingReceived(
      id,
      clientTrips,
      billed,
      unlinkedByClient,
      ledgerTotalsByClient,
    );

    totalBilling += billed;
    totalBalance += pending;

    rows.push({
      id,
      name: getClientRowName(c),
      subline: c.is_integrated === true ? 'INTEGRATED' : c.is_integrated === false ? 'NON_INTEGRATED' : 'SECURE NODE',
      trips: clientTrips.length,
      received,
      pending,
      billed,
      is_integrated: c.is_integrated ?? false,
      linked_organization_id: c.linked_organization_id ?? undefined,
      contactPercent: c.contact_percent ?? undefined,
      contactPerson: (c.contact_person ?? '').trim() || undefined,
    });
  }

  // get_customer_ledger_inputs resolves client_id against ALL clients (including archived/
  // inactive), but `clients` here is the active-only roster (get_clients_with_profiles). A
  // client_id referenced by a trip/payment/ledger total that fell outside that active roster
  // was previously read into the maps above and then never iterated — money silently missing
  // from both the row list and the totals. Surface it as its own row instead.
  const unresolvedIds = new Set<string>();
  for (const id of tripInputsByClient.keys()) if (!loadedClientIds.has(id)) unresolvedIds.add(id);
  for (const id of unlinkedByClient.keys()) if (!loadedClientIds.has(id)) unresolvedIds.add(id);
  for (const id of ledgerTotalsByClient.keys()) if (!loadedClientIds.has(id)) unresolvedIds.add(id);

  for (const id of unresolvedIds) {
    const clientTrips = tripInputsByClient.get(id) ?? [];
    const billed = clientTrips.reduce((s, t) => s + t.sales, 0);
    const { pending, received } = computeClientPendingReceived(
      id,
      clientTrips,
      billed,
      unlinkedByClient,
      ledgerTotalsByClient,
    );

    totalBilling += billed;
    totalBalance += pending;

    rows.push({
      id,
      name: 'Unknown Customer',
      subline: 'UNLINKED',
      trips: clientTrips.length,
      received,
      pending,
      billed,
    });
  }

  for (const p of inputs.ledger_only_parties) {
    totalBalance += p.pending;
    rows.push({
      id: `ledger-party-${p.party_name.trim().toLowerCase()}`,
      name: p.party_name,
      subline: 'LEDGER',
      trips: 0,
      received: p.received,
      pending: p.pending,
    });
  }

  return {
    rows,
    totals: { totalIn: totalBilling, totalOut: totalBalance },
  };
}
