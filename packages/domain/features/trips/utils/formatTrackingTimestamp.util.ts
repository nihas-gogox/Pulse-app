/**
 * Shared timestamp formatter for tracking UI surfaces.
 * Extracted from LiveTrackingModal.tsx to avoid duplication across
 * ManifestDriverPingList, TrackingMapBlock, and LiveTrackingModal.
 */

/**
 * Returns a human-readable "Updated N min ago" or "Updated N hr ago" string.
 * Source of truth: driver_presence.recorded_at or TripTrackingMapStore.latest.recordedAt.
 * Never use client Date.now() as the timestamp source.
 */
export function formatLocationUpdatedAt(recordedAt: string): string {
  const then = new Date(recordedAt).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const diffM = Math.floor(diffMs / 60_000);
  if (diffM < 1) return 'Updated just now';
  if (diffM === 1) return 'Updated 1 min ago';
  if (diffM < 60) return `Updated ${diffM} min ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH === 1) return 'Updated 1 hr ago';
  return `Updated ${diffH} hr ago`;
}

/**
 * Returns seconds since recordedAt for a live "last seen N seconds ago" ticker.
 * Used by TrackingUiSnapshot.lastSeenSeconds — update via 1s setInterval, not per GPS ping.
 */
export function getSecondsSince(recordedAt: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(recordedAt).getTime()) / 1000));
}

/**
 * Date + time in IST for tracking timelines (journey log, live tracking, track & trace).
 * Uses `toLocaleString` — `toLocaleDateString` with hour options drops the date
 * in Hermes / some web Intl implementations and shows time only.
 * e.g. "02 Sept 2026, 5:07 pm"
 */
export function formatTrackingDateTime(iso: string | null | undefined): string {
  const raw = (iso ?? '').trim();
  if (!raw) return '—';
  try {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return raw.slice(0, 16).replace('T', ' ') || '—';
  }
}

/**
 * Absolute IST time string for checkpoint popup display.
 * e.g. "12 May 2026, 14:32:05"
 */
export function formatCheckpointTime(recordedAt: string): string {
  try {
    return new Date(recordedAt).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return recordedAt.slice(0, 16).replace('T', ' ');
  }
}
