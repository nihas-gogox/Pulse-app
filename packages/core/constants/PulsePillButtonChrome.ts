/**
 * Global illustration pill button — pastel blue fill + ink outline (+ Add Load family).
 * Import styles for inline Pressables or use `PulsePillButton` component.
 */
import Theme from "./Theme";
import { Platform, StyleSheet, type TextStyle, type ViewStyle } from "react-native";

export const PULSE_PILL_BUTTON_RADIUS = 999;
export const PULSE_PILL_BUTTON_BORDER_WIDTH = 2;

/** Base container — merge with size preset + local overrides. */
export const pulsePillButtonContainer: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  borderRadius: PULSE_PILL_BUTTON_RADIUS,
  borderWidth: PULSE_PILL_BUTTON_BORDER_WIDTH,
  borderColor: Theme.buttonPrimaryBorder,
  backgroundColor: Theme.buttonPrimary,
};

export const pulsePillButtonContainerCompact: ViewStyle = {
  ...pulsePillButtonContainer,
  gap: 5,
  minHeight: 32,
  paddingVertical: 6,
  paddingHorizontal: 12,
};

export const pulsePillButtonContainerDefault: ViewStyle = {
  ...pulsePillButtonContainer,
  gap: 7,
  minHeight: 36,
  paddingVertical: 8,
  paddingHorizontal: 16,
};

export const pulsePillButtonContainerLarge: ViewStyle = {
  ...pulsePillButtonContainer,
  gap: 7,
  minHeight: 40,
  paddingVertical: 10,
  paddingHorizontal: 18,
};

export const pulsePillButtonContainerFullWidth: ViewStyle = {
  alignSelf: 'stretch',
  maxWidth: '100%',
  ...Platform.select({
    web: { boxSizing: 'border-box', width: '100%' } as object,
    default: { width: '100%' },
  }),
};

export const pulsePillButtonContainerIconOnly: ViewStyle = {
  ...pulsePillButtonContainer,
  width: 44,
  height: 44,
  minHeight: 44,
  paddingHorizontal: 0,
  paddingVertical: 0,
};

export const pulsePillButtonLabelBase: TextStyle = {
  fontWeight: "700",
  color: Theme.buttonPrimaryText,
  textAlign: "center",
};

export const pulsePillButtonLabelCompact: TextStyle = {
  ...pulsePillButtonLabelBase,
  fontSize: 11,
  letterSpacing: -0.1,
};

export const pulsePillButtonLabelDefault: TextStyle = {
  ...pulsePillButtonLabelBase,
  fontSize: 10,
  letterSpacing: 0.2,
};

export const pulsePillButtonLabelLarge: TextStyle = {
  ...pulsePillButtonLabelBase,
  fontSize: 12,
  letterSpacing: 0.25,
};

export const pulsePillButtonPressed: ViewStyle = {
  backgroundColor: Theme.buttonPrimaryPressed,
};

/** Transparent outline pill — ink border + dark label (empty-state CTAs, secondary adds). */
export const pulsePillButtonContainerOutline: ViewStyle = {
  ...pulsePillButtonContainer,
  backgroundColor: "transparent",
};

export const pulsePillButtonContainerOutlineDefault: ViewStyle = {
  ...pulsePillButtonContainerDefault,
  backgroundColor: "transparent",
};

export const pulsePillButtonPressedOutline: ViewStyle = {
  backgroundColor: "rgba(77, 54, 54, 0.06)",
};

export const pulsePillButtonDisabled: ViewStyle = {
  opacity: 0.5,
};

export type PulsePillButtonVariant = "filled" | "outline" | "dark";

/** Dark navy CTA — #0f172a fill + white label (Record payout, dark tabs, etc.). */
export const pulseDarkFilledButtonContainer: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  borderRadius: 14,
  backgroundColor: Theme.buttonDark,
  borderWidth: 0,
};

export const pulseDarkFilledButtonContainerPill: ViewStyle = {
  ...pulseDarkFilledButtonContainer,
  borderRadius: PULSE_PILL_BUTTON_RADIUS,
  minHeight: 44,
  paddingVertical: 12,
  paddingHorizontal: 20,
};

export const pulseDarkFilledButtonLabel: TextStyle = {
  fontWeight: "800",
  color: Theme.buttonDarkText,
  textAlign: "center",
  fontSize: 14,
  letterSpacing: 0.3,
};

