export type MembershipStatus = "active" | "suspended" | "revoked";

export type MembershipRecord = {
  membershipId: string;
  actorId: string;
  workspaceId: string;
  status: MembershipStatus;
};

export type MembershipResolveInput = {
  actorId: string;
  membershipId?: string;
};

export type MembershipResolveFailure = {
  ok: false;
  reason: "not_found" | "ambiguous" | "inactive" | "invalid_selector";
};

export type MembershipResolveSuccess = {
  ok: true;
  membership: MembershipRecord;
};

export type MembershipResolveResult = MembershipResolveSuccess | MembershipResolveFailure;

/**
 * Gateway membership authority. Implementations must not query production Identity.
 * Auth-subject → Actor mapping is OPEN; callers supply opaque actorId.
 */
export type IdentityPort = {
  resolveMembership: (input: MembershipResolveInput) => MembershipResolveResult;
};
