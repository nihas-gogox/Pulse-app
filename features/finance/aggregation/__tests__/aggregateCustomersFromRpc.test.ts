import { aggregateCustomersFromRpc } from '../aggregateCustomersFromRpc';
import type { ClientLike } from '../types';
import type { CustomerLedgerInputs } from '@/features/finance/services/ledgerAggregationRpc.service';

function inputs(overrides: Partial<CustomerLedgerInputs>): CustomerLedgerInputs {
  return {
    trip_inputs: [],
    unlinked_payments: [],
    ledger_only_parties: [],
    client_ledger_totals: [],
    ...overrides,
  };
}

describe('aggregateCustomersFromRpc', () => {
  const client: ClientLike = { id: 'client-1', name: 'Acme Shipping' };

  it('computes billed/pending/received for a loaded client from RPC trip inputs', () => {
    const { rows } = aggregateCustomersFromRpc(
      [client],
      inputs({
        trip_inputs: [{ client_id: 'client-1', trip_id: 'trip-1', sales: 1000, initial_paid: 400 }],
      }),
    );
    expect(rows[0].billed).toBe(1000);
    expect(rows[0].pending).toBe(600);
    expect(rows[0].received).toBe(400);
  });

  it('surfaces a client_id from the RPC that is not in the loaded (active-only) clients roster instead of dropping it', () => {
    // get_customer_ledger_inputs resolves client_id against ALL clients (including archived/
    // inactive); the `clients` array passed in here is the active-only roster. A trip
    // referencing an archived client's id must not vanish from totals.
    const { rows, totals } = aggregateCustomersFromRpc(
      [client],
      inputs({
        trip_inputs: [
          { client_id: 'client-1', trip_id: 'trip-1', sales: 1000, initial_paid: 0 },
          { client_id: 'archived-client', trip_id: 'trip-2', sales: 500, initial_paid: 0 },
        ],
      }),
    );
    expect(rows).toHaveLength(2);
    const unresolvedRow = rows.find((r) => r.id === 'archived-client');
    expect(unresolvedRow).toBeDefined();
    expect(unresolvedRow?.subline).toBe('UNLINKED');
    expect(unresolvedRow?.billed).toBe(500);
    expect(unresolvedRow?.trips).toBe(1);
    expect(totals.totalIn).toBe(1500);
  });

  it('surfaces an unresolved client referenced only via unlinked_payments', () => {
    const { rows, totals } = aggregateCustomersFromRpc(
      [client],
      inputs({
        unlinked_payments: [{ client_id: 'archived-client', transaction_id: 'tx-1', amount_in: 200 }],
      }),
    );
    const unresolvedRow = rows.find((r) => r.id === 'archived-client');
    expect(unresolvedRow).toBeDefined();
    expect(totals.totalIn).toBe(0);
  });

  it('surfaces an unresolved client referenced only via client_ledger_totals', () => {
    const { rows, totals } = aggregateCustomersFromRpc(
      [client],
      inputs({
        client_ledger_totals: [{ client_id: 'archived-client', received: 100, pending: 300 }],
      }),
    );
    const unresolvedRow = rows.find((r) => r.id === 'archived-client');
    expect(unresolvedRow).toBeDefined();
    expect(unresolvedRow?.pending).toBe(300);
    expect(unresolvedRow?.received).toBe(100);
    expect(totals.totalOut).toBe(300);
  });

  it('does not double count an unresolved client referenced by multiple input sources', () => {
    const { rows } = aggregateCustomersFromRpc(
      [client],
      inputs({
        trip_inputs: [{ client_id: 'archived-client', trip_id: 'trip-1', sales: 500, initial_paid: 0 }],
        unlinked_payments: [{ client_id: 'archived-client', transaction_id: 'tx-1', amount_in: 100 }],
      }),
    );
    expect(rows.filter((r) => r.id === 'archived-client')).toHaveLength(1);
  });
});
