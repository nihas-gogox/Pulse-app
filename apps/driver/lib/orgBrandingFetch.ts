/**
 * Load organization display branding for driver avatar surfaces.
 *
 * Priority (matches `lib/avatarContext` OrgParty + wallet `resolveOrgAvatarUri`):
 *   organizations.logo_url → org.avatar_seed → owner profile.avatar_seed →
 *   owner profile.avatar_url
 *
 * Uses SECURITY DEFINER RPC `get_org_branding_for_driver` because drivers cannot
 * SELECT other orgs/profiles under RLS.
 */
import { supabase } from "@pulse/core/lib/supabase";

export type OrgBrandingRow = {
  logoUrl: string | null;
  /** Prefer org.avatar_seed, else owner profiles.avatar_seed (user-2D). */
  avatarSeed: string | null;
  /** Owner profiles.avatar_url when no logo. */
  avatarUrl: string | null;
};

/**
 * Batch-fetch logo + owner avatar branding for org ids.
 * Safe to call with empty list (returns {}).
 */
export async function fetchOrgBrandingByIds(
  orgIds: readonly string[],
): Promise<Record<string, OrgBrandingRow>> {
  const ids = Array.from(
    new Set(
      orgIds
        .map((id) => String(id ?? "").trim())
        .filter((id) => id.length > 0),
    ),
  );
  if (ids.length === 0) return {};

  const { data, error } = await supabase().rpc("get_org_branding_for_driver", {
    p_org_ids: ids,
  });
  if (error || !Array.isArray(data)) {
    if (__DEV__ && error) {
      console.warn("[orgBranding] get_org_branding_for_driver:", error.message);
    }
    return {};
  }

  const out: Record<string, OrgBrandingRow> = {};
  for (const row of data as Array<{
    organization_id?: string | null;
    logo_url?: string | null;
    avatar_seed?: string | null;
    avatar_url?: string | null;
  }>) {
    const orgId = String(row.organization_id ?? "").trim();
    if (!orgId) continue;
    out[orgId] = {
      logoUrl: (row.logo_url ?? "").trim() || null,
      avatarSeed: (row.avatar_seed ?? "").trim() || null,
      avatarUrl: (row.avatar_url ?? "").trim() || null,
    };
  }
  return out;
}
