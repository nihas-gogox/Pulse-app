export type MembershipStatus = "active" | "suspended" | "revoked";

/**
 * Membership-scoped Role. Names remain OWNER-DEFINED / OPEN — not a catalog.
 * Not PlatformPermission, Capability, or caller input.
 */
export type MembershipRole = string;

export type MembershipRecord = {
  membershipId: string;
  actorId: string;
  workspaceId: string;
  status: MembershipStatus;
  role: MembershipRole;
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
 * Trusted execution context for Identity-owned Workspace bootstrap.
 * actorId is Gateway output of resolveActor(IdentityProof), not caller proof.
 * Does not accept identityProof, workspaceId, membershipId, role, or AuthorizationContext.
 */
export type CreateWorkspaceInput = {
  actorId: string;
  correlationId: string;
  idempotencyKey: string;
};

export type CreateWorkspaceSuccess = {
  ok: true;
  workspaceId: string;
  membershipId: string;
  actorId: string;
  membershipStatus: "active";
  correlationId: string;
};

export type CreateWorkspaceFailureReason =
  | "not_implemented"
  | "failed"
  | "in_flight"
  | "conflict";

export type CreateWorkspaceFailure = {
  ok: false;
  reason: CreateWorkspaceFailureReason;
};

export type CreateWorkspaceResult = CreateWorkspaceSuccess | CreateWorkspaceFailure;

/**
 * Gateway identity authority. Implementations must not query production Identity.
 * Auth-subject → Actor mapping is Model B (local V2 IdentityPort).
 * Caller request.actorId is never Actor authority.
 *
 * createWorkspace is Identity-owned bootstrap (Workspace + first Membership).
 * Gateway must call resolveActor first; this method does not take IdentityProof.
 * Idempotency/correlation are passed through; this type does not implement them.
 */
export type IdentityPort = {
  resolveActor: (proof: IdentityProof) => ActorResolveResult;
  resolveMembership: (input: MembershipResolveInput) => MembershipResolveResult;
  createWorkspace: (input: CreateWorkspaceInput) => CreateWorkspaceResult;
};
