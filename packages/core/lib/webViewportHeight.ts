import {
  applyIOSWebSafariViewportPin,
  isIOSWeb,
  readWebVisualViewportMetrics,
  WEB_KEYBOARD_INSET_THRESHOLD_PX,
} from "./webKeyboard";

export { WEB_KEYBOARD_INSET_THRESHOLD_PX };

/**
 * Mobile web: `100vh` is taller than the visible viewport when browser chrome is shown.
 *
 * - Any iOS browser (WebKit-mandated — Safari, Chrome/CriOS, etc.): pin `#root`
 *   to `visualViewport` (height + offsetTop) via CSS vars.
 * - Android Chrome (overlays-content): freeze layout height while keyboard is open;
 *   occlusion is handled via `--keyboard-height` in `useKeyboardVisible`.
 *
 * useKeyboardVisible's web sync() now owns all visualViewport listening and writes
 * --app-vh/--app-vt/--keyboard-height together in one pass (see that file). This
 * function used to run its own, separate visualViewport listener set for the same
 * CSS vars — two listener sets on the same events meant the pin and the keyboard
 * inset could land on different frames, which was the source of the iOS Safari
 * signup layout jumps. It now only performs the one-time initial write (so the
 * vars are correct before useKeyboardVisible's provider mounts) and claims
 * ownership from the static HTML bootstrap; it does not attach any listeners.
 */
export function installWebViewportHeight(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  // Claim ownership — suppresses setupViewportHeightBootstrap from the static HTML shell.
  (window as Window & { __appVhOwned?: boolean }).__appVhOwned = true;

  if (isIOSWeb()) {
    applyIOSWebSafariViewportPin();
  } else {
    const { height: visible } = readWebVisualViewportMetrics();
    const inner = window.innerHeight;
    document.documentElement.style.setProperty(
      "--app-vh",
      `${Math.max(visible, inner)}px`,
    );
    document.documentElement.style.setProperty("--app-vt", "0px");
  }

  return () => {
    (window as Window & { __appVhOwned?: boolean }).__appVhOwned = false;
  };
}

/** RN Web shell style — pairs with `app/+html.tsx` CSS on html/body/#root. */
export const WEB_APP_VIEWPORT_STYLE = {
  minHeight: "var(--app-vh, 100dvh)",
  height: "var(--app-vh, 100dvh)",
  maxHeight: "var(--app-vh, 100dvh)",
} as const;