export const pulseDarkFilledButtonLabelCompact: TextStyle = {
  ...pulseDarkFilledButtonLabel,
  fontSize: 8,
  fontWeight: "800",
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

/** Label + icon color for a button background (transparent/light → ink, dark fill → white). */
export function pulseButtonLabelColor(backgroundColor?: string): string {
  const bg = (backgroundColor ?? "").toLowerCase().trim();
  if (
    !bg ||
    bg === "transparent" ||
    bg === "rgba(0,0,0,0)" ||
    bg === Theme.buttonPrimary.toLowerCase() ||
    bg === Theme.buttonPrimaryPressed.toLowerCase() ||
    bg === "#ffffff" ||
    bg === "#fff" ||
    bg === Theme.cardWhite.toLowerCase() ||
    bg === Theme.screenBackground.toLowerCase()
  ) {
    return Theme.buttonPrimaryText;
  }
  if (
    bg === Theme.buttonDark.toLowerCase() ||
    bg === Theme.buttonMatteBlack.toLowerCase() ||
    bg === Theme.brandBlueInk.toLowerCase() ||
    bg === Theme.primary.toLowerCase() ||
    bg === "#0f172a" ||
    bg === "#151515" ||
    bg === "#4d3636"
  ) {
    return Theme.buttonDarkText;
  }
  return Theme.buttonPrimaryText;
}

export function pulsePillButtonVariantStyles(
  variant: PulsePillButtonVariant = "filled",
  size: PulsePillButtonSize = "default",
): {
  container: ViewStyle;
  label: TextStyle;
  pressed: ViewStyle;
  iconColor: string;
} {
  const sizeStyles = pulsePillButtonSizeStyles(size);
  switch (variant) {
    case "dark":
      return {
        container: pulseDarkFilledButtonContainerPill,
        label: pulseDarkFilledButtonLabel,
        pressed: { opacity: 0.92 },
        iconColor: Theme.buttonDarkText,
      };
    case "outline":
      return {
        container: {
          ...sizeStyles.container,
          backgroundColor: "transparent",
        },
        label: sizeStyles.label,
        pressed: pulsePillButtonPressedOutline,
        iconColor: Theme.buttonPrimaryText,
      };
    default:
      return {
        container: sizeStyles.container,
        label: sizeStyles.label,
        pressed: pulsePillButtonPressed,
        iconColor: Theme.buttonPrimaryText,
      };
  }
}

/** StyleSheet mirror for screens that prefer StyleSheet.create. */
export const pulsePillButtonStyles = StyleSheet.create({
  container: pulsePillButtonContainerDefault,
  containerCompact: pulsePillButtonContainerCompact,
  containerLarge: pulsePillButtonContainerLarge,
  containerFullWidth: pulsePillButtonContainerFullWidth,
  containerIconOnly: pulsePillButtonContainerIconOnly,
  label: pulsePillButtonLabelDefault,
  labelCompact: pulsePillButtonLabelCompact,
  labelLarge: pulsePillButtonLabelLarge,
  pressed: pulsePillButtonPressed,
  containerOutline: pulsePillButtonContainerOutlineDefault,
  pressedOutline: pulsePillButtonPressedOutline,
  disabled: pulsePillButtonDisabled,
  darkContainer: pulseDarkFilledButtonContainer,
  darkContainerPill: pulseDarkFilledButtonContainerPill,
  darkLabel: pulseDarkFilledButtonLabel,
  darkLabelCompact: pulseDarkFilledButtonLabelCompact,
});

export type PulsePillButtonSize = "compact" | "default" | "large" | "icon";

export function pulsePillButtonSizeStyles(size: PulsePillButtonSize = "default"): {
  container: ViewStyle;
  label: TextStyle;
} {
  switch (size) {
    case "compact":
      return {
        container: pulsePillButtonContainerCompact,
        label: pulsePillButtonLabelCompact,
      };
    case "large":
      return {
        container: pulsePillButtonContainerLarge,
        label: pulsePillButtonLabelLarge,
      };
    case "icon":
      return {
        container: pulsePillButtonContainerIconOnly,
        label: pulsePillButtonLabelDefault,
      };
    default:
      return {
        container: pulsePillButtonContainerDefault,
        label: pulsePillButtonLabelDefault,
      };
  }
}

/** Upgrade legacy primary button style objects to illustration pill chrome. */
export function asPulsePillButtonStyle(style: ViewStyle): ViewStyle {
  const webCursor =
    Platform.OS === "web"
      ? ({
          cursor: style.opacity === 0.5 ? "not-allowed" : "pointer",
        } as ViewStyle)
      : null;
  return {
    ...pulsePillButtonContainerDefault,
    ...style,
    borderRadius: PULSE_PILL_BUTTON_RADIUS,
    borderWidth: PULSE_PILL_BUTTON_BORDER_WIDTH,
    borderColor: Theme.buttonPrimaryBorder,
    backgroundColor: style.backgroundColor ?? Theme.buttonPrimary,
    ...webCursor,
  };
}
