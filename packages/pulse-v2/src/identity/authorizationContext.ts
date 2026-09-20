/**
 * Trusted authorization context. Constructed only by the Gateway after IdentityPort
 * membership verification. Not assembled from payload.workspaceId.
 *
 * `role` is copied from the verified Membership. It is not a permission catalog
 * and does not currently drive allow/deny.
 *
 * Request-scoped and immutable after Gateway construction.
 */
export type AuthorizationContext = Readonly<{
  actorId: string;
  membershipId: string;
  workspaceId: string;
  role: string;
  correlationId: string;
}>;
