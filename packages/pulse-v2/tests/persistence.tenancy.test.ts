import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";
import type { MembershipRecord } from "../src/identity/identityPort";

const membershipA: MembershipRecord = {
  membershipId: "mem-tenancy-a",
  actorId: "actor-tenancy-a",
  workspaceId: "workspace-a",
  status: "active",
  role: "role-a",
};

const membershipB: MembershipRecord = {
  membershipId: "mem-tenancy-b",
  actorId: "actor-tenancy-b",
  workspaceId: "workspace-b",
  status: "active",
  role: "role-b",
};

const proofA = "proof-tenancy-a";
const proofB = "proof-tenancy-b";

function gateway() {
  const identityPort = createMemoryIdentityPort({
    actorProofs: [
      { proof: proofA, actorId: membershipA.actorId },
      { proof: proofB, actorId: membershipB.actorId },
    ],
    memberships: [membershipA, membershipB],
  });
  const { execute } = createPulseV2Gateway({ PULSE_V2_SUPABASE_URL: "" }, { identityPort });
  return { execute, identityPort };
}

describe("Persistence tenancy from AuthorizationContext.workspaceId", () => {
  it("lets Workspace A read its own order and trip", () => {
    const { execute, identityPort } = gateway();
    const created = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-persistence.tenancy.test-60",
      identityProof: proofA,
      membershipId: membershipA.membershipId,
      payload: { id: "order-a" },
      correlationId: "c-own",
    });
    expect(created.ok).toBe(true);
    expect(identityPort.lookupCount).toBe(1);
    if (!created.ok) return;
    expect(created.data).toEqual(
      expect.objectContaining({
        order: expect.objectContaining({ id: "order-a", workspaceId: "workspace-a" }),
        trip: { trip: expect.objectContaining({ id: "trip-order-a", workspaceId: "workspace-a" }) },
      }),
    );

    const order = execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: proofA,
      membershipId: membershipA.membershipId,
      payload: { id: "order-a" },
      correlationId: "c-own-get",
    });
    expect(order.ok).toBe(true);

    const trip = execute({
      domain: "execution",
      operation: "getTrip",
      identityProof: proofA,
      membershipId: membershipA.membershipId,
      payload: { id: "trip-order-a" },
      correlationId: "c-own-trip",
    });
    expect(trip.ok).toBe(true);
  });

  it("does not let Workspace B read Workspace A order or trip by entity id", () => {
    const { execute } = gateway();
    expect(
      execute({
        domain: "commerce",
        operation: "createOrder",
        idempotencyKey: "idemp-persistence.tenancy.test-61",
        identityProof: proofA,
        membershipId: membershipA.membershipId,
        payload: { id: "order-a-secret" },
        correlationId: "c-create-a",
      }).ok,
    ).toBe(true);

    const leakedOrder = execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: proofB,
      membershipId: membershipB.membershipId,
      payload: { id: "order-a-secret" },
      correlationId: "c-leak-order",
    });
    expect(leakedOrder.ok).toBe(false);
    if (!leakedOrder.ok) expect(leakedOrder.code).toBe("COMMERCE_NOT_FOUND");

    const leakedTrip = execute({
      domain: "execution",
      operation: "getTrip",
      identityProof: proofB,
      membershipId: membershipB.membershipId,
      payload: { id: "trip-order-a-secret" },
      correlationId: "c-leak-trip",
    });
    expect(leakedTrip.ok).toBe(false);
    if (!leakedTrip.ok) expect(leakedTrip.code).toBe("EXECUTION_NOT_FOUND");
  });

  it("rejects payload.workspaceId that disagrees with trusted Workspace and does not write into B", () => {
    const { execute } = gateway();
    const denied = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-persistence.tenancy.test-62",
      identityProof: proofA,
      membershipId: membershipA.membershipId,
      payload: { id: "order-override", workspaceId: "workspace-b" },
      correlationId: "c-override",
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe("V2_WORKSPACE_DENIED");

    const fromB = execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: proofB,
      membershipId: membershipB.membershipId,
      payload: { id: "order-override" },
      correlationId: "c-b-read",
    });
    expect(fromB.ok).toBe(false);
    if (!fromB.ok) expect(fromB.code).toBe("COMMERCE_NOT_FOUND");
  });

  it("does not return Workspace B data when ctxA supplies payload.workspaceId of B", () => {
    const { execute } = gateway();
    expect(
      execute({
        domain: "commerce",
        operation: "createOrder",
        idempotencyKey: "idemp-persistence.tenancy.test-63",
        identityProof: proofB,
        membershipId: membershipB.membershipId,
        payload: { id: "order-b" },
        correlationId: "c-create-b",
      }).ok,
    ).toBe(true);

    const widened = execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: proofA,
      membershipId: membershipA.membershipId,
      payload: { id: "order-b", workspaceId: "workspace-b" },
      correlationId: "c-widen",
    });
    expect(widened.ok).toBe(false);
    if (!widened.ok) expect(widened.code).toBe("V2_WORKSPACE_DENIED");
  });

  it("keeps matching payload.workspaceId from becoming write authority", () => {
    const { execute } = gateway();
    const created = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-persistence.tenancy.test-64",
      identityProof: proofA,
      membershipId: membershipA.membershipId,
      payload: { id: "order-match", workspaceId: "workspace-a" },
      correlationId: "c-match",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data).toEqual(
      expect.objectContaining({
        order: expect.objectContaining({ workspaceId: "workspace-a" }),
        trip: { trip: expect.objectContaining({ workspaceId: "workspace-a" }) },
      }),
    );
  });

  it("reuses one Membership lookup and the trusted workspace on nested Commerce → Execution", () => {
    const { execute, identityPort } = gateway();
    const created = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-persistence.tenancy.test-65",
      identityProof: proofA,
      membershipId: membershipA.membershipId,
      payload: { id: "order-nested" },
      correlationId: "c-nested",
    });
    expect(created.ok).toBe(true);
    expect(identityPort.lookupCount).toBe(1);
    if (!created.ok) return;
    expect(created.data).toEqual(
      expect.objectContaining({
        order: expect.objectContaining({ workspaceId: membershipA.workspaceId }),
        trip: { trip: expect.objectContaining({ workspaceId: membershipA.workspaceId }) },
      }),
    );
  });
});
