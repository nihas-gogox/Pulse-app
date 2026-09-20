/**
 * Caller-supplied tenant context. Not an identity system.
 * workspaceId is required on every persistence call; actorUserId is recorded only.
 */
export type V2TenantContext = {
  workspaceId: string;
  actorUserId: string | null;
};

export function requireWorkspaceId(ctx: V2TenantContext): string {
  const id = ctx.workspaceId.trim();
  if (!id) {
    throw new Error("V2 persistence requires workspaceId (tenant isolation).");
  }
  return id;
}
