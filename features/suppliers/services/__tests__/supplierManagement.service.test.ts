/**
 * Regression coverage for the 9836745 fix: getSupplierManagementBundle had
 * dropped its transactions fetch (hardcoded to []) and narrowed its trips
 * fetch to id/supplier_rate while force-casting the result to the full
 * TripRow[] type. This silently zeroed the Supplier Profile Overview
 * (Payable/Paid/Completed KPIs) and Supplier Finance tab (totals, aging,
 * ledger) for every supplier. These tests prove the bundle carries real
 * transaction data and the trip fields those panels actually read
 * (status, supplier_rate), without relying on any unsafe cast.
 */
jest.mock("@/lib/supabase", () => ({
  supabase: () => ({ rpc: mockRpc }),
}));
jest.mock("@/features/suppliers/services/suppliers.service", () => ({
  getSupplierById: (...args: unknown[]) => mockGetSupplierById(...args),
  getSupplierDetails: (...args: unknown[]) => mockGetSupplierDetails(...args),
  mergeSupplierDisplayFields: (base: unknown) => base,
}));
jest.mock("@/features/trips/services/trips.service", () => ({
  getTripsBySupplierForOrg: (...args: unknown[]) => mockGetTripsBySupplierForOrg(...args),
}));
jest.mock("@/features/finance/services/finance.service", () => ({
  getTransactionsByOrganization: (...args: unknown[]) => mockGetTransactionsByOrganization(...args),
}));

const mockRpc = jest.fn();
const mockGetSupplierById = jest.fn();
const mockGetSupplierDetails = jest.fn();
const mockGetTripsBySupplierForOrg = jest.fn();
const mockGetTransactionsByOrganization = jest.fn();

import { getSupplierManagementBundle } from "../supplierManagement.service";
import { buildSupplierPerformanceFromTrips } from "@/features/suppliers/types/supplierManagement.types";

const SUPPLIER = { id: "sup-1", name: "Acme Logistics", created_at: "2026-01-01T00:00:00Z" };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetSupplierById.mockResolvedValue({ error: null, supplier: SUPPLIER });
  mockGetSupplierDetails.mockResolvedValue({ error: null, supplier: null });
  mockGetTripsBySupplierForOrg.mockResolvedValue({ error: null, trips: [] });
  mockGetTransactionsByOrganization.mockResolvedValue({ error: null, transactions: [] });
  mockRpc.mockResolvedValue({ data: [], error: null });
});

describe("getSupplierManagementBundle — transactions restored", () => {
  it("returns the organization's real transactions, not an empty array", async () => {
    const transactions = [
      { id: "tx-1", amount_in: 0, amount_out: 5000, transaction_date: "2026-09-01", created_at: "2026-09-01" },
      { id: "tx-2", amount_in: 3000, amount_out: 0, transaction_date: "2026-09-05", created_at: "2026-09-05" },
    ];
    mockGetTransactionsByOrganization.mockResolvedValue({ error: null, transactions });

    const { error, bundle } = await getSupplierManagementBundle("org-1", "sup-1");

    expect(error).toBeNull();
    expect(mockGetTransactionsByOrganization).toHaveBeenCalledWith("org-1");
    expect(bundle?.transactions).toBe(transactions);

    // Supplier Profile Overview KPI math (SupplierProfilePanels.tsx) must be
    // computable from what the bundle returns.
    const totalPayable = bundle!.transactions
      .filter((tx) => (tx.amount_out ?? 0) > (tx.amount_in ?? 0))
      .reduce((s, tx) => s + ((tx.amount_out ?? 0) - (tx.amount_in ?? 0)), 0);
    const totalPaid = bundle!.transactions
      .filter((tx) => (tx.amount_in ?? 0) > 0)
      .reduce((s, tx) => s + (tx.amount_in ?? 0), 0);
    expect(totalPayable).toBe(5000);
    expect(totalPaid).toBe(3000);
  });

  it("still returns an empty transactions array (not an error) when the org genuinely has none", async () => {
    mockGetTransactionsByOrganization.mockResolvedValue({ error: null, transactions: [] });

    const { error, bundle } = await getSupplierManagementBundle("org-1", "sup-1");

    expect(error).toBeNull();
    expect(bundle?.transactions).toEqual([]);
  });
});

describe("getSupplierManagementBundle — trips carry the fields Overview/Finance need", () => {
  it("passes through status and supplier_rate without any unsafe cast", async () => {
    const trips = [
      { id: "trip-1", status: "completed", supplier_rate: 12000 },
      { id: "trip-2", status: "assigned", supplier_rate: 8000 },
    ];
    mockGetTripsBySupplierForOrg.mockResolvedValue({ error: null, trips });

    const { bundle } = await getSupplierManagementBundle("org-1", "sup-1");

    expect(mockGetTripsBySupplierForOrg).toHaveBeenCalledWith("org-1", "sup-1");
    expect(bundle?.trips).toEqual(trips);

    // Supplier Profile Overview's "Completed" KPI and Finance tab's trip
    // revenue both read these fields directly off bundle.trips.
    const completed = bundle!.trips.filter((t) =>
      ["completed", "done", "delivered"].includes(t.status ?? ""),
    );
    const tripRevenue = bundle!.trips.reduce((s, t) => s + Number(t.supplier_rate ?? 0), 0);
    expect(completed).toHaveLength(1);
    expect(tripRevenue).toBe(20000);
  });

  it("feeds buildSupplierPerformanceFromTrips correctly from the scoped fetch shape", async () => {
    const trips = [
      { id: "trip-1", status: "completed", supplier_rate: 1000 },
      { id: "trip-2", status: "completed", supplier_rate: 1000 },
      { id: "trip-3", status: "cancelled", supplier_rate: 0 },
    ];
    mockGetTripsBySupplierForOrg.mockResolvedValue({ error: null, trips });

    const { bundle } = await getSupplierManagementBundle("org-1", "sup-1");

    // getSupplierManagementBundle computes performance from the same scoped
    // trips — confirms buildSupplierPerformanceFromTrips accepts that shape
    // directly (no full TripRow required, no cast).
    expect(bundle?.performance?.total_trips).toBe(3);
    const performance = buildSupplierPerformanceFromTrips(bundle!.trips);
    expect(performance.total_trips).toBe(3);
  });
});
