import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";
import type { MembershipRecord } from "../src/identity/identityPort";

const activeW1: MembershipRecord = {
  membershipId: "mem-a-w1",
  actorId: "actor-a",
  workspaceId: "ws-1",
  status: "active",
};

function gateway(memberships: MembershipRecord[]) {
  const identityPort = createMemoryIdentityPort(memberships);
  const { execute } = createPulseV2Gateway({ PULSE_V2_SUPABASE_URL: "" }, { identityPort });
  return { execute, identityPort };
}

describe("Slice 4 trusted authorization context", () => {
  it("creates AuthorizationContext from verified membership, not payload workspaceId", () => {
    const { execute } = gateway([activeW1]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      actorId: "actor-a",
      payload: { id: "so-authz", workspaceId: "ws-1" },
      correlationId: "c1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual(
      expect.objectContaining({
        order: expect.objectContaining({ workspaceId: "ws-1", id: "so-authz" }),
      }),
    );
  });

  it("does not use caller workspaceId as authority (mismatch fails closed)", () => {
    const { execute, identityPort } = gateway([activeW1]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      actorId: "actor-a",
      payload: { id: "so-w2", workspaceId: "ws-2" },
      correlationId: "c-mismatch",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("V2_WORKSPACE_DENIED");
    expect(identityPort.lookupCount).toBe(1);
  });

  it("fails closed without actorId", () => {
    const { execute } = gateway([activeW1]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      payload: { id: "so-x" },
      correlationId: "c-unauth",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("V2_UNAUTHENTICATED");
  });

  it("fails closed for unknown actor / no membership", () => {
    const { execute } = gateway([activeW1]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      actorId: "actor-unknown",
      payload: { id: "so-x" },
      correlationId: "c-none",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("V2_MEMBERSHIP_DENIED");
    expect(result.message).toContain("not_found");
  });

  it("fails closed for suspended membership", () => {
    const { execute } = gateway([{ ...activeW1, status: "suspended" }]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      actorId: "actor-a",
      payload: { id: "so-x" },
      correlationId: "c-sus",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("inactive");
  });

  it("fails closed for revoked membership", () => {
    const { execute } = gateway([{ ...activeW1, status: "revoked" }]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      actorId: "actor-a",
      payload: { id: "so-x" },
      correlationId: "c-rev",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("inactive");
  });

  it("fails closed for invalid membership selector", () => {
    const { execute } = gateway([activeW1]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      actorId: "actor-a",
      membershipId: "mem-other",
      payload: { id: "so-x" },
      correlationId: "c-sel",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("invalid_selector");
  });

  it("fails closed when multiple active memberships have no selector", () => {
    const { execute } = gateway([
      activeW1,
      { membershipId: "mem-a-w2", actorId: "actor-a", workspaceId: "ws-2", status: "active" },
    ]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      actorId: "actor-a",
      payload: { id: "so-x" },
      correlationId: "c-amb",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("ambiguous");
  });

  it("performs exactly one membership lookup per execute()", () => {
    const { execute, identityPort } = gateway([activeW1]);
    execute({
      domain: "commerce",
      operation: "getOrder",
      actorId: "actor-a",
      payload: { id: "missing" },
      correlationId: "c-lookup",
    });
    expect(identityPort.lookupCount).toBe(1);
  });

  it("nested createTrip reuses AuthorizationContext without a second membership lookup", () => {
    const { execute, identityPort } = gateway([activeW1]);
    const placed = execute({
      domain: "commerce",
      operation: "createOrder",
      actorId: "actor-a",
      payload: { id: "so-nested", workspaceId: "ws-2" },
      correlationId: "c-nested",
    });
    expect(placed.ok).toBe(false);
    if (placed.ok) return;
    expect(placed.code).toBe("V2_WORKSPACE_DENIED");
    expect(identityPort.lookupCount).toBe(1);

    const ok = execute({
      domain: "commerce",
      operation: "createOrder",
      actorId: "actor-a",
      payload: { id: "so-nested" },
      correlationId: "c-nested-ok",
    });
    expect(ok.ok).toBe(true);
    expect(identityPort.lookupCount).toBe(2);
    if (!ok.ok) return;
    expect(ok.data).toEqual(
      expect.objectContaining({
        order: expect.objectContaining({ workspaceId: "ws-1" }),
        trip: { trip: expect.objectContaining({ workspaceId: "ws-1", orderId: "so-nested" }) },
      }),
    );
  });

  it("scoped getOrder cannot read another workspace's order", () => {
    const actorB: MembershipRecord = {
      membershipId: "mem-b-w2",
      actorId: "actor-b",
      workspaceId: "ws-2",
      status: "active",
    };
    const { execute } = gateway([activeW1, actorB]);
    const created = execute({
      domain: "commerce",
      operation: "createOrder",
      actorId: "actor-a",
      payload: { id: "so-w1-only" },
      correlationId: "c-iso-1",
    });
    expect(created.ok).toBe(true);

    const leaked = execute({
      domain: "commerce",
      operation: "getOrder",
      actorId: "actor-b",
      payload: { id: "so-w1-only" },
      correlationId: "c-iso-2",
    });
    expect(leaked.ok).toBe(false);
    if (leaked.ok) return;
    expect(leaked.code).toBe("COMMERCE_NOT_FOUND");
  });
});
