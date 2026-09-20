import type { IdentityRepository } from "../domains/identity/repository";
import type {
  CreateWorkspaceInput,
  CreateWorkspaceResult,
  IdentityPort,
  IdentityProof,
  MembershipRecord,
  MembershipResolveInput,
  MembershipResolveResult,
} from "./identityPort";
import type { LocalAuthAdapter } from "./localAuthAdapter";
import { V2PersistenceError } from "../persistence/v2PersistenceError";

const FIRST_MEMBERSHIP_ROLE: string = "unspecified";

function idempotencySlotKey(actorId: string, idempotencyKey: string): string {
  return `${actorId}\u0000Identity.createWorkspace\u0000${idempotencyKey}`;
}

/**
 * Model B IdentityPort: local Auth Subject → Actor bind/create, then Membership.
 * Does not query production Auth. Does not auto-create Membership on first login.
 */
export function createV2IdentityPort(input: {
  auth: LocalAuthAdapter;
  repository: IdentityRepository;
}): IdentityPort & { lookupCount: number } {
  let lookupCount = 0;
  const { auth, repository } = input;

  const port: IdentityPort & { lookupCount: number } = {
    get lookupCount() {
      return lookupCount;
    },
    resolveActor(proof: IdentityProof) {
      const verified = auth.verify(proof.value);
      if (!verified.ok) return { ok: false as const, reason: "unauthenticated" as const };

      const existing = repository.getActorIdBySubject(verified.subject.subjectId);
      if (existing) return { ok: true as const, actorId: existing };

      const actorId = repository.createActor();
      try {
        repository.bindSubject(verified.subject.subjectId, actorId);
      } catch (err) {
        if (err instanceof V2PersistenceError && err.kind === "duplicate") {
          const raced = repository.getActorIdBySubject(verified.subject.subjectId);
          if (raced) return { ok: true as const, actorId: raced };
        }
        throw err;
      }
      return { ok: true as const, actorId };
    },
    resolveMembership(membershipInput: MembershipResolveInput): MembershipResolveResult {
      lookupCount += 1;
      const actorId = membershipInput.actorId.trim();
      const selector = membershipInput.membershipId?.trim();
      const forActor = repository.listMembershipsForActor(actorId);

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
      const existing = repository.getCreateSlot(slotId);
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

      const workspaceId = repository.allocateId("ws");
      const membershipId = repository.allocateId("mem");
      const membership: MembershipRecord = {
        membershipId,
        actorId,
        workspaceId,
        status: "active",
        role: FIRST_MEMBERSHIP_ROLE,
      };
      repository.commitWorkspaceBootstrap({
        workspaceId,
        membership,
        slot: { slotKey: slotId, workspaceId, membershipId, actorId },
      });

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
