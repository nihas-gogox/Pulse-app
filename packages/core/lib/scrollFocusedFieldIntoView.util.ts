import { Dimensions, Platform, ScrollView, View } from 'react-native';
import type { RefObject } from 'react';

import {
  isIOSWeb,
  shouldApplyWebKeyboardScrollInset,
  shouldAvoidWebKeyboardFormReflow,
} from './webKeyboard';

const DEFAULT_HEADER_OFFSET = 76;
const DEFAULT_BOTTOM_PAD = 20;
const IOS_FORM_ACCESSORY_PAD = 52;
/** First pass only; retries use instant scroll to avoid focus-flicker. */
const SCROLL_RETRY_MS = [160, 320] as const;

/**
 * Each call to scrollFocusedFieldIntoView schedules delayed retries
 * (see SCROLL_RETRY_MS). Tapping a second field before the first field's
 * retries finish left those retries pending — they fired later, measured
 * whatever field's wrapper View now sat at the old target position (layout
 * can shift between fields, e.g. an async hint line appearing/collapsing
 * above them), and scrolled/focused there instead. A module-level generation
 * counter invalidates any in-flight retries as soon as a new field is
 * focused, so only the most recently focused field's retries can ever run.
 */
let scrollRequestGeneration = 0;

/** Invalidate in-flight scroll-into-view retries (call when blurring the field). */
export function cancelPendingFocusedFieldScroll(): void {
  scrollRequestGeneration += 1;
}

type ScrollFieldOptions = {
  keyboardHeight?: number;
  headerOffset?: number;
  extraBottomPad?: number;
  animated?: boolean;
};

function readCssKeyboardHeight(): number {
  if (typeof document === 'undefined') return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--keyboard-height');
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function findScrollParent(el: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
      if (node.scrollHeight > node.clientHeight + 1) return node;
    }
    node = node.parentElement;
  }
  return null;
}

function readVisualViewportKeyboardInset(): number {
  if (typeof window === 'undefined') return 0;
  const vv = window.visualViewport;
  if (!vv) return 0;
  return Math.max(0, Math.round(window.innerHeight - vv.height - (vv.offsetTop ?? 0)));
}

/**
 * Keyboard occlusion to subtract from the visible bottom edge.
 * iOS web pins `#root` to visualViewport.height already — subtracting
 * `--keyboard-height` again over-scrolls and flickers on every focus (City step).
 */
function measuredKeyboardOcclusion(keyboardHeight: number): number {
  if (!shouldApplyWebKeyboardScrollInset()) return 0;
  return Math.max(
    keyboardHeight,
    readCssKeyboardHeight(),
    readVisualViewportKeyboardInset(),
  );
}

/** Returns true if the field was already within the visible area (no scroll applied). */
function scrollWebFieldIntoView(
  field: View,
  keyboardHeight: number,
  headerOffset: number,
  extraBottomPad: number,
  animated: boolean,
): boolean {
  const el = field as unknown as HTMLElement;
  if (!el?.getBoundingClientRect) return true;

  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  const measuredKb = measuredKeyboardOcclusion(keyboardHeight);
  const applyKbInset = shouldApplyWebKeyboardScrollInset();

  const rect = el.getBoundingClientRect();
  const scrollParent = findScrollParent(el);

  // Prefer the ScrollView's own box: signup docks a sticky footer via
  // marginBottom, so client rect already ends above the CTA. Falling back to
  // visualViewport double-counts the keyboard on iOS and causes focus flicker.
  let visibleTop: number;
  let visibleBottom: number;
  if (scrollParent) {
    const parentRect = scrollParent.getBoundingClientRect();
    visibleTop = parentRect.top + 8;
    visibleBottom =
      parentRect.bottom -
      (applyKbInset ? measuredKb + IOS_FORM_ACCESSORY_PAD + extraBottomPad : 12);
  } else {
    const viewportTop = vv?.offsetTop ?? 0;
    const viewportHeight = vv?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 0);
    visibleTop = viewportTop + headerOffset;
    visibleBottom =
      viewportTop +
      viewportHeight -
      measuredKb -
      (applyKbInset ? IOS_FORM_ACCESSORY_PAD + extraBottomPad : 12);
  }

  if (!scrollParent) {
    el.scrollIntoView?.({
      // `center` forces a document scroll even when the field is already
      // visible. On Android Chrome that scroll blurs the focused input.
      block: 'nearest',
      behavior: animated ? 'smooth' : 'auto',
    });
    return true;
  }

  // Already visible — skip so retries don't nudge (focus flicker on City step).
  if (rect.bottom <= visibleBottom && rect.top >= visibleTop) return true;

  if (rect.bottom > visibleBottom) {
    const target = scrollParent.scrollTop + (rect.bottom - visibleBottom) + 12;
    scrollParent.scrollTo({ top: target, behavior: animated ? 'smooth' : 'auto' });
  } else if (rect.top < visibleTop) {
    const target = scrollParent.scrollTop + (rect.top - visibleTop) - 8;
    scrollParent.scrollTo({ top: Math.max(0, target), behavior: animated ? 'smooth' : 'auto' });
  }
  return false;
}

