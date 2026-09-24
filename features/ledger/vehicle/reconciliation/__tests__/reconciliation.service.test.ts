/**
 * Covers reconcileVehicleLedgerStatesBatch (the batched N+1 fix) against the same
 * mismatch/chip rules as the pre-existing per-trip reconcileVehicleLedgerState,
 * with a focus on correct per-tripId/per-candidate mapping after batching.
 */
import { reconcileVehicleLedgerStatesBatch } from "../reconciliation.service";

const mockFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: () => ({ from: mockFrom }),
}));

// Untouched by this change (only used by reconcileOperationalPosting) — mocked out because
// its real import chain drags in @sentry/react-native, which this project's Jest config
// doesn't transform.
jest.mock("@/features/ledger/vehicle/runtime", () => ({ executeVehiclePostingRuntime: jest.fn() }));

type Row = Record<string, unknown>;

function arrayBuilder(result: { data: Row[] | null; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order"]) {
    builder[m] = jest.fn(() => builder);
  }
  builder.then = (resolve: (v: typeof result) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

/** vehicle_ledger_entries builder: resolves based on the .eq('source_type', X) it was given. */
function ledgerEntriesBuilder(entriesBySourceType: Record<string, Row[]>) {
  const builder: Record<string, unknown> = {};
  let sourceType = "";
  builder.select = jest.fn(() => builder);
  builder.eq = jest.fn((col: string, val: string) => {
    if (col === "source_type") sourceType = val;
    return builder;
  });
  builder.in = jest.fn(() => builder);
  builder.then = (resolve: (v: { data: Row[]; error: null }) => unknown) =>
    Promise.resolve({ data: entriesBySourceType[sourceType] ?? [], error: null }).then(resolve);
  return builder;
}

interface Fixture {
  trips?: Row[];
  tripsError?: unknown;
  fuelEntries?: Row[];
  tollEntries?: Row[];
  /** existing vehicle_ledger_entries rows, keyed by source_type ('fuel' | 'toll') */
  existingLedgerEntries?: Record<string, Row[]>;
}

function mockTables(fixture: Fixture) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "trips") return arrayBuilder({ data: fixture.trips ?? [], error: fixture.tripsError ?? null });
    if (table === "trip_fuel_entries") return arrayBuilder({ data: fixture.fuelEntries ?? [], error: null });
    if (table === "trip_toll_entries") return arrayBuilder({ data: fixture.tollEntries ?? [], error: null });
    if (table === "vehicle_ledger_entries") return ledgerEntriesBuilder(fixture.existingLedgerEntries ?? {});
    throw new Error(`Unexpected table: ${table}`);
  });
}

function trip(id: string, opts: { assetTrip?: boolean } = {}): Row {
  return {
    id,
    organization_id: "org-1",
    // execution_type is the highest-priority signal isAssetExecutionTrip checks.
    execution_type: opts.assetTrip === false ? "AGGREGATE" : "ASSET",
  };
}

function fuelEntry(id: string, tripId: string, opts: Partial<Row> = {}): Row {
  return {
    id,
    trip_id: tripId,
    approval_state: "approved",
    payment_owner: "organization",
    posting_state: "pending",
    ledger_state: "not_posted",
    ...opts,
  };
}

