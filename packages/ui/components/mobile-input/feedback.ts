/**
 * Platform-aware haptic / visual feedback for the SmartInput system.
 *
 * Mobile (native): expo-haptics
 * Web / unsupported platforms: no-op (never throws)
 *
 * All functions are fire-and-forget — never await, never catch in calling code.
 * Feedback failures must never interrupt financial entry.
 */

import { Platform } from 'react-native';
import type { FeedbackEvent } from '@pulse/domain/components/mobile-input/types';

// Lazily import expo-haptics so the web bundle doesn't include native modules
let Haptics: typeof import('expo-haptics') | null = null;
let hapticsLoadStarted = false;

function loadHaptics(): void {
  if (Platform.OS === 'web' || hapticsLoadStarted) return;
  hapticsLoadStarted = true;
  import('expo-haptics')
    .then((mod) => {
      Haptics = mod;
    })
    .catch(() => {
      Haptics = null;
    });
}

/**
 * Fire haptic feedback for a SmartInput event.
 * Safe to call from any platform — silently no-ops on web.
 */
export function triggerFeedback(event: FeedbackEvent): void {
  loadHaptics();
  const h = Haptics;
  if (!h) return;

  switch (event) {
    case 'keyPress':
      // Subtle click — every keypad tap
      h.impactAsync(h.ImpactFeedbackStyle.Light).catch(() => {});
      break;

    case 'delete':
      // Slightly heavier — backspace / long-press delete
      h.impactAsync(h.ImpactFeedbackStyle.Medium).catch(() => {});
      break;

    case 'apply':
      // Success confirmation — value saved
      h.notificationAsync(h.NotificationFeedbackType.Success).catch(() => {});
      break;

    case 'error':
      // Error — invalid entry attempted
      h.notificationAsync(h.NotificationFeedbackType.Error).catch(() => {});
      break;
  }
}
