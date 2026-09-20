export const IDENTITY_SCHEMA = "v2_identity";

/**
 * Reserved. No identity tables until the identity/authorization decision.
 * Tenant key on business rows is caller-supplied workspace_id (unverified).
 */
export const IDENTITY_TABLES = [] as const;

export type IdentityTable = (typeof IDENTITY_TABLES)[number];
