/**
 * Hosted Supabase project refs that must never be used as a Pulse V2 backend.
 * These are public URL path segments (not secrets). Anon/service keys stay out of this package.
 *
 * production — shared Pulse / pulse-unified-base project
 * preprod    — hosted sibling; still not V2 isolation
 */
export const BLOCKED_V2_SUPABASE_PROJECT_REFS = [
  "nafxpivddesgsrthmosv",
  "mhedvagyuplkbrfaoctl",
] as const;

export type BlockedV2SupabaseProjectRef =
  (typeof BLOCKED_V2_SUPABASE_PROJECT_REFS)[number];
