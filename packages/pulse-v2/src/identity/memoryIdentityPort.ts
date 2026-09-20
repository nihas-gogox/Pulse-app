import type {
  CreateWorkspaceInput,
  CreateWorkspaceResult,
  IdentityPort,
  IdentityProof,
  MembershipRecord,
  MembershipResolveInput,
  MembershipResolveResult,
} from "./identityPort";

export type MemoryActorBinding = {
  proof: string;
  actorId: string;
};

type MemoryWorkspace = {
  workspaceId: string;
};

type CreateWorkspaceSlot = {
  workspaceId: string;
  membershipId: string;
  actorId: string;
};

/** Identity-assigned first Membership Role. Not a frozen catalog name. */
const FIRST_MEMBERSHIP_ROLE: string = "unspecified";

function idempotencySlotKey(actorId: string, idempotencyKey: string): string {
  return `${actorId}\u0000Identity.createWorkspace\u0000${idempotencyKey}`;
}

/**
 * Deterministic in-memory IdentityPort for tests. Not Auth. Not persistence.
 * Maps opaque proof strings to Actor ids; does not treat proof as actorId.
 * createWorkspace commits Workspace + first Membership together; idempotent per Actor+key.
 */
export function createMemoryIdentityPort(input: {
  actorProofs: MemoryActorBinding[];
  memberships: MembershipRecord[];
}): IdentityPort & {
  lookupCount: number;
  workspaceCount: number;
  membershipsForWorkspace: (workspaceId: string) => MembershipRecord[];
} {
  let lookupCount = 0;
  let nextId = 0;
  const memberships = [...input.memberships];
  const workspaces: MemoryWorkspace[] = [];
  const createSlots = new Map<string, CreateWorkspaceSlot>();

  const allocateId = (prefix: string): string => {
    nextId += 1;
    return `${prefix}-${nextId}`;
  };

  const port: IdentityPort & {
    lookupCount: number;
    workspaceCount: number;
    membershipsForWorkspace: (workspaceId: string) => MembershipRecord[];
  } = {
    get lookupCount() {
      return lookupCount;
    },
    get workspaceCount() {
      return workspaces.length;
    },
    membershipsForWorkspace(workspaceId: string) {
      return memberships.filter((row) => row.workspaceId === workspaceId);
    },
    resolveActor(proof: IdentityProof) {
      const value = proof.value.trim();
      if (!value) return { ok: false as const, reason: "unauthenticated" as const };
      const binding = input.actorProofs.find((row) => row.proof === value);
      if (!binding) return { ok: false as const, reason: "not_found" as const };
      return { ok: true as const, actorId: binding.actorId };
    },
    resolveMembership(membershipInput: MembershipResolveInput): MembershipResolveResult {
      lookupCount += 1;
      const actorId = membershipInput.actorId.trim();
      const selector = membershipInput.membershipId?.trim();
      const forActor = memberships.filter((m) => m.actorId === actorId);

      if (selector) {
        const row = forActor.find((m) => m.membershipId === selector);
        if (!row) return { ok: false, reason: "invalid_selector" };
        if (row.status !== "active") return { ok: false, reason: "inactive" };
        return { ok: true, membership: row };
      }

      const active = forActor.filter((m) => m.status === "active");
      if (active.length === 0) {
        if (forActor.length > 0) return { ok: false, reason: "inactive" };
        return { ok: false, reason: "not_found" };
      }
      if (active.length > 1) return { ok: false, reason: "ambiguous" };
      return { ok: true, membership: active[0] };
    },
    createWorkspace(createInput: CreateWorkspaceInput): CreateWorkspaceResult {
      const actorId = createInput.actorId.trim();
      const correlationId = createInput.correlationId.trim();
      const idempotencyKey = createInput.idempotencyKey.trim();
      if (!actorId || !idempotencyKey) {
        return { ok: false, reason: "failed" };
      }

      const slotId = idempotencySlotKey(actorId, idempotencyKey);
      const existing = createSlots.get(slotId);
      if (existing) {
        return {
          ok: true,
          workspaceId: existing.workspaceId,
          membershipId: existing.membershipId,
          actorId: existing.actorId,
          membershipStatus: "active",
          correlationId,
        };
      }

      const workspaceId = allocateId("ws");
      const membershipId = allocateId("mem");
      const workspace: MemoryWorkspace = { workspaceId };
      const membership: MembershipRecord = {
        membershipId,
        actorId,
        workspaceId,
        status: "active",
        role: FIRST_MEMBERSHIP_ROLE,
      };

      workspaces.push(workspace);
      memberships.push(membership);
      createSlots.set(slotId, { workspaceId, membershipId, actorId });

      return {
        ok: true,
        workspaceId,
        membershipId,
        actorId,
        membershipStatus: "active",
        correlationId,
      };
    },
  };
  return port;
}
