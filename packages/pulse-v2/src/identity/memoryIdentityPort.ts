import type {
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

/**
 * Deterministic in-memory IdentityPort for tests. Not Auth. Not persistence.
 * Maps opaque proof strings to Actor ids; does not treat proof as actorId.
 */
export function createMemoryIdentityPort(input: {
  actorProofs: MemoryActorBinding[];
  memberships: MembershipRecord[];
}): IdentityPort & {
  lookupCount: number;
} {
  let lookupCount = 0;
  const port: IdentityPort & { lookupCount: number } = {
    get lookupCount() {
      return lookupCount;
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
      const forActor = input.memberships.filter((m) => m.actorId === actorId);

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
  };
  return port;
}
