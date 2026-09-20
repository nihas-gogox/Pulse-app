/**
 * Trusted authorization context. Constructed only by the Gateway after IdentityPort
 * membership verification. Not assembled from payload.workspaceId.
 *
 * `role` is copied from the verified Membership. It is not a permission catalog
 * and does not currently drive allow/deny.
 */
export type AuthorizationContext = {
  actorId: string;
  membershipId: string;
  workspaceId: string;
  role: string;
  correlationId: string;
};
