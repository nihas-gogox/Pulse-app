import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";
import { createCommerceMemoryRepository } from "../src/persistence/memory/commerceMemory";
import { createExecutionMemoryRepository } from "../src/persistence/memory/executionMemory";

const persistCtx = { workspaceId: "ws-1", actorUserId: "actor-1" };

const membershipWs9 = {
  membershipId: "mem-9",
  actorId: "actor-9",
  workspaceId: "ws-9",
  status: "active" as const,
  role: "unspecified",
};

describe("Pulse V2 in-process Gateway", () => {
  it("lets Commerce persist to its own sales_orders store", () => {
    const store = createCommerceMemoryRepository();
    store.insertSalesOrder(persistCtx, { id: "so-1", workspaceId: "ws-1", status: "draft" });
    expect(store.getSalesOrder(persistCtx, "so-1")?.status).toBe("draft");
  });

  it("lets Execution persist to its own trips store", () => {
    const store = createExecutionMemoryRepository();
    store.insertTrip(persistCtx, {
      id: "trip-1",
      workspaceId: "ws-1",
      orderId: "so-1",
      status: "created",
    });
    expect(store.getTrip(persistCtx, "trip-1")?.orderId).toBe("so-1");
  });

  it("creates an order and a trip only through execute()", () => {
    const identityPort = createMemoryIdentityPort({
      actorProofs: [{ proof: "proof-9", actorId: "actor-9" }],
      memberships: [membershipWs9],
    });
    const { execute, dataPlane } = createPulseV2Gateway(
      { PULSE_V2_SUPABASE_URL: "" },
      { identityPort },
    );
    expect(dataPlane.mode).toBe("memory");

    const placed = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-gateway.test-41",
      identityProof: "proof-9",
      payload: { id: "so-9" },
      correlationId: "corr-9",
    });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;

    const fetched = execute({
      domain: "execution",
      operation: "getTrip",
      identityProof: "proof-9",
      payload: { id: "trip-so-9" },
      correlationId: "corr-9b",
    });
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) return;
    expect(fetched.data).toEqual({
      trip: {
        id: "trip-so-9",
        workspaceId: "ws-9",
        orderId: "so-9",
        status: "created",
      },
    });
  });
});
