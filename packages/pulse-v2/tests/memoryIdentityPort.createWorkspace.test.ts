import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";
import type { CreateWorkspaceInput } from "../src/identity/identityPort";

describe("MemoryIdentityPort createWorkspace", () => {
  const actorA = "actor-A";
  const actorB = "actor-B";

  function port() {
    return createMemoryIdentityPort({
      actorProofs: [
        { proof: "proof-A", actorId: actorA },
        { proof: "proof-B", actorId: actorB },
      ],
      memberships: [],
    });
  }

  function create(
    identity: ReturnType<typeof port>,
    actorId: string,
    idempotencyKey: string,
    correlationId: string,
  ) {
    const input: CreateWorkspaceInput = { actorId, correlationId, idempotencyKey };
    return identity.createWorkspace(input);
  }

  it("creates a Workspace for a trusted Actor", () => {
    const identity = port();
    const result = create(identity, actorA, "key-X", "C1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.actorId).toBe(actorA);
    expect(result.workspaceId.length).toBeGreaterThan(0);
    expect(result.membershipId.length).toBeGreaterThan(0);
    expect(result.membershipStatus).toBe("active");
    expect(result.correlationId).toBe("C1");
    expect(identity.workspaceCount).toBe(1);
  });

  it("creates exactly one first active Membership bound to Actor and Workspace", () => {
    const identity = port();
    const result = create(identity, actorA, "key-X", "C1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rows = identity.membershipsForWorkspace(result.workspaceId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      membershipId: result.membershipId,
      actorId: actorA,
      workspaceId: result.workspaceId,
      status: "active",
    });
  });

  it("replays the same Workspace and Membership for the same Actor and key", () => {
    const identity = port();
    const first = create(identity, actorA, "key-X", "C1");
    const second = create(identity, actorA, "key-X", "C2");
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.workspaceId).toBe(first.workspaceId);
    expect(second.membershipId).toBe(first.membershipId);
    expect(second.actorId).toBe(actorA);
    expect(second.membershipStatus).toBe("active");
    expect(identity.workspaceCount).toBe(1);
    expect(identity.membershipsForWorkspace(first.workspaceId)).toHaveLength(1);
  });

  it("uses the current correlationId on idempotent replay", () => {
    const identity = port();
    const first = create(identity, actorA, "key-X", "C1");
    const second = create(identity, actorA, "key-X", "C2");
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.correlationId).toBe("C1");
    expect(second.correlationId).toBe("C2");
    expect(second.workspaceId).toBe(first.workspaceId);
  });

  it("creates a separate Workspace for the same Actor with a different key", () => {
    const identity = port();
    const first = create(identity, actorA, "key-X", "C1");
    const second = create(identity, actorA, "key-Y", "C2");
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.workspaceId).not.toBe(first.workspaceId);
    expect(second.membershipId).not.toBe(first.membershipId);
    expect(identity.workspaceCount).toBe(2);
  });

  it("does not collide when different Actors reuse the same idempotency key", () => {
    const identity = port();
    const first = create(identity, actorA, "key-X", "C1");
    const second = create(identity, actorB, "key-X", "C2");
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.workspaceId).not.toBe(first.workspaceId);
    expect(second.actorId).toBe(actorB);
    expect(first.actorId).toBe(actorA);
    expect(identity.workspaceCount).toBe(2);
  });

  it("never returns a successful Workspace without exactly one active Membership", () => {
    const identity = port();
    const result = create(identity, actorA, "key-X", "C1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rows = identity.membershipsForWorkspace(result.workspaceId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("active");
  });
});