function scrollNativeFieldIntoView(
  scroll: ScrollView,
  field: View,
  headerOffset: number,
  keyboardHeight: number,
  extraBottomPad: number,
  animated: boolean,
): void {
  const scrollNative = scroll as ScrollView & { getInnerViewNode?: () => number };
  const parent = scrollNative.getInnerViewNode?.();
  if (parent == null) return;

  field.measureLayout(
    parent,
    (_x, y, _w, height) => {
      const fieldBottom = y + height;
      const windowHeight = Dimensions.get('window').height;
      const visibleHeight = Math.max(
        120,
        windowHeight - keyboardHeight - headerOffset - extraBottomPad,
      );
      const targetByBottom = fieldBottom - visibleHeight + 20;
      const targetByTop = y - headerOffset;
      scroll.scrollTo({ y: Math.max(0, Math.max(targetByTop, targetByBottom)), animated });
    },
    () => {},
  );
}

/**
 * Scrolls a form field into the visible area above the keyboard.
 * Works on native (measureLayout) and mobile web (visualViewport + scroll parent).
 */
export function scrollFocusedFieldIntoView(
  scrollRef: RefObject<ScrollView | null>,
  fieldRef: RefObject<View | null>,
  options: ScrollFieldOptions = {},
): void {
  const scroll = scrollRef.current;
  const field = fieldRef.current;
  if (!scroll || !field) return;

  // Android Chrome: programmatic scroll of a focused input's overflow parent
  // blurs the input and closes the keyboard. Chrome already pans the visual
  // viewport to keep the caret on screen (overlays-content).
  if (Platform.OS === 'web' && shouldAvoidWebKeyboardFormReflow()) {
    cancelPendingFocusedFieldScroll();
    return;
  }

  const animated = options.animated ?? true;
  const headerOffset = options.headerOffset ?? DEFAULT_HEADER_OFFSET;
  const extraBottomPad = options.extraBottomPad ?? DEFAULT_BOTTOM_PAD;
  const keyboardHeight = options.keyboardHeight ?? 0;

  // Invalidates any retries still pending from a previously focused field —
  // see the comment on scrollRequestGeneration above.
  const generation = ++scrollRequestGeneration;

  // The retries exist because the iOS Safari keyboard/viewport geometry keeps
  // changing for a few hundred ms after focus (animation, autofill bar). Once
  // a pass finds the field already visible, later retries have nothing to
  // correct — running them anyway re-measures against a settled viewport and
  // can nudge the scroll position again, which reads as the field "scrolling
  // on its own" after the user stopped interacting.
  let settled = false;
  const run = (useAnimation: boolean) => {
    if (settled || generation !== scrollRequestGeneration) return;
    if (Platform.OS === 'web') {
      settled = scrollWebFieldIntoView(
        field,
        keyboardHeight,
        headerOffset,
        extraBottomPad,
        useAnimation,
      );
      return;
    }
    scrollNativeFieldIntoView(
      scroll,
      field,
      headerOffset,
      keyboardHeight,
      extraBottomPad,
      useAnimation,
    );
  };

  // Instant first paint on iOS web — smooth + retries stacked = City-step flicker.
  run(Platform.OS === 'web' && isIOSWeb() ? false : animated);
  for (const delay of SCROLL_RETRY_MS) {
    setTimeout(() => run(false), delay);
  }
}
