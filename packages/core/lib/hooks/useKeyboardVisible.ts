import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

import {
  applyIOSWebSafariViewportPin,
  shouldApplyWebKeyboardScrollInset,
  readWebVisualViewportMetrics,
} from "../webKeyboard";

/** Ignore visualViewport jitter from mobile browser chrome (URL bar). */
const WEB_KEYBOARD_INSET_THRESHOLD_PX = 48;

/** CSS custom property written synchronously on every viewport event — bypasses React re-render lag. */
const CSS_VAR_KEYBOARD_HEIGHT = "--keyboard-height";

function setCssKeyboardHeight(px: number): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(CSS_VAR_KEYBOARD_HEIGHT, `${px}px`);
}

interface VirtualKeyboardApi {
  boundingRect: { height: number };
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

type NavigatorWithVK = Navigator & {
  virtualKeyboard?: VirtualKeyboardApi;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  return target.isContentEditable;
}

/** Chrome overlays-content: keyboard geometry via Virtual Keyboard API. */
function readVirtualKeyboardInset(): number {
  const vk = (navigator as NavigatorWithVK).virtualKeyboard;
  if (!vk) return 0;
  const h = vk.boundingRect.height;
  return h > 0 ? Math.round(h) : 0;
}

/**
 * Tracks keyboard visibility and occluded height.
 *
 * - Native: React Native `Keyboard` events.
 * - Mobile web (`interactive-widget=overlays-content`): visualViewport when it
 *   shrinks, Virtual Keyboard API `geometrychange`, focus fallback, and resize.
 */
export function useKeyboardVisible() {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined" || typeof document === "undefined") {
        return;
      }

      let focusOutTimer: ReturnType<typeof setTimeout> | undefined;
      let focusInTimer: ReturnType<typeof setTimeout> | undefined;

      // Last inset committed to React state. Android Chrome fires visualViewport
      // `scroll` + `resize` many times while the keyboard animates, each a few
      // px apart. Committing every one of those re-renders the whole step and
      // re-runs the scroll-clearance layout, which reads on screen as the
      // keyboard/page flickering. Only commit when the value actually changes
      // by more than animation jitter, or when open/closed flips.
      let lastCommittedInset = -1;
      let lastCommittedOpen: boolean | null = null;
      const INSET_COMMIT_EPSILON_PX = 24;

      const applyInset = (inset: number) => {
        const open = inset >= WEB_KEYBOARD_INSET_THRESHOLD_PX;
        const height = open ? inset : 0;
        const sameOpenState = lastCommittedOpen === open;
        const withinJitter =
          Math.abs(height - lastCommittedInset) < INSET_COMMIT_EPSILON_PX;
        if (sameOpenState && withinJitter) {
          // Still keep the CSS var exact — it is free and does not re-render.
          setCssKeyboardHeight(height);
          applyIOSWebSafariViewportPin();
          return;
        }
        lastCommittedInset = height;
        lastCommittedOpen = open;
        // Write CSS vars synchronously in one pass — keyboard-height and the iOS
        // Safari viewport pin (--app-vh/--app-vt) must land in the same tick so
        // React and the CSS pin never disagree about the current frame's geometry.
        setCssKeyboardHeight(height);
        applyIOSWebSafariViewportPin();
        setKeyboardHeight(height);
        setKeyboardVisible(open);
      };

      const readInset = (): number => {
        const metrics = readWebVisualViewportMetrics();
        const measured = Math.max(metrics.keyboardInset, readVirtualKeyboardInset());
        if (!metrics.keyboardOpen && measured < WEB_KEYBOARD_INSET_THRESHOLD_PX) {
          return 0;
        }
        return measured >= WEB_KEYBOARD_INSET_THRESHOLD_PX
          ? measured
          : metrics.keyboardOpen
            ? Math.max(metrics.keyboardInset, WEB_KEYBOARD_INSET_THRESHOLD_PX)
            : 0;
      };

      // Called directly from listeners — no requestAnimationFrame defer. The old
      // code scheduled this a frame after applyIOSWebSafariViewportPin (called
      // independently by installWebViewportHeight's own listener set), so the
      // CSS pin and the React-driven keyboard inset landed on different frames.
      // Now this is the only place either is written, synchronously, on the
      // same visualViewport event.
      const sync = () => {
        applyInset(readInset());
      };

      const onFocusIn = (e: FocusEvent) => {
        if (!isEditableTarget(e.target)) return;
        // A pending "keyboard closed" commit from tapping away from the previous
        // field is now stale — focus moved to another input, so the keyboard is
        // staying up. Cancelling it stops the visible close/reopen bounce when
        // moving between the name / email / password fields.
        clearTimeout(focusOutTimer);
        // Do NOT sync() synchronously here: at focusin the keyboard has not
        // opened yet, so the viewport still reads "closed" and we would commit
        // keyboardVisible=false only to flip it true a moment later — the exact
        // open/close flicker. The viewport resize event and the delayed sync
        // below report the real geometry.
        clearTimeout(focusInTimer);
        focusInTimer = setTimeout(sync, 350);
      };

      const onFocusOut = () => {
        focusOutTimer = setTimeout(() => {
          const active = document.activeElement;
          if (isEditableTarget(active)) return;
          // Reset immediately in CSS so layout doesn't wait for React re-render.
          setCssKeyboardHeight(0);
          sync();
        }, 200);
      };

      sync();
      const vv = window.visualViewport;
      vv?.addEventListener("resize", sync);
      vv?.addEventListener("scroll", sync);
      window.addEventListener("resize", sync);

      document.addEventListener("focusin", onFocusIn, true);
      document.addEventListener("focusout", onFocusOut, true);

      const vk = (navigator as NavigatorWithVK).virtualKeyboard;
      vk?.addEventListener("geometrychange", sync);

      return () => {
        clearTimeout(focusOutTimer);
        clearTimeout(focusInTimer);
        vv?.removeEventListener("resize", sync);
        vv?.removeEventListener("scroll", sync);
        window.removeEventListener("resize", sync);
        document.removeEventListener("focusin", onFocusIn, true);
        document.removeEventListener("focusout", onFocusOut, true);
        vk?.removeEventListener("geometrychange", sync);
      };
    }

    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvt, (e) => {
      setKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return { keyboardVisible, keyboardHeight };
}

/** Bottom padding for a docked composer: safe area when closed, minimal when keyboard is up. */
export function dockPaddingBottom(
  bottomInset: number,
  keyboardVisible: boolean,
  closedMin = 4,
): number {
  return keyboardVisible ? closedMin : Math.max(bottomInset, closedMin);
}

/**
 * Lift for bottom-docked composers when the keyboard occludes the viewport.
 * Mobile web may report `keyboardVisible` before `keyboardHeight` is measured.
 */
export function effectiveKeyboardInset(
  keyboardVisible: boolean,
  keyboardHeight: number,
  fallbackWhenVisible = 240,
): number {
  if (!keyboardVisible) return 0;
  if (Platform.OS === "web" && !shouldApplyWebKeyboardScrollInset()) {
    return 0;
  }
  return keyboardHeight >= WEB_KEYBOARD_INSET_THRESHOLD_PX
    ? keyboardHeight
    : fallbackWhenVisible;
}
