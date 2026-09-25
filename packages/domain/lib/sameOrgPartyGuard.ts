/**
 * Service-layer backstop: an organization must not create an offline client or
 * supplier that represents an ACTIVE member of that same organization.
 *
 * Why this exists
 * ---------------
 * `get_invitee_by_phone` / `get_invitees_by_phones` hide same-org active members
 * from invitee lookup, so the "FOUND ON PLATFORM" card can no longer offer a
 * colleague as a connectable org. But the "Add as offline instead" path skips
 * that lookup entirely and inserts straight into `clients` / `suppliers`, where
 * RLS (`is_org_member(organization_id)`) passes precisely because it IS your own
 * org. This closes that path.
 *
 * IMPORTANT — this is NOT database-level enforcement.
 * `clients` and `suppliers` both grant INSERT to the `authenticated` role, so a
 * direct PostgREST call bypasses this check entirely. True DB enforcement would
 * need a stable person/user foreign key on those tables; matching on phone in a
 * trigger is not viable because phone is not a unique identity in this system
 * (verified: two distinct profiles share one number, and many active members
 * have no phone at all). That schema change is deliberately out of scope here.
 *
 * Phone matching reuses `normalizePhoneForInviteeLookup` — the same canonical
 * last-10-digit form the backend RPCs use — so this never becomes a second,
 * divergent phone-matching implementation.
 */
import { normalizePhoneForInviteeLookup } from './phoneLookup';
import { supabase } from '@pulse/core/lib/supabase';

export const SAME_ORG_CLIENT_MESSAGE =
  'This number belongs to a member of your own organization. You cannot add your own team as a customer.';

export const SAME_ORG_SUPPLIER_MESSAGE =
  'This number belongs to a member of your own organization. You cannot add your own team as a supplier.';

/**
 * True when `phone` belongs to an ACTIVE member of `orgId`.
 *
 * Scoped to `status = 'active'` on purpose, matching `is_org_member()` and the
 * RPC exclusion: a former/inactive member is a legitimate external party and
 * must stay addable.
 *
 * Fails OPEN (returns false) when the phone is unusable or the membership probe
 * errors — this is a defence-in-depth guard, not the authoritative gate, and it
 * must never block a legitimate insert because of a transient lookup failure.
 */
export async function phoneBelongsToActiveOrgMember(
  orgId: string,
  phone: string | null | undefined,
): Promise<boolean> {
  const normalized = normalizePhoneForInviteeLookup(String(phone ?? ''));
  // Sub-10-digit input can't be matched to a canonical identity.
  if (!orgId || normalized.length < 10) return false;

  const { data, error } = await supabase()
    .from('organization_members')
    .select('user_id, profiles!inner(phone)')
    .eq('organization_id', orgId)
    .eq('status', 'active');

  if (error || !Array.isArray(data)) return false;

  return data.some((row) => {
    const rel = (row as { profiles?: { phone?: string | null } | Array<{ phone?: string | null }> })
      .profiles;
    const profile = Array.isArray(rel) ? rel[0] : rel;
    const memberPhone = profile?.phone;
    if (!memberPhone) return false;
    return normalizePhoneForInviteeLookup(String(memberPhone)) === normalized;
  });
}
