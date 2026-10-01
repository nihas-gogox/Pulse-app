/**
 * Phase 2 — request-count evidence for the Compliance pipeline.
 *
 * Supabase is faked at the lowest level (`from()` / `rpc()`), so every count
 * below is a real database operation the production code would issue — not a
 * count of mocked helpers. Fixture: 3 pipeline trips; t1 + t2 share owned
 * vehicle v1, t3 uses partner vehicle v2 (not readable → viewer RPC).
 */
type Row = Record<string, unknown>;
type Op = { kind: "from" | "rpc"; name: string; filters: string[] };

const mockOps: Op[] = [];
let mockTables: Record<string, Row[]> = {};

function mockQuery(table: string) {
  const op: Op = { kind: "from", name: table, filters: [] };
  mockOps.push(op);
  let rows = [...(mockTables[table] ?? [])];
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = (col: string, val: unknown) => {
    op.filters.push(`${col}=${String(val)}`);
    rows = rows.filter((r) => r[col] === undefined || r[col] === val);
    return builder;
  };
  builder.neq = () => builder;
  builder.is = () => builder;
  builder.in = (col: string, vals: unknown[]) => {
    op.filters.push(`${col} in ${vals.length}`);
    rows = rows.filter((r) => r[col] === undefined || vals.includes(r[col]));
    return builder;
  };
  builder.then = (resolve: (v: { data: Row[]; error: null }) => void) => resolve({ data: rows, error: null });
  return builder;
}

jest.mock("@/lib/supabase", () => ({
  supabase: () => ({
    from: (table: string) => mockQuery(table),
    rpc: (name: string) => {
      mockOps.push({ kind: "rpc", name, filters: [] });
      return Promise.resolve({ data: name === "get_vehicle_for_trip_viewer" ? mockPartnerVehicle : null, error: null });
    },
  }),
}));

const mockPartnerVehicle = {
  id: "v2",
  vehicle_number: "TN39CQ4399",
  documents: { rc: { url: "org-x/v2/rc.pdf", verifiedAt: null } },
};

import {
  loadCompliancePipelineInputs,
  patchForComplianceChange,
  patchForPipelineTrips,
} from "@/features/tripCompliance/services/compliancePipelineSync.service";
import { summarizeComplianceTrip } from "@/features/tripCompliance/services/tripComplianceRead.service";
import type { ComplianceTripInputs } from "@/features/tripCompliance/tripCompliance.types";
import type { TripRow } from "@/features/trips/services/trips.service";

function trip(id: string, over: Partial<TripRow>): TripRow {
  return {
    id,
    organization_id: "org-1",
    status: "delivered",
    vehicle_id: null,
    owner_vehicle_id: null,
    driver_id: null,
    vehicle_display_number: null,
    amount_paid: 0,
    ...over,
  } as TripRow;
}

const T1 = trip("t1", { vehicle_id: "v1", driver_id: "d1", vehicle_display_number: "AP16TX3792" });
const T2 = trip("t2", { vehicle_id: "v1", driver_id: "d2", vehicle_display_number: "AP16TX3792" });
const T3 = trip("t3", { vehicle_id: "v2", driver_id: "d1", vehicle_display_number: "TN39CQ4399" });
const TRIPS = [T1, T2, T3];

function tripDoc(id: string, tripId: string, type: string, status = "pending"): Row {
  return {
    id,
    trip_id: tripId,
    document_type: type,
    file_name: `${type}.pdf`,
    storage_path: `${tripId}/${type}/${id}.pdf`,
    uploaded_at: "2026-09-20T00:00:00.000Z",
    status,
    document_number: null,
    source_entity_document_id: null,
  };
}

