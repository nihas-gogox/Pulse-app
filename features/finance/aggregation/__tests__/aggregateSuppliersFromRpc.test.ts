import { aggregateSuppliersFromRpc } from '../aggregateSuppliersFromRpc';
import type { SupplierLike } from '../types';
import type { SupplierLedgerAggregationRow } from '@/features/finance/services/ledgerAggregationRpc.service';

describe('aggregateSuppliersFromRpc', () => {
  const supplier: SupplierLike = { id: 'sup-1', name: 'Acme Logistics' };

  it('decorates a loaded supplier with its RPC financials', () => {
    const rpcRows: SupplierLedgerAggregationRow[] = [
      { supplier_id: 'sup-1', trips_count: 3, due: 1000, paid: 400, unsettled: 600 },
    ];
    const { rows } = aggregateSuppliersFromRpc([supplier], rpcRows);
    expect(rows[0].payables).toBe(1000);
    expect(rows[0].paid).toBe(400);
    expect(rows[0].due).toBe(600);
  });

  it('surfaces a supplier_id from the RPC that is not in the loaded (active-only) suppliers roster instead of dropping it', () => {
    const rpcRows: SupplierLedgerAggregationRow[] = [
      { supplier_id: 'sup-1', trips_count: 1, due: 1000, paid: 0, unsettled: 1000 },
      { supplier_id: 'archived-supplier', trips_count: 2, due: 500, paid: 100, unsettled: 400 },
    ];
    const { rows, totals } = aggregateSuppliersFromRpc([supplier], rpcRows);
    expect(rows).toHaveLength(2);
    const unresolvedRow = rows.find((r) => r.id === 'archived-supplier');
    expect(unresolvedRow).toBeDefined();
    expect(unresolvedRow?.subline).toBe('UNLINKED');
    expect(unresolvedRow?.payables).toBe(500);
    expect(unresolvedRow?.due).toBe(400);
    expect(unresolvedRow?.trips).toBe(2);
    expect(totals.totalIn).toBe(1500);
    expect(totals.totalOut).toBe(1400);
  });
});
