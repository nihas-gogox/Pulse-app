/**
 * Org/fleet avatar resolution — global single source of truth.
 *
 * Priority (same logic as business app):
 *   1. organizationImageUrl  — org's uploaded logo (signed/public URL)
 *   2. ownerAvatarSeed       — org owner's profile seed → getUser2DAvatarUriForSeed
 *                              (this IS the same seed the business-app profile renders)
 *   3. ownerAvatarUrl        — org owner's uploaded photo URL
 *   4. hash-stable preset    — deterministic user-2D avatar from orgId+orgName
 */
import { USER_2D_AVATARS, getUser2DAvatarUriForSeed } from '@pulse/core/constants/UserAvatars';
import { resolvePartyDisplayUri } from '../../../lib/partyAvatarDisplay';

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Stable preset seed for an organization.
 * Picks from user-2D pool (same style as dispatcher/user profiles)
 * so org avatars are visually consistent with the business app.
 */
export function getFleetAvatarSeedForOrg(orgId: string, orgName?: string): string {
  const key = `${orgId ?? ''}|${orgName ?? ''}`;
  const idx = hashString(key) % USER_2D_AVATARS.length;
  return USER_2D_AVATARS[idx]!.seed;
}

/**
 * Deterministic URI for an org when no real avatar data is available.
 * Uses the user-2D preset pool — NOT driver cartoon presets.
 */
export function getFleetAvatarUriForOrg(orgId: string, orgName?: string): string {
  return getUser2DAvatarUriForSeed(getFleetAvatarSeedForOrg(orgId, orgName))!;
}

/**
 * Full org avatar resolution — use this everywhere instead of getFleetAvatarUriForOrg alone.
 *
 * @param orgId       organizations.id
 * @param orgName     organizations.name (for stable fallback)
 * @param logoUrl     organizations.logo_url (signed or public URL)
 * @param ownerSeed   org owner's profile.avatar_seed
 * @param ownerUrl    org owner's profile.avatar_url (signed or public URL)
 */
export function resolveOrgAvatarUri(
  orgId: string,
  orgName: string,
  logoUrl?: string | null,
  ownerSeed?: string | null,
  ownerUrl?: string | null,
): string {
  return (
    resolvePartyDisplayUri({
      organizationImageUrl: logoUrl ?? null,
      organizationAvatarSeed: ownerSeed ?? null,
      avatarUrl: ownerUrl ?? null,
      avatarSeed: null,
      entityType: 'client',
    }) ?? getFleetAvatarUriForOrg(orgId, orgName)
  );
}
