/**
 * Covers the confirmed release blocker: the Cash tab's headline totals
 * (ledgerTotalsData) were computed from getTransactionsByOrganization's
 * .limit(500) fetch, so any organization with more than 500 transactions
 * saw a silently wrong total. Fixed by computing ledgerTotalsData from a
 * separate, unbounded, join-free fetch (useTransactionTotalsQuery), while
 * the displayed/paginated ledger list keeps using the capped fetch. These
 * tests prove the headline total reflects the full transaction set even
 * when the display list is capped short of it.
 */
jest.mock("@/lib/queries/useTransactionsQuery", () => ({
  useTransactionsQuery: (...args: unknown[]) => mockUseTransactionsQuery(...args),
  useTransactionTotalsQuery: (...args: unknown[]) => mockUseTransactionTotalsQuery(...args),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

const mockUseTransactionsQuery = jest.fn();
const mockUseTransactionTotalsQuery = jest.fn();

import { renderHook } from "@testing-library/react-native";
import { useFinanceLedger } from "../useFinanceLedger";
import type { LedgerRow } from "../../services/finance.service";

function ledgerRow(id: string, amountIn: number, amountOut: number): LedgerRow {
  return {
    id,
    organization_id: "org-1",
    trip_id: null,
    party_name: `Party ${id}`,
    description: null,
    amount_in: amountIn,
    amount_out: amountOut,
    transaction_date: "2026-09-01",
    created_at: "2026-09-01T00:00:00Z",
    contact_id: null,
    contact_type: null,
    ledger_entity_type: null,
    ledger_flow_type: null,
    ledger_category: null,
  } as unknown as LedgerRow;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useFinanceLedger — Cash headline totals for orgs with >500 transactions", () => {
  it("computes ledgerTotalsData from the unbounded fetch, not the capped display list", () => {
    // Simulate an org with 600 real transactions: the capped display fetch
    // only returns the most recent 500 (amount_in=1 each -> 500 total),
    // while the unbounded totals fetch returns the full 600 (amount_in=1
    // each -> 600 total). The old, broken behavior summed the capped list.
    const cappedDisplayRows = Array.from({ length: 500 }, (_, i) => ledgerRow(`d${i}`, 1, 0));
    const unboundedTotalsRows = Array.from({ length: 600 }, (_, i) => ledgerRow(`t${i}`, 1, 0));

    mockUseTransactionsQuery.mockReturnValue({
      data: cappedDisplayRows,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isFetching: false,
    });
    mockUseTransactionTotalsQuery.mockReturnValue({ data: unboundedTotalsRows });

    const { result } = renderHook(() =>
      useFinanceLedger({
        organizationId: "org-1",
        canAccess: true,
        tripRows: [],
        vehicleRows: [],
        clients: [],
        suppliers: [],
      }),
    );

    // The displayed/paginated list still reflects the capped fetch.
    expect(result.current.filteredLedgerBySource).toHaveLength(500);
    // The headline total reflects the full, unbounded set — not 500.
    expect(result.current.ledgerTotalsData.totalIn).toBe(600);
  });

  it("falls back to zero totals (not an error) when the totals fetch hasn't resolved yet", () => {
    mockUseTransactionsQuery.mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isFetching: false,
    });
    mockUseTransactionTotalsQuery.mockReturnValue({ data: undefined });

    const { result } = renderHook(() =>
      useFinanceLedger({
        organizationId: "org-1",
        canAccess: true,
        tripRows: [],
        vehicleRows: [],
        clients: [],
        suppliers: [],
      }),
    );

    expect(result.current.ledgerTotalsData).toEqual({ totalIn: 0, totalOut: 0 });
  });
});
