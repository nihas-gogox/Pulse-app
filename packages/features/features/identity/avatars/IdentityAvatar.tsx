import { PartyAvatar } from "../../../components/PartyAvatar";
import type { ResolvedIdentity } from "../../../../../features/identity/types";

export function IdentityAvatar({
  identity,
  size = 24,
}: {
  identity: ResolvedIdentity;
  size?: number;
}) {
  return (
    <PartyAvatar
      name={identity.displayName}
      avatarUrl={identity.avatar}
      avatarSeed={identity.avatarSeed}
      entityType="client"
      size={size}
    />
  );
}
