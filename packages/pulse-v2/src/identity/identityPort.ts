export type MembershipStatus = "active" | "suspended" | "revoked";

export type MembershipRecord = {
  membershipId: string;
  actorId: string;
  workspaceId: string;
  status: MembershipStatus;
};

/**
 * Opaque identity proof. Not an Auth credential format (OPEN A).
 * Gateway must not interpret this as Actor id.
 */
export type IdentityProof = {
  value: string;
};

export type ActorResolveFailure = {
  ok: false;
  reason: "unauthenticated" | "not_found";
};

export type ActorResolveSuccess = {
  ok: true;
  actorId: string;
};

export type ActorResolveResult = ActorResolveSuccess | ActorResolveFailure;

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
 * Gateway identity authority. Implementations must not query production Identity.
 * Auth-subject → Actor mapping is OPEN; proof format is not specified here.
 * Caller request.actorId is never Actor authority.
 */
export type IdentityPort = {
  resolveActor: (proof: IdentityProof) => ActorResolveResult;
  resolveMembership: (input: MembershipResolveInput) => MembershipResolveResult;
};
