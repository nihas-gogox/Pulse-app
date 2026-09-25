import { CHAT_ACCENT, CHAT_ACCENT_SOFT } from "../../chatTheme";
import Theme from "@pulse/core/constants/Theme";
import { Platform, StyleSheet } from "react-native";

export const DRIVER_SWAP_PREV_SIZE = 26;
export const DRIVER_SWAP_NEXT_SIZE = 32;
export const DRIVER_SWAP_SHELL_W = 94;
export const DRIVER_SWAP_SHELL_H = 44;

const shellRadius = DRIVER_SWAP_SHELL_H / 2;

export const driverSwapAvatarStyles = StyleSheet.create({
  outer: {
    alignSelf: "flex-start",
  },
  shell: {
    width: DRIVER_SWAP_SHELL_W,
    height: DRIVER_SWAP_SHELL_H,
    borderRadius: shellRadius,
    borderWidth: 1,
    borderColor: "rgba(91, 94, 244, 0.18)",
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    ...(Platform.OS === "web"
      ? ({ boxSizing: "border-box" } as object)
      : {}),
  },
  track: {
    position: "absolute",
    left: 24,
    right: 26,
    top: DRIVER_SWAP_SHELL_H / 2 - 0.5,
    height: 1,
    backgroundColor: "rgba(91, 94, 244, 0.12)",
    borderRadius: 1,
  },
  prevSlot: {
    position: "absolute",
    left: 7,
    top: (DRIVER_SWAP_SHELL_H - DRIVER_SWAP_PREV_SIZE) / 2,
    zIndex: 1,
  },
  arrowSlot: {
    position: "absolute",
    left: (DRIVER_SWAP_SHELL_W - 18) / 2,
    top: (DRIVER_SWAP_SHELL_H - 18) / 2,
    zIndex: 3,
  },
  arrowPill: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.cardWhite,
    borderWidth: 1,
    borderColor: "rgba(91, 94, 244, 0.14)",
  },
  nextSlot: {
    position: "absolute",
    right: 6,
    top: (DRIVER_SWAP_SHELL_H - DRIVER_SWAP_NEXT_SIZE) / 2,
    zIndex: 2,
  },
  avatarRing: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CHAT_ACCENT_SOFT,
  },
  prevRing: {
    width: DRIVER_SWAP_PREV_SIZE,
    height: DRIVER_SWAP_PREV_SIZE,
    borderRadius: DRIVER_SWAP_PREV_SIZE / 2,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.28)",
  },
  prevFrost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.42)",
    borderRadius: DRIVER_SWAP_PREV_SIZE / 2,
  },
  nextRing: {
    width: DRIVER_SWAP_NEXT_SIZE,
    height: DRIVER_SWAP_NEXT_SIZE,
    borderRadius: DRIVER_SWAP_NEXT_SIZE / 2,
    borderWidth: 2,
    borderColor: "rgba(91, 94, 244, 0.38)",
  },
  newRingPulse: {
    position: "absolute",
    width: DRIVER_SWAP_NEXT_SIZE + 4,
    height: DRIVER_SWAP_NEXT_SIZE + 4,
    borderRadius: (DRIVER_SWAP_NEXT_SIZE + 4) / 2,
    borderWidth: 1.5,
    borderColor: CHAT_ACCENT,
    top: -2,
    left: -2,
  },
  presenceDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: CHAT_ACCENT,
    borderWidth: 1.5,
    borderColor: Theme.cardWhite,
    zIndex: 4,
  },
});
