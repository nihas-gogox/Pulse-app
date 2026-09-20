import fs from "node:fs";
import path from "node:path";
import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";
import type { MembershipRecord } from "../src/identity/identityPort";

const activeW1: MembershipRecord = {
  membershipId: "mem-a-w1",
  actorId: "actor-a",
  workspaceId: "ws-1",
  status: "active",
  role: "unspecified",
};

const actorB: MembershipRecord = {
  membershipId: "mem-b-w2",
  actorId: "actor-b",
  workspaceId: "ws-2",
  status: "active",
  role: "unspecified",
};

const proofA = "proof-a";
const proofB = "proof-b";

function gateway(memberships: MembershipRecord[]) {
  const actorIds = [...new Set(memberships.map((m) => m.actorId))];
  const identityPort = createMemoryIdentityPort({
    actorProofs: actorIds.map((actorId) => ({
      proof: actorId === "actor-a" ? proofA : actorId === "actor-b" ? proofB : `proof-${actorId}`,
      actorId,
    })),
    memberships,
  });
  const { execute } = createPulseV2Gateway({ PULSE_V2_SUPABASE_URL: "" }, { identityPort });
  return { execute, identityPort };
}

describe("Slice 4 trusted authorization context", () => {
  it("creates AuthorizationContext from verified membership, not payload workspaceId", () => {
    const { execute } = gateway([activeW1]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorization.test-1",
      identityProof: proofA,
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
      idempotencyKey: "idemp-authorization.test-2",
      identityProof: proofA,
      payload: { id: "so-w2", workspaceId: "ws-2" },
      correlationId: "c-mismatch",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("V2_WORKSPACE_DENIED");
    expect(identityPort.lookupCount).toBe(1);
  });

  it("fails closed without identity proof", () => {
    const { execute, identityPort } = gateway([activeW1]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorization.test-3",
      payload: { id: "so-x" },
      correlationId: "c-unauth",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("V2_UNAUTHENTICATED");
    expect(identityPort.lookupCount).toBe(0);
  });

  it("fails closed for unknown proof / no actor", () => {
    const { execute, identityPort } = gateway([activeW1]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorization.test-4",
      identityProof: "proof-unknown",
      payload: { id: "so-x" },
      correlationId: "c-none",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("V2_UNAUTHENTICATED");
    expect(result.message).toContain("not_found");
    expect(identityPort.lookupCount).toBe(0);
  });

  it("fails closed for suspended membership", () => {
    const { execute } = gateway([{ ...activeW1, status: "suspended" }]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorization.test-5",
      identityProof: proofA,
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
      idempotencyKey: "idemp-authorization.test-6",
      identityProof: proofA,
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
      idempotencyKey: "idemp-authorization.test-7",
      identityProof: proofA,
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
      { membershipId: "mem-a-w2", actorId: "actor-a", workspaceId: "ws-2", status: "active", role: "unspecified" },
    ]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorization.test-8",
      identityProof: proofA,
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
      identityProof: proofA,
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
      idempotencyKey: "idemp-authorization.test-9",
      identityProof: proofA,
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
      idempotencyKey: "idemp-authorization.test-10",
      identityProof: proofA,
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
    const { execute } = gateway([activeW1, actorB]);
    const created = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorization.test-11",
      identityProof: proofA,
      payload: { id: "so-w1-only" },
      correlationId: "c-iso-1",
    });
    expect(created.ok).toBe(true);

    const leaked = execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: proofB,
      payload: { id: "so-w1-only" },
      correlationId: "c-iso-2",
    });
    expect(leaked.ok).toBe(false);
    if (leaked.ok) return;
    expect(leaked.code).toBe("COMMERCE_NOT_FOUND");
  });
});

describe("Slice 4 Actor trust boundary (SEC-001)", () => {
  it("establishes AuthorizationContext from IdentityPort Actor, not caller actorId", () => {
    const { execute } = gateway([activeW1]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorization.test-12",
      identityProof: proofA,
      payload: { id: "so-trusted-actor" },
      correlationId: "c-trusted",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual(
      expect.objectContaining({
        order: expect.objectContaining({ workspaceId: "ws-1", id: "so-trusted-actor" }),
      }),
    );
  });

  it("denies when caller actorId conflicts with trusted Actor", () => {
    const { execute, identityPort } = gateway([activeW1, actorB]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorization.test-13",
      identityProof: proofA,
      actorId: "actor-b",
      payload: { id: "so-spoof" },
      correlationId: "c-spoof-actor",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("V2_ACTOR_DENIED");
    expect(identityPort.lookupCount).toBe(0);
  });

  it("uses trusted Actor when caller actorId is omitted", () => {
    const { execute } = gateway([activeW1]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorization.test-14",
      identityProof: proofA,
      payload: { id: "so-omit-actor" },
      correlationId: "c-omit",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual(
      expect.objectContaining({
        order: expect.objectContaining({ workspaceId: "ws-1" }),
      }),
    );
  });

  it("verifies membership belonging to the trusted Actor", () => {
    const { execute } = gateway([activeW1]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorization.test-15",
      identityProof: proofA,
      membershipId: "mem-a-w1",
      payload: { id: "so-mem-a" },
      correlationId: "c-mem-ok",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects another Actor's membership selector", () => {
    const { execute, identityPort } = gateway([activeW1, actorB]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorization.test-16",
      identityProof: proofA,
      membershipId: "mem-b-w2",
      payload: { id: "so-mem-b" },
      correlationId: "c-mem-spoof",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("V2_MEMBERSHIP_DENIED");
    expect(result.message).toContain("invalid_selector");
    expect(identityPort.lookupCount).toBe(1);
  });

  it("does not treat matching caller actorId as the source of Actor authority", () => {
    const { execute } = gateway([activeW1]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorization.test-17",
      identityProof: proofA,
      actorId: "actor-a",
      payload: { id: "so-matching-claim" },
      correlationId: "c-match-claim",
    });
    expect(result.ok).toBe(true);
  });

  it("memory IdentityPort does not encode Auth, JWT, Supabase, or Person semantics", () => {
    const portSrc = fs.readFileSync(
      path.join(__dirname, "../src/identity/memoryIdentityPort.ts"),
      "utf8",
    );
    const contractSrc = fs.readFileSync(
      path.join(__dirname, "../src/identity/identityPort.ts"),
      "utf8",
    );
    const combined = `${portSrc}\n${contractSrc}`;
    expect(combined).not.toMatch(/jwt/i);
    expect(combined).not.toMatch(/auth\.users/i);
    expect(combined).not.toMatch(/supabase/i);
    expect(combined).not.toMatch(/\bPerson\b/);
    expect(combined).not.toMatch(/federation/i);
    expect(combined).toContain("OPEN A");
  });
});
