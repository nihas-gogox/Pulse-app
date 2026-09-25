import Theme from "@pulse/core/constants/Theme";
import type { PartyEntityType } from "./partyAvatarDisplay";
import type { PartyEntityAccent } from "./partyEntityAccent.types";

type OfflinePartyRole = "client" | "supplier" | "driver" | "vehicle";

/** Offline client tile — golden fill + ink icon. */
const OFFLINE_CLIENT_ACCENT: PartyEntityAccent = {
  ring: Theme.brandBlueInk,
  glow: Theme.accentGoldMuted,
  glowCore: Theme.accentGoldMuted,
  tint: Theme.accentGold,
};

/** Offline supplier tile — pink fill + ink icon (latest badge style). */
const OFFLINE_SUPPLIER_ACCENT: PartyEntityAccent = {
  ring: Theme.brandBlueInk,
  glow: "rgba(254, 170, 188, 0.35)",
  glowCore: "rgba(254, 170, 188, 0.2)",
  tint: Theme.loadDoneSubTabBg,
};

/** Offline driver tile — green fill. */
const OFFLINE_DRIVER_ACCENT: PartyEntityAccent = {
  ring: Theme.driverEmeraldDark,
  glow: "rgba(21, 128, 61, 0.34)",
  glowCore: "rgba(21, 128, 61, 0.2)",
  tint: Theme.darkGreen,
};

/** Offline vehicle tile — black fill with white icon. */
const OFFLINE_VEHICLE_ACCENT: PartyEntityAccent = {
  ring: Theme.textPrimaryDark,
  glow: "rgba(15, 23, 42, 0.35)",
  glowCore: "rgba(15, 23, 42, 0.2)",
  tint: Theme.textPrimaryDark,
};

/** True when we should show a role icon plate instead of photo / seed / initials. */
export function shouldUseOfflinePartyRoleAvatar(
  isIntegrated: boolean | undefined,
  entityType: PartyEntityType,
): boolean {
  return (
    isIntegrated === false &&
    (entityType === "client" ||
      entityType === "supplier" ||
      entityType === "driver" ||
      entityType === "vehicle")
  );
}

export function offlinePartyRoleIconSize(avatarSize: number): number {
  return Math.max(14, Math.round(avatarSize * 0.44));
}

export function offlinePartyRolePresentation(entityType: OfflinePartyRole) {
  if (entityType === "supplier") {
    return {
      accent: OFFLINE_SUPPLIER_ACCENT,
      iconColor: Theme.textPrimaryDark,
      accessibilityLabel: "Supplier",
    };
  }
  if (entityType === "driver") {
    return {
      accent: OFFLINE_DRIVER_ACCENT,
      iconColor: Theme.textOnPrimary,
      accessibilityLabel: "Driver",
    };
  }
  if (entityType === "vehicle") {
    return {
      accent: OFFLINE_VEHICLE_ACCENT,
      iconColor: Theme.textOnPrimary,
      accessibilityLabel: "Vehicle",
    };
  }
  return {
    accent: OFFLINE_CLIENT_ACCENT,
    iconColor: Theme.brandBlueInk,
    accessibilityLabel: "Client",
  };
}
