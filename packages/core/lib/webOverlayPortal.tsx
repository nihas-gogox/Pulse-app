/**
 * Renders children into document.body on web so overlays sit above an already-open
 * RN Modal (Review Hub drawer, sheets). Nested RN Web Modals inherit the first
 * modal's stacking context and can appear clipped at the viewport edge.
 */
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Platform, type ViewStyle } from "react-native";

/** Above RN Web Modal (~9999) and RegistryWebDrawer (5001). */
export const WEB_OVERLAY_Z = 20000;

export const webFixedFill: ViewStyle =
  Platform.OS === "web"
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: WEB_OVERLAY_Z,
        width: "100%",
        height: "100%",
      }
    : {};

export function WebOverlayPortal({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(Platform.OS !== "web");

  useEffect(() => {
    if (Platform.OS === "web") setReady(true);
  }, []);

  if (!ready) return null;
  if (Platform.OS === "web" && typeof document !== "undefined") {
    return createPortal(children, document.body);
  }
  return <>{children}</>;
}
