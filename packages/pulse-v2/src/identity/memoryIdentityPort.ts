import type {
  IdentityPort,
  MembershipRecord,
  MembershipResolveInput,
  MembershipResolveResult,
} from "./identityPort";

/**
 * Deterministic in-memory IdentityPort for tests. Not Auth. Not persistence.
 */
export function createMemoryIdentityPort(memberships: MembershipRecord[]): IdentityPort & {
  lookupCount: number;
} {
  let lookupCount = 0;
  const port: IdentityPort & { lookupCount: number } = {
    get lookupCount() {
      return lookupCount;
    },
    resolveMembership(input: MembershipResolveInput): MembershipResolveResult {
      lookupCount += 1;
      const actorId = input.actorId.trim();
      const selector = input.membershipId?.trim();
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
  };
  return port;
}
