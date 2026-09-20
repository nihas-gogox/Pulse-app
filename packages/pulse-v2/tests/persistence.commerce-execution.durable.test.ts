import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";
import { createV2Persistence } from "../src/persistence/createPersistence";
import {
  resolveV2PersistenceConfig,
  V2EnvironmentIsolationError,
} from "../src/env/v2SupabaseEnv";
import type { MembershipRecord } from "../src/identity/identityPort";

function tmpDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pulse-v2-durable-"));
}

const membershipA: MembershipRecord = {
  membershipId: "mem-a",
  actorId: "actor-a",
  workspaceId: "ws-a",
  status: "active",
  role: "unspecified",
};

const membershipB: MembershipRecord = {
  membershipId: "mem-b",
  actorId: "actor-b",
  workspaceId: "ws-b",
  status: "active",
  role: "unspecified",
};

function identityBoth() {
  return createMemoryIdentityPort({
    actorProofs: [
      { proof: "proof-a", actorId: "actor-a" },
      { proof: "proof-b", actorId: "actor-b" },
    ],
    memberships: [membershipA, membershipB],
  });
}

function gateway(dataDir: string, identityPort = identityBoth()) {
  return {
    identityPort,
    ...createPulseV2Gateway(
      { PULSE_V2_SUPABASE_URL: "", PULSE_V2_DATA_DIR: dataDir },
      { identityPort },
    ),
  };
}

