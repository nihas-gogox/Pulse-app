import type { AuthProfile } from "../../auth/services/auth.service";
import type {
  IdentityOnboardingState,
  IdentityTrustLevel,
  IdentityVerificationState,
} from "../../../../../features/identity/types";

export function inferOperationalRole(profile: AuthProfile | null): string {
  if (!profile) return "member";
  if (profile.role === "driver") return "driver";
  if (profile.asset && profile.aggregated) return "hybrid_operator";
  if (profile.asset) return "asset_operator";
  if (profile.aggregated) return "broker_operator";
  return "member";
}

export function inferOnboardingState(profile: AuthProfile | null): IdentityOnboardingState {
  if (!profile) return "unknown";
  const hasName = !!(profile.full_name ?? profile.displayName)?.trim();
  const hasPhone = !!profile.phone?.trim();
  const hasCompany = !!profile.company_name?.trim() || profile.role === "driver";
  return hasName && hasPhone && hasCompany ? "completed" : "incomplete";
}

export function inferTrustLevel(params: {
  profile: AuthProfile | null;
  verificationState: IdentityVerificationState;
}): IdentityTrustLevel {
  const { profile, verificationState } = params;
  if (!profile) return "low";
  if (
    verificationState === "business_verified" ||
    verificationState === "gps_verified"
  ) {
    return "high";
  }
  if (verificationState === "driver_verified" || verificationState === "partial") {
    return "medium";
  }
  return profile.avatar_url || profile.avatar_seed ? "medium" : "low";
}

export function trustFromVerificationState(
  verificationState: IdentityVerificationState | null | undefined,
): IdentityTrustLevel {
  if (
    verificationState === "business_verified" ||
    verificationState === "gps_verified"
  ) {
    return "high";
  }
  if (verificationState === "driver_verified" || verificationState === "partial") {
    return "medium";
  }
  return "low";
}
