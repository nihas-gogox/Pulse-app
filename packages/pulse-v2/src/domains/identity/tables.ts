export const IDENTITY_SCHEMA = "v2_identity";

/**
 * Identity-owned collections. Local durable JSON (not Postgres, not RLS).
 */
export const IDENTITY_TABLES = [
  "auth_subjects",
  "actors",
  "workspaces",
  "memberships",
] as const;

export type IdentityTable = (typeof IDENTITY_TABLES)[number];
