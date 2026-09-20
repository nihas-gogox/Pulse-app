/**
 * Trusted authorization context. Constructed only by the Gateway after IdentityPort
 * membership verification. Not assembled from payload.workspaceId.
 */
export type AuthorizationContext = {
  actorId: string;
  membershipId: string;
  workspaceId: string;
  correlationId: string;
};