function tollEntry(id: string, tripId: string, opts: Partial<Row> = {}): Row {
  return {
    id,
    trip_id: tripId,
    approval_state: "approved",
    payment_owner: "organization",
    posting_state: "pending",
    ledger_state: "not_posted",
    ...opts,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("reconcileVehicleLedgerStatesBatch", () => {
  it("empty input: returns an empty map with no queries issued", async () => {
    mockTables({});
    const result = await reconcileVehicleLedgerStatesBatch([]);
    expect(result.size).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("1 trip, no fuel/toll entries: posted, no mismatches", async () => {
    mockTables({ trips: [trip("t1")], fuelEntries: [], tollEntries: [] });
    const result = await reconcileVehicleLedgerStatesBatch(["t1"]);
    expect(result.get("t1")).toEqual({ error: null, mismatches: [], chip: "posted" });
  });

  it("missing trip (deleted/RLS-hidden): blocked with 'Trip not found' error", async () => {
    mockTables({ trips: [] });
    const result = await reconcileVehicleLedgerStatesBatch(["missing-1"]);
    const entry = result.get("missing-1");
    expect(entry?.chip).toBe("blocked");
    expect(entry?.error?.message).toBe("Trip not found");
  });

  it("multiple trips: each trip's mismatches map back to the correct tripId (no cross-trip leakage)", async () => {
    mockTables({
      trips: [trip("t1"), trip("t2")],
      fuelEntries: [
        fuelEntry("f-t1", "t1"), // approved+organization on t1 -> shouldPost, no ledger entry -> mismatch
        fuelEntry("f-t2", "t2", { approval_state: "pending" }), // shouldPost=false, no ledger entry -> no mismatch
      ],
      tollEntries: [],
      existingLedgerEntries: { fuel: [] },
    });

    const result = await reconcileVehicleLedgerStatesBatch(["t1", "t2"]);

    const t1 = result.get("t1")!;
    expect(t1.mismatches).toHaveLength(1);
    expect(t1.mismatches[0]).toMatchObject({ sourceType: "fuel", sourceId: "f-t1", shouldPost: true, hasLedgerEntry: false });
    expect(t1.chip).toBe("reconciliation_required");

    const t2 = result.get("t2")!;
    expect(t2.mismatches).toHaveLength(0);
    expect(t2.chip).toBe("posted");
  });

  it("trip with multiple fuel and toll candidates: all evaluated independently and correctly", async () => {
    // l1 is already posted; l2 has a ledger entry but is stuck (posting_state != 'posted').
    mockFrom.mockImplementation((table: string) => {
      if (table === "trips") return arrayBuilder({ data: [trip("t1")], error: null });
      if (table === "trip_fuel_entries")
        return arrayBuilder({
          data: [fuelEntry("f1", "t1"), fuelEntry("f2", "t1", { approval_state: "pending" })],
          error: null,
        });
      if (table === "trip_toll_entries")
        return arrayBuilder({
          data: [
            tollEntry("l1", "t1", { posting_state: "posted" }),
            tollEntry("l2", "t1", { posting_state: "pending" }),
          ],
          error: null,
        });
      if (table === "vehicle_ledger_entries")
        return ledgerEntriesBuilder({
          toll: [{ source_type: "toll", source_id: "l1" }, { source_type: "toll", source_id: "l2" }],
        });
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await reconcileVehicleLedgerStatesBatch(["t1"]);
    const t1 = result.get("t1")!;
    const bySourceId = Object.fromEntries(t1.mismatches.map((m) => [m.sourceId, m]));

    expect(bySourceId["f1"]).toMatchObject({ shouldPost: true, hasLedgerEntry: false });
    expect(bySourceId["f2"]).toBeUndefined();
    expect(bySourceId["l1"]).toBeUndefined(); // posted + has entry -> satisfied, no mismatch
    expect(bySourceId["l2"]).toMatchObject({ hasLedgerEntry: true, postingState: "pending" }); // stuck
    expect(t1.mismatches).toHaveLength(2);
  });

  it("posting match/mismatch matrix mirrors reconcileVehicleLedgerState's invariant rules", async () => {
    mockTables({
      trips: [trip("t1")],
      fuelEntries: [
        // shouldPost=true, no ledger entry -> mismatch (should post but hasn't)
        fuelEntry("should-post-missing", "t1"),
        // shouldPost=true, has ledger entry, postingState='posted' -> satisfied, no mismatch
        fuelEntry("should-post-done", "t1", { posting_state: "posted" }),
        // shouldPost=true, has ledger entry, postingState='failed' -> mismatch, retry_needed-eligible
        fuelEntry("should-post-failed", "t1", { posting_state: "failed" }),
        // shouldPost=false (not approved), no ledger entry -> no mismatch
        fuelEntry("no-post-clean", "t1", { approval_state: "pending" }),
      ],
      tollEntries: [],
      existingLedgerEntries: {
        fuel: [
          { source_type: "fuel", source_id: "should-post-done" },
          { source_type: "fuel", source_id: "should-post-failed" },
        ],
      },
    });

    const result = await reconcileVehicleLedgerStatesBatch(["t1"]);
    const t1 = result.get("t1")!;
    const bySourceId = Object.fromEntries(t1.mismatches.map((m) => [m.sourceId, m]));

    expect(bySourceId["should-post-missing"]).toMatchObject({ shouldPost: true, hasLedgerEntry: false });
    expect(bySourceId["should-post-done"]).toBeUndefined();
    expect(bySourceId["should-post-failed"]).toMatchObject({ hasLedgerEntry: true, postingState: "failed" });
    expect(bySourceId["no-post-clean"]).toBeUndefined();
    expect(t1.chip).toBe("retry_needed"); // one mismatch has postingState 'failed'
  });

  it("batches to a constant number of Supabase calls regardless of trip count (the actual fix)", async () => {
    const trips = Array.from({ length: 12 }, (_, i) => trip(`t${i}`));
    mockTables({
      trips,
      fuelEntries: trips.map((t, i) => fuelEntry(`f${i}`, t.id as string)),
      tollEntries: [],
      existingLedgerEntries: { fuel: [] },
    });

    await reconcileVehicleLedgerStatesBatch(trips.map((t) => t.id as string));

    // 1 trips call + 1 fuel call + 1 toll call + 1 vehicle_ledger_entries call (fuel-type only,
    // since no toll candidates exist) = 4 total, independent of the 12 trips processed.
    expect(mockFrom).toHaveBeenCalledTimes(4);
    const tables = mockFrom.mock.calls.map(([table]) => table);
    expect(tables.filter((t) => t === "trips")).toHaveLength(1);
    expect(tables.filter((t) => t === "trip_fuel_entries")).toHaveLength(1);
    expect(tables.filter((t) => t === "trip_toll_entries")).toHaveLength(1);
    expect(tables.filter((t) => t === "vehicle_ledger_entries")).toHaveLength(1);
  });
});
