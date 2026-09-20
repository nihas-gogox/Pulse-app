import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";
import { createV2Persistence } from "../src/persistence/createPersistence";
import { V2PersistenceError } from "../src/persistence/durable/jsonTable";
import type { MembershipRecord } from "../src/identity/identityPort";

function tmpDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pulse-v2-harden-"));
}

const membershipA: MembershipRecord = {
  membershipId: "mem-a",
  actorId: "actor-a",
  workspaceId: "ws-a",
  status: "active",
  role: "unspecified",
};

function identityA() {
  return createMemoryIdentityPort({
    actorProofs: [{ proof: "proof-a", actorId: "actor-a" }],
    memberships: [membershipA],
  });
}

function gateway(dataDir: string) {
  return createPulseV2Gateway(
    { PULSE_V2_SUPABASE_URL: "", PULSE_V2_DATA_DIR: dataDir },
    { identityPort: identityA() },
  );
}

describe("Persistence hardening", () => {
  it("atomic write leaves a complete JSON table and no tmp files", () => {
    const dataDir = tmpDataDir();
    const { execute } = gateway(dataDir);
    const created = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      payload: { id: "so-atomic" },
      correlationId: "c-atomic",
    });
    expect(created.ok).toBe(true);

    const commerceFile = path.join(dataDir, "v2_commerce.sales_orders.json");
    const parsed: unknown = JSON.parse(fs.readFileSync(commerceFile, "utf8"));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toEqual([
      { id: "so-atomic", workspaceId: "ws-a", status: "placed" },
    ]);
    const leftovers = fs.readdirSync(dataDir).filter((name) => name.endsWith(".tmp"));
    expect(leftovers).toEqual([]);
  });

  it("duplicate durable insert fails closed and leaves the original row", () => {
    const dataDir = tmpDataDir();
    const repos = createV2Persistence({
      mode: "local-durable",
      supabaseUrl: null,
      anonKey: null,
      serviceRoleKey: null,
      hostedProjectRef: null,
      dataDir,
    });
    const ctx = { workspaceId: "ws-a", actorUserId: "actor-a" };
    const first = repos.commerce.insertSalesOrder(ctx, {
      id: "so-dup",
      workspaceId: "ws-a",
      status: "placed",
    });
    expect(first.status).toBe("placed");
    expect(() =>
      repos.commerce.insertSalesOrder(ctx, {
        id: "so-dup",
        workspaceId: "ws-a",
        status: "draft",
      }),
    ).toThrow(V2PersistenceError);
    expect(repos.commerce.getSalesOrder(ctx, "so-dup")).toEqual({
      id: "so-dup",
      workspaceId: "ws-a",
      status: "placed",
    });
  });

  it("duplicate createOrder maps to V2_PERSISTENCE_FAILED with correlationId", () => {
    const dataDir = tmpDataDir();
    const { execute } = gateway(dataDir);
    const first = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      payload: { id: "so-dup-gw" },
      correlationId: "c-dup-1",
    });
    expect(first.ok).toBe(true);
    const second = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      payload: { id: "so-dup-gw" },
      correlationId: "c-dup-2",
    });
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.code).toBe("V2_PERSISTENCE_FAILED");
    expect(second.message).toBe("duplicate entity id");
    expect(second.correlationId).toBe("c-dup-2");
    expect(second.message.includes("/")).toBe(false);

    const reread = execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: "proof-a",
      payload: { id: "so-dup-gw" },
      correlationId: "c-dup-3",
    });
    expect(reread.ok).toBe(true);
  });

  it("nested trip persistence failure does not report a successful order", () => {
    const dataDir = tmpDataDir();
    fs.mkdirSync(path.join(dataDir, "v2_execution.trips.json"));

    const { execute } = gateway(dataDir);
    const created = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      payload: { id: "so-nested-fail" },
      correlationId: "c-nested-fail",
    });
    expect(created.ok).toBe(false);
    if (created.ok) return;
    expect(created.code).toBe("V2_PERSISTENCE_FAILED");
    expect(created.message).toBe("persistence failed");
    expect(created.correlationId).toBe("c-nested-fail");

    const order = execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: "proof-a",
      payload: { id: "so-nested-fail" },
      correlationId: "c-nested-fail-read",
    });
    expect(order.ok).toBe(false);
    if (order.ok) return;
    expect(order.code).toBe("COMMERCE_NOT_FOUND");
  });
});
