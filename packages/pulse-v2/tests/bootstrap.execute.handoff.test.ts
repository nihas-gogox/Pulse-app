import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";

const proofA = "proof-handoff-a";
const proofB = "proof-handoff-b";

function bootstrappedGateway() {
  const identityPort = createMemoryIdentityPort({
    actorProofs: [
      { proof: proofA, actorId: "actor-a" },
      { proof: proofB, actorId: "actor-b" },
    ],
    memberships: [],
  });
  const gateway = createPulseV2Gateway({ PULSE_V2_SUPABASE_URL: "" }, { identityPort });
  return { ...gateway, identityPort };
}

describe("bootstrap → execute() handoff", () => {
  it("createWorkspace Membership authorizes later execute() without payload workspaceId", () => {
    const { createWorkspace, execute, identityPort } = bootstrappedGateway();
    const created = createWorkspace({
      identityProof: proofA,
      correlationId: "c-boot",
      idempotencyKey: "idem-handoff-a",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const beforeLookup = identityPort.lookupCount;
    const placed = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-bootstrap.execute.handoff.test-34",
      identityProof: proofA,
      membershipId: created.membershipId,
      payload: { id: "so-handoff" },
      correlationId: "c-exec",
    });

    expect(placed.ok).toBe(true);
    if (!placed.ok) return;
    expect(identityPort.lookupCount).toBe(beforeLookup + 1);
    expect(placed.data).toEqual(
      expect.objectContaining({
        order: expect.objectContaining({
          id: "so-handoff",
          workspaceId: created.workspaceId,
        }),
        trip: {
          trip: expect.objectContaining({
            workspaceId: created.workspaceId,
            orderId: "so-handoff",
          }),
        },
      }),
    );
  });

  it("denies when payload workspaceId differs from Membership workspace", () => {
    const { createWorkspace, execute, identityPort } = bootstrappedGateway();
    const created = createWorkspace({
      identityProof: proofA,
      correlationId: "c-boot-override",
      idempotencyKey: "idem-override",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-bootstrap.execute.handoff.test-35",
      identityProof: proofA,
      membershipId: created.membershipId,
      payload: { id: "so-override", workspaceId: "ws-other" },
      correlationId: "c-override",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("V2_WORKSPACE_DENIED");
    expect(identityPort.lookupCount).toBe(1);
  });

  it("denies Actor A selecting Actor B's bootstrap Membership", () => {
    const { createWorkspace, execute, identityPort } = bootstrappedGateway();
    const a = createWorkspace({
      identityProof: proofA,
      correlationId: "c-a",
      idempotencyKey: "idem-a",
    });
    const b = createWorkspace({
      identityProof: proofB,
      correlationId: "c-b",
      idempotencyKey: "idem-b",
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;

    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-bootstrap.execute.handoff.test-36",
      identityProof: proofA,
      membershipId: b.membershipId,
      payload: { id: "so-cross" },
      correlationId: "c-cross",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("V2_MEMBERSHIP_DENIED");
    expect(result.message).toContain("invalid_selector");
    expect(identityPort.lookupCount).toBe(1);
  });

  it("denies Actor B proof with Actor A's Membership selector", () => {
    const { createWorkspace, execute } = bootstrappedGateway();
    const a = createWorkspace({
      identityProof: proofA,
      correlationId: "c-a2",
      idempotencyKey: "idem-a2",
    });
    expect(a.ok).toBe(true);
    if (!a.ok) return;

    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-bootstrap.execute.handoff.test-37",
      identityProof: proofB,
      membershipId: a.membershipId,
      payload: { id: "so-proof-cross" },
      correlationId: "c-proof-cross",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("V2_MEMBERSHIP_DENIED");
  });

  it("preserves SEC-001: caller actorId is not authority after bootstrap", () => {
    const { createWorkspace, execute, identityPort } = bootstrappedGateway();
    const created = createWorkspace({
      identityProof: proofA,
      correlationId: "c-sec",
      idempotencyKey: "idem-sec",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-bootstrap.execute.handoff.test-38",
      identityProof: proofA,
      actorId: "actor-b",
      membershipId: created.membershipId,
      payload: { id: "so-spoof" },
      correlationId: "c-spoof",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("V2_ACTOR_DENIED");
    expect(identityPort.lookupCount).toBe(0);
  });

  it("denies execute when the Actor has no Membership", () => {
    const { execute, identityPort } = bootstrappedGateway();
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-bootstrap.execute.handoff.test-39",
      identityProof: proofA,
      payload: { id: "so-none" },
      correlationId: "c-none",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("V2_MEMBERSHIP_DENIED");
    expect(result.message).toContain("not_found");
    expect(identityPort.lookupCount).toBe(1);
    expect(identityPort.workspaceCount).toBe(0);
  });
});