describe("Persistent Commerce/Execution (local V2 data dir)", () => {
  it("selects local-durable from PULSE_V2_DATA_DIR and never a hosted URL", () => {
    const dataDir = tmpDataDir();
    const cfg = resolveV2PersistenceConfig({
      PULSE_V2_DATA_DIR: dataDir,
      EXPO_PUBLIC_SUPABASE_URL: "https://zzzzzzzzzzzzzzzzzzzz.supabase.co",
    });
    expect(cfg.mode).toBe("local-durable");
    if (cfg.mode !== "local-durable") return;
    expect(cfg.supabaseUrl).toBeNull();
    expect(cfg.dataDir).toBe(dataDir);
    expect(cfg.dataDir.includes("supabase.co")).toBe(false);
  });

  it("refuses hosted supabase.co in DATA_DIR", () => {
    expect(() =>
      resolveV2PersistenceConfig({
        PULSE_V2_DATA_DIR: "/tmp/https://abcd.supabase.co/store",
      }),
    ).toThrow(V2EnvironmentIsolationError);
  });

  it("Test 1 + 9 — Commerce persists across repository recreation", () => {
    const dataDir = tmpDataDir();
    const { execute, dataPlane } = gateway(dataDir);
    expect(dataPlane.mode).toBe("local-durable");
    expect(dataPlane.supabaseUrl).toBeNull();
    expect(dataPlane.dataDir).toBe(dataDir);

    const created = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      payload: { id: "so-persist" },
      correlationId: "c-1",
    });
    expect(created.ok).toBe(true);

    const recreated = createV2Persistence({
      mode: "local-durable",
      supabaseUrl: null,
      anonKey: null,
      serviceRoleKey: null,
      hostedProjectRef: null,
      dataDir,
    });
    const row = recreated.commerce.getSalesOrder(
      { workspaceId: "ws-a", actorUserId: "actor-a" },
      "so-persist",
    );
    expect(row).toEqual({ id: "so-persist", workspaceId: "ws-a", status: "placed" });
  });

  it("Test 2 + 9 — Execution persists across Gateway recreation", () => {
    const dataDir = tmpDataDir();
    const first = gateway(dataDir);
    const created = first.execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      payload: { id: "so-trip" },
      correlationId: "c-2",
    });
    expect(created.ok).toBe(true);

    const second = gateway(dataDir);
    const trip = second.execute({
      domain: "execution",
      operation: "getTrip",
      identityProof: "proof-a",
      payload: { id: "trip-so-trip" },
      correlationId: "c-2b",
    });
    expect(trip.ok).toBe(true);
    if (!trip.ok) return;
    expect(trip.data).toEqual({
      trip: {
        id: "trip-so-trip",
        workspaceId: "ws-a",
        orderId: "so-trip",
        status: "created",
      },
    });
  });

  it("Test 3 — Workspace A can reread Order A after recreate", () => {
    const dataDir = tmpDataDir();
    gateway(dataDir).execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      payload: { id: "so-a" },
      correlationId: "c-3a",
    });
    const read = gateway(dataDir).execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: "proof-a",
      payload: { id: "so-a" },
      correlationId: "c-3b",
    });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.data).toEqual({
      order: { id: "so-a", workspaceId: "ws-a", status: "placed" },
    });
  });

  it("Test 4 — Workspace B cannot read Workspace A order", () => {
    const dataDir = tmpDataDir();
    gateway(dataDir).execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      payload: { id: "so-a-iso" },
      correlationId: "c-4a",
    });
    const leaked = gateway(dataDir).execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: "proof-b",
      payload: { id: "so-a-iso" },
      correlationId: "c-4b",
    });
    expect(leaked.ok).toBe(false);
    if (leaked.ok) return;
    expect(leaked.code).toBe("COMMERCE_NOT_FOUND");
  });

  it("Test 5 — Workspace B cannot read Workspace A trip", () => {
    const dataDir = tmpDataDir();
    gateway(dataDir).execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      payload: { id: "so-trip-iso" },
      correlationId: "c-5a",
    });
    const leaked = gateway(dataDir).execute({
      domain: "execution",
      operation: "getTrip",
      identityProof: "proof-b",
      payload: { id: "trip-so-trip-iso" },
      correlationId: "c-5b",
    });
    expect(leaked.ok).toBe(false);
    if (leaked.ok) return;
    expect(leaked.code).toBe("EXECUTION_NOT_FOUND");
  });

  it("Test 6 — getTripByOrderId stays workspace-scoped after recreate", () => {
    const dataDir = tmpDataDir();
    gateway(dataDir).execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      payload: { id: "so-by-order" },
      correlationId: "c-6a",
    });
    const repos = createV2Persistence({
      mode: "local-durable",
      supabaseUrl: null,
      anonKey: null,
      serviceRoleKey: null,
      hostedProjectRef: null,
      dataDir,
    });
    expect(
      repos.execution.getTripByOrderId({ workspaceId: "ws-a", actorUserId: null }, "so-by-order")
        ?.id,
    ).toBe("trip-so-by-order");
    expect(
      repos.execution.getTripByOrderId({ workspaceId: "ws-b", actorUserId: null }, "so-by-order"),
    ).toBeNull();

    const nestedB = gateway(dataDir).execute({
      domain: "execution",
      operation: "createTripFromOrder",
      identityProof: "proof-b",
      payload: { orderId: "so-by-order" },
      correlationId: "c-6b",
    });
    expect(nestedB.ok).toBe(false);
    if (nestedB.ok) return;
    expect(nestedB.code).toBe("V2_PERSISTENCE_FAILED");
    expect(
      repos.execution.getTrip({ workspaceId: "ws-a", actorUserId: null }, "trip-so-by-order")
        ?.workspaceId,
    ).toBe("ws-a");
  });

  it("Test 7 — payload workspace spoof is V2_WORKSPACE_DENIED with no write to B", () => {
    const dataDir = tmpDataDir();
    const { execute } = gateway(dataDir);
    const spoof = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      payload: { id: "so-spoof", workspaceId: "ws-b" },
      correlationId: "c-7a",
    });
    expect(spoof.ok).toBe(false);
    if (spoof.ok) return;
    expect(spoof.code).toBe("V2_WORKSPACE_DENIED");

    const repos = createV2Persistence({
      mode: "local-durable",
      supabaseUrl: null,
      anonKey: null,
      serviceRoleKey: null,
      hostedProjectRef: null,
      dataDir,
    });
    expect(
      repos.commerce.getSalesOrder({ workspaceId: "ws-b", actorUserId: null }, "so-spoof"),
    ).toBeNull();
    expect(
      repos.commerce.getSalesOrder({ workspaceId: "ws-a", actorUserId: null }, "so-spoof"),
    ).toBeNull();
  });

  it("Test 8 — nested Commerce → Execution: one Membership lookup, same workspace, durable", () => {
    const dataDir = tmpDataDir();
    const { execute, identityPort } = gateway(dataDir);
    const placed = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      payload: { id: "so-nested" },
      correlationId: "c-8",
    });
    expect(placed.ok).toBe(true);
    expect(identityPort.lookupCount).toBe(1);
    if (!placed.ok) return;
    expect(placed.data).toEqual({
      order: { id: "so-nested", workspaceId: "ws-a", status: "placed" },
      trip: {
        trip: {
          id: "trip-so-nested",
          workspaceId: "ws-a",
          orderId: "so-nested",
          status: "created",
        },
      },
    });

    const repos = createV2Persistence({
      mode: "local-durable",
      supabaseUrl: null,
      anonKey: null,
      serviceRoleKey: null,
      hostedProjectRef: null,
      dataDir,
    });
    expect(
      repos.commerce.getSalesOrder({ workspaceId: "ws-a", actorUserId: null }, "so-nested")
        ?.workspaceId,
    ).toBe("ws-a");
    expect(
      repos.execution.getTrip({ workspaceId: "ws-a", actorUserId: null }, "trip-so-nested")
        ?.workspaceId,
    ).toBe("ws-a");
    expect(
      repos.execution.getTrip({ workspaceId: "ws-b", actorUserId: null }, "trip-so-nested"),
    ).toBeNull();
  });
});
