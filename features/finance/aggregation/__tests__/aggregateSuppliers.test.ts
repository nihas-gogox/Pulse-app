import { aggregateSuppliers } from '../aggregateSuppliers';
import type { SupplierLike, TripForSupplier, LedgerTx } from '../types';

describe('aggregateSuppliers', () => {
  const supplier: SupplierLike = { id: 'sup-1', name: 'Acme Logistics' } as SupplierLike;

  it('computes due from trip supplier_rate and paid from ledger, matched by supplier_id', () => {
    const trips: TripForSupplier[] = [{ id: 'trip-1', supplier_id: 'sup-1', supplier_rate: 1000 } as TripForSupplier];
    const transactions: LedgerTx[] = [
      { contact_type: 'supplier', contact_id: 'sup-1', amount_out: 400 } as LedgerTx,
    ];
    const { rows } = aggregateSuppliers([supplier], trips, transactions);
    expect(rows[0].payables).toBe(1000);
    expect(rows[0].paid).toBe(400);
    expect(rows[0].due).toBe(600);
  });

  it('matches a trip to a supplier by name when supplier_id is absent (e.g. synced trips)', () => {
    const trips: TripForSupplier[] = [
      { id: 'trip-1', supplier_id: null, supplier_name: 'Acme Logistics', supplier_rate: 500 } as TripForSupplier,
    ];
    const { rows } = aggregateSuppliers([supplier], trips, []);
    expect(rows[0].payables).toBe(500);
  });

  it('never lets an unsettled balance go negative when paid exceeds due', () => {
    const trips: TripForSupplier[] = [{ id: 'trip-1', supplier_id: 'sup-1', supplier_rate: 100 } as TripForSupplier];
    const transactions: LedgerTx[] = [
      { contact_type: 'supplier', contact_id: 'sup-1', amount_out: 500 } as LedgerTx,
    ];
    const { rows } = aggregateSuppliers([supplier], trips, transactions);
    expect(rows[0].due).toBe(0);
  });

  it('marks the supplier subline as INTEGRATED / NON_INTEGRATED based on supplier_type', () => {
    const integrated: SupplierLike = { id: 'sup-1', name: 'A', supplier_type: 'integrated' } as SupplierLike;
    const offline: SupplierLike = { id: 'sup-2', name: 'B', supplier_type: 'offline' } as SupplierLike;
    const { rows } = aggregateSuppliers([integrated, offline], [], []);
    expect(rows[0].subline).toBe('INTEGRATED');
    expect(rows[1].subline).toBe('NON_INTEGRATED');
  });

  it('surfaces a trip that cannot be matched to any known supplier as its own row instead of dropping it', () => {
    const trips: TripForSupplier[] = [
      { id: 'trip-1', supplier_id: 'unknown', supplier_name: 'Unknown Co', supplier_rate: 999 } as TripForSupplier,
    ];
    const { rows, totals } = aggregateSuppliers([supplier], trips, []);
    expect(rows).toHaveLength(2);
    expect(rows[0].payables).toBe(0);
    const unlinkedRow = rows.find((r) => r.name === 'Unknown Co');
    expect(unlinkedRow).toBeDefined();
    expect(unlinkedRow?.subline).toBe('UNLINKED');
    expect(unlinkedRow?.trips).toBe(1);
    expect(unlinkedRow?.payables).toBe(999);
    // Totals must include the unresolved trip too, not just the known supplier.
    expect(totals.totalIn).toBe(999);
  });

  it('groups multiple unresolved trips with the same supplier_name into one row', () => {
    const trips: TripForSupplier[] = [
      { id: 'trip-a', supplier_id: null, supplier_name: 'Repeat Carrier', supplier_rate: 100 } as TripForSupplier,
      { id: 'trip-b', supplier_id: null, supplier_name: 'Repeat Carrier', supplier_rate: 200 } as TripForSupplier,
    ];
    const { rows } = aggregateSuppliers([supplier], trips, []);
    const grouped = rows.find((r) => r.name === 'Repeat Carrier');
    expect(grouped).toBeDefined();
    expect(grouped?.trips).toBe(2);
    expect(grouped?.payables).toBe(300);
  });

  it('surfaces a trip with no supplier_id and no name match against any loaded supplier', () => {
    const trips: TripForSupplier[] = [
      { id: 'trip-1', supplier_id: null, supplier_name: null, supplier_rate: 750 } as unknown as TripForSupplier,
    ];
    const { rows } = aggregateSuppliers([supplier], trips, []);
    const unlinkedRow = rows.find((r) => r.name === 'Unknown Supplier');
    expect(unlinkedRow).toBeDefined();
    expect(unlinkedRow?.payables).toBe(750);
  });

  it('does not fold DCO settlement into a normal supplier row', () => {
    const trips: TripForSupplier[] = [
      {
        id: 'trip-dco',
        supplier_id: null,
        supplier_name: 'Acme Logistics',
        supplier_rate: 36500,
        operating_mode: 'DCO',
      } as TripForSupplier,
    ];
    const transactions: LedgerTx[] = [
      { contact_type: 'dco', contact_id: 'payee-1', amount_out: 1000 } as LedgerTx,
    ];
    const { rows, totals } = aggregateSuppliers([supplier], trips, transactions);
    expect(rows[0].payables).toBe(0);
    expect(rows[0].paid).toBe(0);
    expect(totals.totalIn).toBe(0);
  });
});
