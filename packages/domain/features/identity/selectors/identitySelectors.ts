import type { AuthProfile } from "../../auth/services/auth.service";
import type { OrgMember } from "../../../types/organization";
import type { ResolvedIdentity, IdentityVerificationState } from "../../../../../features/identity/types";
import {
  inferOnboardingState,
  inferOperationalRole,
  inferTrustLevel,
} from "../trust/trustModel";

function fallbackDisplayName(userId: string): string {
  const id = (userId ?? "").trim();
  if (!id) return "User";
  return id.length <= 10 ? id : `${id.slice(0, 6)}...${id.slice(-4)}`;
}

export function composeResolvedIdentity(input: {
  userId: string;
  profile: AuthProfile | null;
  member: OrgMember | null;
  verificationState?: IdentityVerificationState | null;
}): ResolvedIdentity {
  const verificationState = input.verificationState ?? "none";
  const profile = input.profile;
  const member = input.member;
  const displayName =
    profile?.full_name?.trim() ||
    profile?.displayName?.trim() ||
    member?.full_name?.trim() ||
    profile?.phone?.trim() ||
    member?.phone?.trim() ||
    profile?.email?.trim() ||
    member?.email?.trim() ||
    fallbackDisplayName(input.userId);
  const avatar = profile?.avatar_url?.trim() || member?.avatar_url?.trim() || null;
  const avatarSeed = profile?.avatar_seed?.trim() || null;
  const operationalRole = inferOperationalRole(profile);
  const onboardingState = inferOnboardingState(profile);
  const trustLevel = inferTrustLevel({ profile, verificationState });
  return {
    userId: input.userId,
    displayName,
    avatar,
    avatarSeed,
    operationalRole,
    trustLevel,
    verificationState,
    onboardingState,
  };
}
