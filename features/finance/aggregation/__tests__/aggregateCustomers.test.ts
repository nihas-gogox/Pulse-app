import { aggregateCustomers } from '../aggregateCustomers';
import type { ClientLike, LedgerTx, TripForCustomer } from '../types';

describe('aggregateCustomers — client paid-amount double-count regression', () => {
  const client: ClientLike = { id: 'client-1', name: 'Acme Shipping' };

  it('does not double-count a linked client transaction on top of an already ledger-synced amount_paid', () => {
    // Trip billed 1000, half paid (amount_paid is ledger-synced and already reflects the
    // linked transaction below). Before the fix, seeding paidByTripId from amount_paid AND
    // adding the linked transaction's amount_in on top made this trip look fully paid.
    const trip: TripForCustomer = {
      id: 'trip-1',
      client_id: client.id,
      client_name: client.name ?? null,
      client_price: 1000,
      amount_paid: 500,
    };
    const transactions: LedgerTx[] = [
      { contact_id: client.id, contact_type: 'client', trip_id: 'trip-1', amount_in: 500 },
    ];

    const { rows } = aggregateCustomers([client], [trip], transactions);

    expect(rows).toHaveLength(1);
    expect(rows[0].billed).toBe(1000);
    // The real outstanding balance is 500 — a partially-paid trip must not appear fully paid.
    expect(rows[0].pending).toBe(500);
    expect(rows[0].received).toBe(500);
  });

  it('still counts the full amount_paid when there is no linked client transaction', () => {
    const trip: TripForCustomer = {
      id: 'trip-2',
      client_id: client.id,
      client_name: client.name ?? null,
      client_price: 1000,
      amount_paid: 1000,
    };

    const { rows } = aggregateCustomers([client], [trip], []);

    expect(rows[0].pending).toBe(0);
    expect(rows[0].received).toBe(1000);
  });
});

describe('aggregateCustomers — unresolved-client trips are no longer silently dropped', () => {
  const client: ClientLike = { id: 'client-1', name: 'Acme Shipping' };

  it('surfaces a trip whose client_id is not in the loaded clients list as its own row instead of dropping it', () => {
    // client-1 is loaded; client-2 is a real client id (e.g. archived, cross-org, RLS-filtered)
    // that never made it into the `clients` array passed in.
    const knownTrip: TripForCustomer = {
      id: 'trip-1',
      client_id: client.id,
      client_name: client.name,
      client_price: 1000,
      amount_paid: 0,
    };
    const orphanTrip: TripForCustomer = {
      id: 'trip-2',
      client_id: 'client-2',
      client_name: 'Ghost Client Co',
      client_price: 500,
      amount_paid: 0,
    };

    const { rows, totals } = aggregateCustomers([client], [knownTrip, orphanTrip], []);

    expect(rows).toHaveLength(2);
    const orphanRow = rows.find((r) => r.name === 'Ghost Client Co');
    expect(orphanRow).toBeDefined();
    expect(orphanRow?.subline).toBe('UNLINKED');
    expect(orphanRow?.trips).toBe(1);
    expect(orphanRow?.billed).toBe(500);
    expect(orphanRow?.pending).toBe(500);
    // Totals must include the orphaned trip too, not just the known client.
    expect(totals.totalIn).toBe(1500);
  });

  it('surfaces a trip with no client_id and no name match against any loaded client', () => {
    const unmatchedTrip: TripForCustomer = {
      id: 'trip-3',
      client_id: null,
      client_name: 'Totally Unknown Shipper',
      client_price: 750,
      amount_paid: 0,
    };

    const { rows } = aggregateCustomers([client], [unmatchedTrip], []);

    expect(rows).toHaveLength(2);
    const unlinkedRow = rows.find((r) => r.name === 'Totally Unknown Shipper');
    expect(unlinkedRow).toBeDefined();
    expect(unlinkedRow?.subline).toBe('UNLINKED');
    expect(unlinkedRow?.trips).toBe(1);
    expect(unlinkedRow?.billed).toBe(750);
  });

  it('groups multiple unresolved trips with the same client_name into one row', () => {
    const tripA: TripForCustomer = {
      id: 'trip-4',
      client_id: null,
      client_name: 'Repeat Shipper',
      client_price: 100,
      amount_paid: 0,
    };
    const tripB: TripForCustomer = {
      id: 'trip-5',
      client_id: null,
      client_name: 'Repeat Shipper',
      client_price: 200,
      amount_paid: 0,
    };

    const { rows } = aggregateCustomers([client], [tripA, tripB], []);

    const grouped = rows.find((r) => r.name === 'Repeat Shipper');
    expect(grouped).toBeDefined();
    expect(grouped?.trips).toBe(2);
    expect(grouped?.billed).toBe(300);
  });
});
