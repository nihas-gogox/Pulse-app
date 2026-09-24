import { Platform, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  effectiveKeyboardInset,
  useKeyboardVisible,
} from './useKeyboardVisible';
import { useViewportWidth } from './useViewportWidth';
import { shouldAvoidWebKeyboardFormReflow } from '../webKeyboard';

/** Signup wizard desktop breakpoint (matches signUpConstants). */
export const MOBILE_WEB_FORM_DESKTOP_BREAKPOINT = 1024;

/** Sticky footer: primary button + padding (mobile web). */
export const MOBILE_WEB_DOCKED_FOOTER_HEIGHT = 88;

export interface MobileWebStepLayoutOptions {
  /** Extra bottom scroll padding (account step, etc.). */
  extraScrollPadding?: number;
  /** When true, primary CTA lives in scroll content (desktop/native behaviour). */
  inlinePrimary?: boolean;
  /**
   * @deprecated Keyboard handling is always on for mobile web form steps.
   * Kept for call-site compatibility only.
   */
  keyboardAware?: boolean;
}

/**
 * Single source for signup / onboarding step layout on mobile web + native.
 * Ensures docked footers, keyboard insets, and scroll clearance without per-step hacks.
 */
export function useMobileWebStepLayout(options: MobileWebStepLayoutOptions = {}) {
  const {
    extraScrollPadding = 0,
    inlinePrimary = false,
  } = options;

  const insets = useSafeAreaInsets();
  const width = useViewportWidth();
  const isDesktop = width >= MOBILE_WEB_FORM_DESKTOP_BREAKPOINT;
  const isMobileWeb = Platform.OS === 'web' && !isDesktop;
  const { keyboardVisible, keyboardHeight } = useKeyboardVisible();

  // Android Chrome overlays the keyboard (interactive-widget=overlays-content).
  // Adding that height as ScrollView margin / footer padding reflows the form
  // under the focused input, which Chromium treats as "page moved" and blurs.
  // Same class of bug as shrinking `--app-vh` in htmlShell.ts.
  const keyboardInset =
    isMobileWeb && !shouldAvoidWebKeyboardFormReflow()
      ? effectiveKeyboardInset(keyboardVisible, keyboardHeight, 280)
      : 0;

  /** Mobile web always docks the CTA — inline scroll CTAs break with the iOS keyboard. */
  const useDockedFooter = isMobileWeb ? true : !inlinePrimary;

  const footerPaddingBottom =
    Math.max(insets.bottom, isDesktop ? 8 : 4) +
    (isMobileWeb ? keyboardInset : 0);

  // Real on-screen height of the docked footer: its own content height
  // (MOBILE_WEB_DOCKED_FOOTER_HEIGHT) plus whatever bottom padding it renders
  // with (safe-area inset / keyboard inset). Must match footerStyle's
  // paddingBottom exactly below, or the scroll clearance and the footer's
  // actual height drift apart and the scroll box's height calc goes wrong
  // again (see scrollClearance comment).
  const footerClearance = useDockedFooter
    ? MOBILE_WEB_DOCKED_FOOTER_HEIGHT + footerPaddingBottom
    : 0;

  // Small breathing-room padding for real overflowing content — NOT the
  // footer's clearance. The footer must never be reserved via scroll content
  // padding: padding inside contentContainerStyle inflates the *scrollable
  // content height*, so on short steps (e.g. Organization — one field) the
  // ScrollView reports more scrollable height than there is real content,
  // and the whole page becomes scrollable to reveal nothing but that padding.
  // The footer's space must instead be reserved by shrinking the scroll
  // container itself — see scrollClearance below, applied to styles.scroll.
  const scrollPaddingBottom = 16 + extraScrollPadding + keyboardInset;

  // Applied as marginBottom on the ScrollView's own box (not its content) so
  // the visible scroll viewport is genuinely shorter, matching the footer
  // that overlays it — the ScrollView can then correctly report "no more
  // content" on short steps instead of remaining scrollable past real content.
  const scrollClearance = useDockedFooter ? footerClearance : 0;

  const rootStyle: ViewStyle = {
    flex: 1,
    minHeight: 0,
    ...(isMobileWeb ? { position: 'relative' as const } : {}),
  };

  const footerStyle: ViewStyle = useDockedFooter
    ? {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 2,
        paddingBottom: footerPaddingBottom,
      }
    : {
        paddingBottom: footerPaddingBottom,
      };

  return {
    isDesktop,
    isMobileWeb,
    keyboardVisible,
    keyboardInset,
    useDockedFooter,
    showCtaInScroll: inlinePrimary && !isMobileWeb,
    scrollPaddingBottom,
    scrollClearance,
    rootStyle,
    footerStyle,
    insets,
  };
}
