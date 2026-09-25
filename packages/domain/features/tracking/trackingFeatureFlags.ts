/**
 * Tracking subsystem feature flags (env-driven, no Zustand).
 */
export function isTrackingBroadcastV1Enabled(): boolean {
  if (typeof process === 'undefined') return false;
  return String(process.env.EXPO_PUBLIC_TRACKING_BROADCAST_V1 ?? '').trim() === '1';
}