function seed() {
  mockTables = {
    trip_documents: [
      tripDoc("d-t1-lr", "t1", "lr"),
      tripDoc("d-t1-inv", "t1", "invoice"),
      tripDoc("d-t1-eway", "t1", "eway_bill"),
      tripDoc("d-t2-lr", "t2", "lr"),
    ],
    trips: TRIPS.map((t) => ({ id: t.id, compliance_verified_at: null, pod_received_at: null, amount_paid: 0, updated_at: "2026-09-20" })),
    transactions: [],
    entity_documents: [],
    vehicles: [{ id: "v1", vehicle_number: "AP16TX3792", organization_id: "org-1", documents: { rc: { url: "org-1/v1/rc.pdf", verifiedAt: null } } }],
    drivers: [],
    driver_kyc_documents: [],
  };
}

const count = (name: string) => mockOps.filter((op) => op.name === name).length;
const reads = () => mockOps.length;

let loaded: ComplianceTripInputs[];

beforeEach(async () => {
  seed();
  mockOps.length = 0;
  loaded = await loadCompliancePipelineInputs(undefined, TRIPS, { full: true });
  mockOps.length = 0;
});

describe("initial load (full)", () => {
  it("one batched read per input, one viewer RPC per unreadable partner vehicle", async () => {
    mockOps.length = 0;
    await loadCompliancePipelineInputs(undefined, TRIPS, { full: true });
    expect(count("trip_documents")).toBe(1);
    expect(count("transactions")).toBe(1);
    expect(count("entity_documents")).toBe(1);
    expect(count("get_vehicle_for_trip_viewer")).toBe(1); // v2 only; v1 is org-readable
    expect(count("get_trips_for_org")).toBe(0);
  });
});

describe("trip-document approve", () => {
  it("0 reads: patch mirrors verify_trip_document; only that trip changes", async () => {
    const patch = await patchForComplianceChange(
      loaded,
      { type: "tripDocumentDecision", tripId: "t1", documentId: "d-t1-lr", status: "verified", actorId: "u1" },
      () => "2026-09-29T10:00:00.000Z",
    );
    const next = patch(loaded);
    expect(reads()).toBe(0);
    expect(count("get_vehicle_for_trip_viewer")).toBe(0);
    const doc = next[0].documents.find((d) => d.id === "d-t1-lr");
    expect(doc).toMatchObject({ status: "verified", verified_by: "u1", verified_at: "2026-09-29T10:00:00.000Z", rejection_reason: null });
    expect(next[1]).toBe(loaded[1]);
    expect(next[2]).toBe(loaded[2]);
  });

  it("decline stores the trimmed reason", async () => {
    const patch = await patchForComplianceChange(loaded, {
      type: "tripDocumentDecision",
      tripId: "t1",
      documentId: "d-t1-inv",
      status: "rejected",
      actorId: "u1",
      rejectionReason: "  blurry  ",
    });
    expect(patch(loaded)[0].documents.find((d) => d.id === "d-t1-inv")?.rejection_reason).toBe("blurry");
    expect(reads()).toBe(0);
  });

  it("falls back to exactly 1 read when the document is not cached", async () => {
    const patch = await patchForComplianceChange(loaded, {
      type: "tripDocumentDecision",
      tripId: "t2",
      documentId: "not-cached",
      status: "verified",
      actorId: "u1",
    });
    expect(reads()).toBe(1);
    expect(count("trip_documents")).toBe(1);
    expect(patch(loaded)[0]).toBe(loaded[0]);
  });
});

describe("vehicle-document approve", () => {
  it("re-reads v1 once and updates EVERY trip on v1 (t1 and t2), not t3", async () => {
    mockTables.vehicles = [
      { id: "v1", vehicle_number: "AP16TX3792", organization_id: "org-1", documents: { rc: { url: "org-1/v1/rc.pdf", verifiedAt: "2026-09-29" } } },
    ];
    const patch = await patchForComplianceChange(loaded, { type: "vehicleDocuments", vehicleId: "v1" });
    const next = patch(loaded);
    expect(count("get_vehicle_for_trip_viewer")).toBe(0);
    expect(count("trip_documents")).toBe(0);
    const rcStatus = (row: ComplianceTripInputs) => row.vehicleDocuments.find((d) => d.doc_type === "rc")?.status;
    expect(rcStatus(loaded[0])).not.toBe(rcStatus(next[0]));
    expect(rcStatus(next[0])).toBe(rcStatus(next[1]));
    expect(next[2]).toBe(loaded[2]);
  });
});

