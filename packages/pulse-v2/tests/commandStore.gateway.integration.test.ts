import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";
import { createCommandStore } from "../src/persistence/commandStore/createCommandStore";
import { V2PersistenceError } from "../src/persistence/v2PersistenceError";
import type { CommandStoreRepository } from "../src/persistence/commandStore/commandStore.types";
import type { MembershipRecord } from "../src/identity/identityPort";

function tmpDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pulse-v2-cs-gw-"));
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

describe("Command Store Gateway integration", () => {
  function gw(extra?: { commandStore?: CommandStoreRepository; createCommandId?: () => string }) {
    return createPulseV2Gateway(
      { PULSE_V2_SUPABASE_URL: "" },
      { identityPort: identityBoth(), ...extra },
    );
  }

  it("rejects createOrder without idempotencyKey before Command Store or domain", () => {
    const { execute, commandStore } = gw();
    const denied = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      payload: { id: "so-no-key" },
      correlationId: "c-no-key",
    });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.code).toBe("V2_GATEWAY_INVALID");
    expect(denied.message).toBe("idempotencyKey is required");
    expect(denied.correlationId).toBe("c-no-key");
    expect(commandStore.getByIdempotencyKey("ws-a", "c-no-key")).toBeNull();
    const order = execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: "proof-a",
      payload: { id: "so-no-key" },
      correlationId: "c-no-key-read",
    });
    expect(order.ok).toBe(false);
  });

  it("rejects createOrder with empty idempotencyKey and does not create a CommandRecord", () => {
    const { execute, commandStore } = gw();
    const denied = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "   ",
      payload: { id: "so-empty-key" },
      correlationId: "c-empty-key",
    });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.code).toBe("V2_GATEWAY_INVALID");
    expect(denied.correlationId).toBe("c-empty-key");
    expect(commandStore.getByIdempotencyKey("ws-a", "")).toBeNull();
    expect(commandStore.getByIdempotencyKey("ws-a", "   ")).toBeNull();
  });

  it("requires idempotencyKey on public createTripFromOrder", () => {
    const { execute, commandStore } = gw();
    const denied = execute({
      domain: "execution",
      operation: "createTripFromOrder",
      identityProof: "proof-a",
      payload: { orderId: "so-trip-nokey" },
      correlationId: "c-trip-nokey",
    });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.code).toBe("V2_GATEWAY_INVALID");
    expect(commandStore.getByIdempotencyKey("ws-a", "c-trip-nokey")).toBeNull();
  });

  it("createOrder creates exactly one CommandRecord with trusted tenantId", () => {
    const { execute, commandStore } = gw();
    const placed = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-order-1",
      payload: { id: "so-cs-1" },
      correlationId: "c-1",
    });
    expect(placed.ok).toBe(true);
    const record = commandStore.getByIdempotencyKey("ws-a", "k-order-1");
    expect(record?.status).toBe("COMPLETED");
    expect(record?.tenantId).toBe("ws-a");
    expect(record?.commandName).toBe("commerce.createOrder");
    expect(commandStore.getByIdempotencyKey("ws-b", "k-order-1")).toBeNull();
  });

  it("public createTripFromOrder creates exactly one CommandRecord", () => {
    const { execute, commandStore } = gw();
    execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-setup",
      payload: { id: "so-public-trip" },
      correlationId: "c-setup",
    });
    const trip = execute({
      domain: "execution",
      operation: "createTripFromOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-trip-public",
      payload: { orderId: "so-public-trip" },
      correlationId: "c-trip",
    });
    expect(trip.ok).toBe(true);
    const record = commandStore.getByIdempotencyKey("ws-a", "k-trip-public");
    expect(record?.commandName).toBe("execution.createTripFromOrder");
    expect(record?.status).toBe("COMPLETED");
  });

  it("nested Commerce → Execution does not create a second CommandRecord", () => {
    let created = 0;
    const inner = createCommandStore({ mode: "memory" });
    const spy: CommandStoreRepository = {
      ...inner,
      record(envelope, options) {
        const outcome = inner.record(envelope, options);
        if (outcome.created) created += 1;
        return outcome;
      },
    };
    const { execute, commandStore } = gw({ commandStore: spy });
    const placed = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-nested",
      payload: { id: "so-nested" },
      correlationId: "c-nested",
    });
    expect(placed.ok).toBe(true);
    expect(created).toBe(1);
    expect(commandStore.getByIdempotencyKey("ws-a", "k-nested")?.commandName).toBe(
      "commerce.createOrder",
    );
  });

  it("queries do not create CommandRecords", () => {
    const { execute, commandStore } = gw();
    execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-q",
      payload: { id: "so-q" },
      correlationId: "c-q",
    });
    const before = commandStore.getByIdempotencyKey("ws-a", "k-q")?.commandId;
    execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: "proof-a",
      payload: { id: "so-q" },
      correlationId: "c-get-o",
    });
    execute({
      domain: "execution",
      operation: "getTrip",
      identityProof: "proof-a",
      payload: { id: "trip-so-q" },
      correlationId: "c-get-t",
    });
    execute({
      domain: "execution",
      operation: "getTripByOrderId",
      identityProof: "proof-a",
      payload: { orderId: "so-q" },
      correlationId: "c-get-by",
    });
    expect(commandStore.getByIdempotencyKey("ws-a", "k-q")?.commandId).toBe(before);
    expect(commandStore.getByIdempotencyKey("ws-a", "c-get-o")).toBeNull();
  });

  it("payload workspaceId cannot override tenantId", () => {
    const { execute, commandStore } = gw();
    const denied = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-evil-ws",
      payload: { id: "so-evil", workspaceId: "ws-b" },
      correlationId: "c-evil-ws",
    });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.code).toBe("V2_WORKSPACE_DENIED");
    expect(commandStore.getByIdempotencyKey("ws-a", "k-evil-ws")).toBeNull();
    expect(commandStore.getByIdempotencyKey("ws-b", "k-evil-ws")).toBeNull();
  });

  it("caller actorId cannot override trusted identity", () => {
    const { execute, commandStore } = gw();
    const denied = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      actorId: "actor-b",
      idempotencyKey: "k-evil-actor",
      payload: { id: "so-actor" },
      correlationId: "c-evil-actor",
    });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.code).toBe("V2_ACTOR_DENIED");
    expect(commandStore.getByIdempotencyKey("ws-a", "k-evil-actor")).toBeNull();
  });

  it("new command reaches COMPLETED; domain failure reaches FAILED", () => {
    const { execute, commandStore } = gw();
    execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-ok",
      payload: { id: "so-ok" },
      correlationId: "c-ok",
    });
    expect(commandStore.getByIdempotencyKey("ws-a", "k-ok")?.status).toBe("COMPLETED");

    const bad = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-bad",
      payload: {},
      correlationId: "c-bad",
    });
    expect(bad.ok).toBe(false);
    expect(commandStore.getByIdempotencyKey("ws-a", "k-bad")?.status).toBe("FAILED");
  });

  it("completed idempotent replay returns stored result without a second record or domain insert", () => {
    const { execute, commandStore } = gw();
    const first = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-replay",
      payload: { id: "so-replay" },
      correlationId: "c-replay-1",
    });
    expect(first.ok).toBe(true);
    const commandId = commandStore.getByIdempotencyKey("ws-a", "k-replay")?.commandId;
    const second = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-replay",
      payload: { id: "so-should-not-insert" },
      correlationId: "c-replay-2",
    });
    expect(second.ok).toBe(true);
    expect(second).toEqual(first);
    expect(commandStore.getByIdempotencyKey("ws-a", "k-replay")?.commandId).toBe(commandId);
    const ghost = execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: "proof-a",
      payload: { id: "so-should-not-insert" },
      correlationId: "c-ghost",
    });
    expect(ghost.ok).toBe(false);
  });

  it("different idempotencyKey creates a new command", () => {
    const { execute, commandStore } = gw();
    execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-one",
      payload: { id: "so-one" },
      correlationId: "c-one",
    });
    execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-two",
      payload: { id: "so-two" },
      correlationId: "c-two",
    });
    const a = commandStore.getByIdempotencyKey("ws-a", "k-one");
    const b = commandStore.getByIdempotencyKey("ws-a", "k-two");
    expect(a?.commandId).toBeDefined();
    expect(b?.commandId).toBeDefined();
    expect(a?.commandId).not.toBe(b?.commandId);
  });

  it("Command Store persistence failure fails closed before domain success", () => {
    const dataDir = tmpDataDir();
    fs.mkdirSync(path.join(dataDir, "v2_platform.command_store.json"));
    const { execute } = createPulseV2Gateway(
      { PULSE_V2_SUPABASE_URL: "", PULSE_V2_DATA_DIR: dataDir },
      { identityPort: identityBoth() },
    );
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-io",
      payload: { id: "so-io" },
      correlationId: "c-io",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("V2_PERSISTENCE_FAILED");
    const order = execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: "proof-a",
      payload: { id: "so-io" },
      correlationId: "c-io-read",
    });
    expect(order.ok).toBe(false);
  });

  it("markCompleted failure does not report false success", () => {
    const inner = createCommandStore({ mode: "memory" });
    const store: CommandStoreRepository = {
      ...inner,
      markCompleted() {
        throw new V2PersistenceError("Failed to write durable table", { kind: "io" });
      },
    };
    const { execute } = gw({ commandStore: store });
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-mc",
      payload: { id: "so-mc" },
      correlationId: "c-mc",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("V2_PERSISTENCE_FAILED");
  });

  it("duplicate commandId fails closed", () => {
    let n = 0;
    const { execute, commandStore } = gw({
      createCommandId: () => "same-command-id",
    });
    execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-dup-1",
      payload: { id: "so-dup-1" },
      correlationId: "c-dup-1",
    });
    n += 1;
    const second = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-dup-2",
      payload: { id: "so-dup-2" },
      correlationId: "c-dup-2",
    });
    expect(n).toBe(1);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe("V2_PERSISTENCE_FAILED");
    expect(commandStore.getByIdempotencyKey("ws-a", "k-dup-1")?.status).toBe("COMPLETED");
    expect(commandStore.getByIdempotencyKey("ws-a", "k-dup-2")).toBeNull();
  });

  it("cross-tenant idempotency keys remain isolated", () => {
    const { execute, commandStore } = gw();
    execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "shared-key",
      payload: { id: "so-a" },
      correlationId: "c-a",
    });
    execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-b",
      idempotencyKey: "shared-key",
      payload: { id: "so-b" },
      correlationId: "c-b",
    });
    expect(commandStore.getByIdempotencyKey("ws-a", "shared-key")?.payload).toEqual(
      expect.objectContaining({ id: "so-a" }),
    );
    expect(commandStore.getByIdempotencyKey("ws-b", "shared-key")?.payload).toEqual(
      expect.objectContaining({ id: "so-b" }),
    );
  });

  it("createWorkspace does not create a CommandRecord", () => {
    const { createWorkspace, commandStore } = gw();
    const created = createWorkspace({
      identityProof: "proof-a",
      correlationId: "c-boot",
      idempotencyKey: "bootstrap-key",
    });
    expect(created.ok).toBe(true);
    expect(commandStore.getByIdempotencyKey("ws-a", "bootstrap-key")).toBeNull();
    if (!created.ok) return;
    expect(commandStore.getByIdempotencyKey(created.workspaceId, "bootstrap-key")).toBeNull();
  });
});
