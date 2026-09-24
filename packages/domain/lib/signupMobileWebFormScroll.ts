/**
 * Single entry point for business-signup / onboarding mobile-web form scroll +
 * keyboard dismiss. Call sites must not also call document scrollIntoView.
 */
import { Platform, type ScrollView, type View } from 'react-native';
import type { RefObject } from 'react';

import {
  cancelPendingFocusedFieldScroll,
  scrollFocusedFieldIntoView,
} from '@pulse/core/lib/scrollFocusedFieldIntoView.util';
import {
  blurActiveWebEditable,
  isIOSWeb,
  isWebEditableDomTarget,
} from '@pulse/core/lib/webKeyboard';

export { isWebEditableDomTarget };

/** True when a touch on this target should dismiss the keyboard (outside an editable). */
export function shouldDismissOnTouchTarget(target: EventTarget | null): boolean {
  if (Platform.OS !== 'web') return false;
  return !isWebEditableDomTarget(target);
}

/**
 * Blur the active web editable and cancel in-flight focus-scroll retries.
 * Used on outside tap / scroll-begin so iOS viewport pin can expand again.
 */
export function dismissKeyboardForOutsideGesture(): boolean {
  if (Platform.OS !== 'web') return false;
  cancelPendingFocusedFieldScroll();
  return blurActiveWebEditable();
}

export type SignupFormScrollIntoViewOptions = {
  keyboardHeight?: number;
  headerOffset?: number;
  extraBottomPad?: number;
  /** Desktop may animate; iOS web always uses instant inside the util. */
  animated?: boolean;
};

/** Scroll a registered field wrapper into the form ScrollView (iOS-safe). */
export function scrollSignupFormFieldIntoView(
  scrollRef: RefObject<ScrollView | null>,
  fieldRef: RefObject<View | null>,
  options: SignupFormScrollIntoViewOptions = {},
): void {
  scrollFocusedFieldIntoView(scrollRef, fieldRef, options);
}

/** ScrollView props shared by signup / onboarding form shells on mobile web. */
export function signupMobileWebScrollGestureProps(options: {
  enabled: boolean;
  keyboardVisible?: boolean;
  onDismiss?: () => void;
}): {
  keyboardDismissMode: 'on-drag' | 'none';
  onScrollBeginDrag?: () => void;
  onTouchStart?: (event: { target?: unknown }) => void;
  bounces?: boolean;
} {
  if (!options.enabled) {
    return {
      keyboardDismissMode: Platform.OS === 'web' ? 'none' : 'on-drag',
    };
  }

  const dismiss = () => {
    dismissKeyboardForOutsideGesture();
    options.onDismiss?.();
  };

  return {
    keyboardDismissMode: 'on-drag',
    onScrollBeginDrag: dismiss,
    // Deliberately no onTouchStart dismiss. touchstart fires *before* the
    // browser moves focus, so dismissing there blurs the currently-focused
    // input on every tap — including a tap that is moving focus to the next
    // field. The keyboard closes and then reopens a frame later when focus
    // lands, which is the open/close flicker on Android Chrome. Dragging
    // (onScrollBeginDrag + keyboardDismissMode) still dismisses.
    //
    // Also: do not pair this with a React keyboard-inset reflow on Android
    // Chrome (see shouldAvoidWebKeyboardFormReflow). Shrinking the ScrollView
    // and then scrollTo'ing the focused field is what unfocuses the IME on
    // Join your team (name / email / password).
    bounces: !(Platform.OS === 'web' && isIOSWeb() && options.keyboardVisible),
  };
}
