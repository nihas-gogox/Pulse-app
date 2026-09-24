import { Avatar } from "../../../components/Avatar";
import type { AvatarParty } from "@pulse/domain/lib/avatarContext";
import type { ResolvedPartyAvatarIdentity } from "@pulse/domain/lib/entityIdentity.types";

export type ChatPartyAvatarProps = {
  identity: ResolvedPartyAvatarIdentity;
  size: number;
  /** Current viewer's own message — shows personal photo per dual-identity rules. */
  isOwnUser?: boolean;
  userAvatarUrl?: string | null;
  userAvatarSeed?: string | null;
  userOrgLogoUrl?: string | null;
  userOrgOwnerAvatarSeed?: string | null;
  userName?: string;
};

/**
 * Chat avatar — routes through the global Avatar system.
 *
 * Own user  → personal context (own photo; dual-identity rule: chat = personal, not org logo).
 * Driver    → driver photo / initials.
 * Client/Supplier with org branding → org logo / initials.
 * Client/Supplier without org branding → personal photo / initials.
 */
export function ChatPartyAvatar({
  identity,
  size,
  isOwnUser = false,
  userAvatarUrl,
  userAvatarSeed,
  userOrgLogoUrl,
  userOrgOwnerAvatarSeed,
  userName,
}: ChatPartyAvatarProps) {
  let party: AvatarParty;

  if (isOwnUser) {
    party = {
      type: "user",
      name: userName ?? identity.displayName,
      avatarUrl: userAvatarUrl ?? null,
      avatarSeed: userAvatarSeed ?? null,
      orgLogoUrl: userOrgLogoUrl ?? null,
      orgOwnerAvatarSeed: userOrgOwnerAvatarSeed ?? null,
    };
    // personal context: chat always shows own photo, not org logo
    return <Avatar party={party} context="personal" size={size} shape="circle" />;
  }

  if (identity.entityType === "driver") {
    party = {
      type: "driver",
      name: identity.displayName,
      avatarUrl: identity.avatarUrl ?? null,
      avatarSeed: identity.avatarSeed ?? null,
    };
    return <Avatar party={party} size={size} shape="circle" />;
  }

  // Client or supplier — prefer org logo if available
  const hasOrgBranding = Boolean(
    (identity.organizationImageUrl ?? "").trim() ||
      (identity.organizationAvatarSeed ?? "").trim(),
  );

  if (hasOrgBranding) {
    party = {
      type: "organization",
      name: identity.displayName,
      logoUrl: identity.organizationImageUrl ?? null,
      ownerAvatarSeed: identity.organizationAvatarSeed ?? null,
    };
    return <Avatar party={party} size={size} shape="circle" />;
  }

  // No org branding — treat as user with personal photo
  party = {
    type: "user",
    name: identity.displayName,
    avatarUrl: identity.avatarUrl ?? null,
    avatarSeed: identity.avatarSeed ?? null,
  };
  return <Avatar party={party} context="personal" size={size} shape="circle" />;
}
