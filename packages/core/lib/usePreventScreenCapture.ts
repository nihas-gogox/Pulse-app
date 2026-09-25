/**
 * Prevents screenshots/screen capture on sensitive screens (PII, finance).
 * Uses expo-screen-capture when available (native); no-op on web or if module unavailable.
 * See docs/PII_AND_SCREEN_POLICY.md.
 */
import { Platform } from 'react-native';

let usePreventScreenCaptureHook: (() => void) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module, guarded by try/catch
  const screenCapture = require('expo-screen-capture');
  usePreventScreenCaptureHook = screenCapture.usePreventScreenCapture ?? null;
} catch {
  usePreventScreenCaptureHook = null;
}

function noop(): void {}

export function usePreventScreenCapture(): void {
  if (Platform.OS === 'web') return;
  (usePreventScreenCaptureHook ?? noop)();
}
