/**
 * Team invite contact precheck — detect existing Pulse accounts before pending signup invites.
 */
import { supabase } from "@pulse/core/lib/supabase";
import type { UserProfileForInvite } from "../../../types/organization";

export type TeamInvitePrecheckAction =
  | "pending_invite"
  | "invite_existing_user"
  | "already_member"
  | "already_invited"
  | "email_registered"
  | "belongs_to_other_org";

export type TeamInviteOtherOrg = {
  id: string;
  name: string;
};

export type TeamInvitePrecheckResult = {
  recommendedAction: TeamInvitePrecheckAction;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userPhone: string | null;
  otherOrgs: TeamInviteOtherOrg[];
  phoneMatchesInvite: boolean;
  message: string | null;
};

function mapPrecheck(payload: Record<string, unknown> | null): TeamInvitePrecheckResult {
  const action = (payload?.recommended_action as TeamInvitePrecheckAction) ?? "pending_invite";
  const otherRaw = payload?.other_orgs;
  const otherOrgs: TeamInviteOtherOrg[] = Array.isArray(otherRaw)
    ? otherRaw
        .map((row) => {
          const r = row as { id?: string; name?: string };
          if (!r?.id) return null;
          return { id: r.id, name: r.name ?? "Organization" };
        })
        .filter((x): x is TeamInviteOtherOrg => x != null)
    : [];

  return {
    recommendedAction: action,
    userId: (payload?.user_id as string) ?? null,
    userName: (payload?.user_name as string) ?? null,
    userEmail: (payload?.user_email as string) ?? null,
    userPhone: (payload?.user_phone as string) ?? null,
    otherOrgs,
    phoneMatchesInvite: payload?.phone_matches_invite === true,
    message: (payload?.message as string) ?? null,
  };
}

export async function precheckTeamInviteContact(
  orgId: string,
  phone: string,
  email?: string | null,
): Promise<{ error: Error | null; result: TeamInvitePrecheckResult | null }> {
  try {
    const { data, error } = await supabase().rpc("precheck_team_invite_contact", {
      p_org_id: orgId,
      p_phone: phone,
      p_email: email?.trim() || null,
    });
    if (error) return { error: new Error(error.message), result: null };
    return {
      error: null,
      result: mapPrecheck((data ?? null) as Record<string, unknown> | null),
    };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)), result: null };
  }
}

export async function lookupUserByEmail(email: string): Promise<{
  error: Error | null;
  profile: UserProfileForInvite | null;
}> {
  const trimmed = email.trim();
  if (!trimmed) return { error: new Error("Email is required"), profile: null };

  try {
    const { data, error } = await supabase().rpc("get_user_profile_by_email", {
      p_email: trimmed,
    });
    if (error) {
      const { data: fb, error: fbErr } = await supabase()
        .from("profiles")
        .select("id, full_name, phone, email, avatar_url, role")
        .ilike("email", trimmed)
        .limit(1)
        .maybeSingle();
      if (fbErr) return { error: new Error(fbErr.message), profile: null };
      if (!fb) return { error: null, profile: null };
      return {
        error: null,
        profile: {
          user_id: fb.id,
          full_name: fb.full_name,
          phone: fb.phone,
          email: fb.email,
          avatar_url: fb.avatar_url,
          role: fb.role,
        },
      };
    }
    const rows = Array.isArray(data) ? data : data ? [data] : [];
    if (!rows.length) return { error: null, profile: null };
    const row = rows[0] as {
      user_id: string;
      full_name: string | null;
      phone: string | null;
      email: string | null;
      avatar_url: string | null;
      role: string | null;
    };
    return {
      error: null,
      profile: {
        user_id: row.user_id,
        full_name: row.full_name,
        phone: row.phone,
        email: row.email,
        avatar_url: row.avatar_url,
        role: row.role,
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)), profile: null };
  }
}

export function precheckToProfile(result: TeamInvitePrecheckResult): UserProfileForInvite | null {
  if (!result.userId) return null;
  return {
    user_id: result.userId,
    full_name: result.userName,
    phone: result.userPhone,
    email: result.userEmail,
    avatar_url: null,
    role: "user",
  };
}