describe("payment", () => {
  it("reads only compliance transactions + trips.amount_paid for that trip", async () => {
    mockTables.trips = mockTables.trips.map((r) => (r.id === "t1" ? { ...r, amount_paid: 5000 } : r));
    const patch = await patchForComplianceChange(loaded, { type: "payment", tripId: "t1" });
    const next = patch(loaded);
    expect(mockOps.map((op) => op.name).sort()).toEqual(["transactions", "trips"]);
    expect(mockOps.every((op) => op.filters.includes("trip_id in 1") || op.filters.includes("id in 1"))).toBe(true);
    expect(next[0].trip.amount_paid).toBe(5000);
    expect(summarizeComplianceTrip(next[0]).advance?.amount).toBe(5000);
    expect(next[1]).toBe(loaded[1]);
  });
});

describe("mark verified / POD", () => {
  it("mark verified: 0 reads, flags mirror mark_trip_compliance_verified", async () => {
    const patch = await patchForComplianceChange(loaded, { type: "complianceVerified", tripId: "t1", actorId: "u1" });
    expect(reads()).toBe(0);
    expect(patch(loaded)[0].flags).toMatchObject({ compliance_decision: "approved", compliance_verified_by: "u1" });
    expect(summarizeComplianceTrip(patch(loaded)[0]).stage).toBe("hard_copy_pod_received");
  });

  it("POD / exception: flags plus received-LR event for that trip", async () => {
    await patchForComplianceChange(loaded, { type: "tripFlags", tripId: "t1" });
    expect(mockOps).toEqual([
      { kind: "from", name: "trips", filters: ["id in 1"] },
      {
        kind: "from",
        name: "trip_workflow_events",
        filters: ["event_type=pod.hard_copy_courier_dispatched", "trip_id in 1"],
      },
    ]);
  });
});

describe("focus / incremental pipeline refetch", () => {
  it("re-reads only trip-scoped inputs; no vehicle, driver, entity or viewer reads", async () => {
    await loadCompliancePipelineInputs(loaded, TRIPS, { full: false });
    expect(mockOps.map((op) => op.name).sort()).toEqual([
      "transactions",
      "trip_documents",
      "trip_workflow_events",
      "trips",
    ]);
    expect(count("get_vehicle_for_trip_viewer")).toBe(0);
  });
});

describe("trips-list change", () => {
  it("status-only change: 0 reads, other summaries keep their objects", async () => {
    const changed = [{ ...T1, status: "completed" } as TripRow, T2, T3];
    const next = (await patchForPipelineTrips(loaded, changed))(loaded);
    expect(reads()).toBe(0);
    expect(next[0].trip.status).toBe("completed");
    expect(next[1]).toBe(loaded[1]);
    expect(next[2]).toBe(loaded[2]);
  });

  it("identical refetch: 0 reads, same array reference", async () => {
    const next = (await patchForPipelineTrips(loaded, TRIPS.map((t) => ({ ...t }))))(loaded);
    expect(reads()).toBe(0);
    expect(next).toBe(loaded);
  });

  it("new trip: full inputs for that one trip only", async () => {
    const t4 = trip("t4", { vehicle_id: "v1" });
    mockTables.trips.push({ id: "t4" });
    const next = (await patchForPipelineTrips(loaded, [...TRIPS, t4]))(loaded);
    expect(next.map((r) => r.trip.id)).toEqual(["t1", "t2", "t3", "t4"]);
    expect(mockOps.filter((op) => op.name === "trip_documents")[0].filters).toContain("trip_id in 1");
  });

  it("trip leaving the pipeline is dropped without reads", async () => {
    const next = (await patchForPipelineTrips(loaded, [T1, T3]))(loaded);
    expect(reads()).toBe(0);
    expect(next.map((r) => r.trip.id)).toEqual(["t1", "t3"]);
  });
});
