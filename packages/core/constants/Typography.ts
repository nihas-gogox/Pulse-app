import { TextStyle } from "react-native";

/**
 * Global typography tokens.
 * Keep header typography consistent across all screens.
 */
export const Typography = {
  headerTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  } satisfies TextStyle,

  headerSubtitle: {
    fontSize: 7,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  } satisfies TextStyle,

  /** Sub-tabs (ACTIVE / HISTORY etc). Keep consistent across all modules. */
  subTabLabel: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  } satisfies TextStyle,

  /**
   * Network tab dark header: Connections / Invitations row, Load / Network chips.
   * Matches `app/(tabs)/network.tsx` filter tab row.
   */
  networkDarkHeaderNav: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  } satisfies TextStyle,

  /** Network main title (Allies Hub) on dark header — matches Tesla header weight. */
  networkScreenTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  } satisfies TextStyle,

  /** Route / load line on network LOAD cards — paired with `LoadCardRouteRow` leg text. */
  networkLoadRouteCity: {
    fontSize: 15,
    fontWeight: "900",
    fontStyle: "italic",
    letterSpacing: -0.25,
    textTransform: "uppercase",
  } satisfies TextStyle,
} as const;

export default Typography;

