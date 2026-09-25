/**
 * Trip tracking status gate and adaptive TAT-based checkpoint interval logic.
 *
 * Live GPS broadcast + map UI attach once a driver is on the trip (assigned /
 * pending acceptance / in-transit). Pre-assignment idle trips stay gated out.
 */

// Statuses that indicate the driver is actively moving on a leg.
const ACTIVE_TRACKING_STATUSES = new Set([
  'in_transit', 'going_to_pickup', 'moving',
  // DB aliases in use until status values are normalized:
  'in_progress', 'picked_up', 'transit', 'on_route', 'at_pickup', 'loading',
  'started', // primary status written by driver app on trip start
]);

/**
 * Returns true when the trip is on an active movement leg (post-start).
 * Prefer {@link isTripDriverMapEligible} for map / Track / ping UI — that also
 * covers assigned / pending_acceptance with a driver.
 */
export function isTripTrackingActive(
  status: string | null | undefined,
  completedAt?: string | null,
): boolean {
  if (!status) return false;
  if (completedAt) return false;
  return ACTIVE_TRACKING_STATUSES.has(status.toLowerCase());
}

/** Trip has a driver and may emit GPS — show map, trail, Track modal, and last-known pin. */
const DRIVER_MAP_ELIGIBLE_STATUSES = new Set([
  ...ACTIVE_TRACKING_STATUSES,
  "assigned",
  "confirmed",
  "pending_acceptance",
]);

/** No GPS ping within this window → driver treated as offline in hub + detail UI. */
export const DRIVER_LOCATION_STALE_MS = 15 * 60 * 1000;

export function isTripDriverMapEligible(
  status: string | null | undefined,
  completedAt: string | null | undefined,
  driverId?: string | null,
): boolean {
  if (completedAt) return false;
  if (!(driverId ?? "").trim()) return false;
  if (!status) return false;
  return DRIVER_MAP_ELIGIBLE_STATUSES.has(status.toLowerCase());
}

function latestIsoTimestamp(candidates: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const raw of candidates) {
    const t = (raw ?? "").trim();
    if (!t) continue;
    const ms = new Date(t).getTime();
    if (!Number.isFinite(ms)) continue;
    if (ms > bestMs) {
      bestMs = ms;
      best = t;
    }
  }
  return best;
}

/**
 * Full offline overlay only when the driver is in an active leg, has no live broadcast,
 * and no GPS ping in the last {@link DRIVER_LOCATION_STALE_MS}.
 */
export function shouldShowDriverTrackingOfflineOverlay(params: {
  tripStatus: string | null | undefined;
  completedAt?: string | null;
  driverId?: string | null;
  driverOnline: boolean;
  lastLocationAt?: string | null;
}): boolean {
  if (!isTripTrackingActive(params.tripStatus, params.completedAt)) return false;
  if (!(params.driverId ?? "").trim()) return false;
  if (params.driverOnline) return false;
  const lastAt = (params.lastLocationAt ?? "").trim();
  if (!lastAt) return true;
  const ageMs = Date.now() - new Date(lastAt).getTime();
  if (!Number.isFinite(ageMs)) return true;
  return ageMs > DRIVER_LOCATION_STALE_MS;
}

export function isDriverLocationRecentlySeen(
  lastLocationAt: string | null | undefined,
  maxAgeMs: number = DRIVER_LOCATION_STALE_MS,
): boolean {
  const lastAt = (lastLocationAt ?? "").trim();
  if (!lastAt) return false;
  const ageMs = Date.now() - new Date(lastAt).getTime();
  return Number.isFinite(ageMs) && ageMs <= maxAgeMs;
}

export { latestIsoTimestamp };

// ── Adaptive ping interval (12-ping TAT rule) ─────────────────────────────────

const BASELINE_SPEED_KM_PER_DAY = 350;
const TARGET_TOTAL_PINGS = 12;
const MIN_INTERVAL_HOURS = 0.5;  // 30 minutes
const MAX_INTERVAL_HOURS = 6;

/**
 * Calculates the adaptive ping interval in hours based on trip distance.
 *
 * TAT_days = distance / 350 km/day
 * pings_per_day = 12 / TAT_days
 * interval_hours = 24 / pings_per_day
 * Clamped to [30 min, 6 hours].
 *
 * Examples:
 *   700 km → TAT 2d → 6 pings/day → 4h interval
 *   350 km → TAT 1d → 12 pings/day → 2h interval
 *   175 km → TAT 0.5d → 24 pings/day → clamp → 30min interval
 */
export function getAdaptivePingIntervalHours(distanceKm: number | null): number {
  if (!distanceKm || distanceKm <= 0) return MAX_INTERVAL_HOURS;
  const tatDays = distanceKm / BASELINE_SPEED_KM_PER_DAY;
  const pingsPerDay = TARGET_TOTAL_PINGS / tatDays;
  const intervalHours = 24 / pingsPerDay;
  return Math.max(MIN_INTERVAL_HOURS, Math.min(MAX_INTERVAL_HOURS, intervalHours));
}

/** Always fetch exactly 12 checkpoint rows for the trail display. */
export const CHECKPOINT_FETCH_LIMIT = 12;

// ── Unified tracking state snapshot ──────────────────────────────────────────

import { getTripTrackingMapStore } from '../../tracking/map/TripTrackingMapStore';
import { formatLocationUpdatedAt } from './formatTrackingTimestamp.util';

const TRACKING_STALE_MS = 90_000;
const TRACKING_JUST_NOW_MS = 15_000;

export type TrackingState = {
  /** True when the broadcast channel is active (last tick within 90s). */
  broadcastActive: boolean;
  /** True when broadcast is active — same 90s threshold, no separate flag needed. */
  driverOnline: boolean;
  /** ISO timestamp of the last received GPS position (broadcast or DB seed). */
  lastSeenAt: string | null;
  /** Human-readable staleness: "Just now", "Updated N min ago", "Offline", "Unknown". */
  lastSeenLabel: string;
  /** Current GPS position from TripTrackingMapStore (null if not yet received). */
  currentPosition: { latitude: number; longitude: number } | null;
  /** Current trip stage/status passed through from the trip record. */
  tripStatus: string | null;
  // TODO: expose trail count from TripTrackingMapStore when the store tracks trail length.
  trailLength: number;
  /** True when a dispatcher-initiated driver ping is in-flight. */
  isPinging: boolean;
  /** ISO timestamp of the last successful ping response. */
  lastPingRespondedAt: string | null;
};

/** Zero-value TrackingState — use as fallback when tripId is null. */
export const defaultTrackingState: TrackingState = {
  broadcastActive: false,
  driverOnline: false,
  lastSeenAt: null,
  lastSeenLabel: 'Unknown',
  currentPosition: null,
  tripStatus: null,
  trailLength: 0,
  isPinging: false,
  lastPingRespondedAt: null,
};

/**
 * Pure synchronous snapshot of all tracking state for a trip.
 * Safe to call on every render — no side effects, no async.
 *
 * @param tripId - The trip UUID to read state for.
 * @param tripStatus - Current trip status string from the DB record.
 * @param overrides - Values from React hooks (broadcast timestamp, ping state)
 *   that live outside TripTrackingMapStore.
 */
export function getTrackingState(
  tripId: string,
  tripStatus: string | null,
  overrides?: {
    isPinging?: boolean;
    lastPingRespondedAt?: string | null;
    lastSeenAt?: string | null;
  },
): TrackingState {
  const store = getTripTrackingMapStore(tripId);
  const latest = store.latest;

  const currentPosition = latest
    ? { latitude: latest.latitude, longitude: latest.longitude }
    : null;

  // Take the most recent timestamp across all three sources.
  const candidates = [
    overrides?.lastSeenAt,
    overrides?.lastPingRespondedAt,
    latest?.recordedAt,
  ].filter((ts): ts is string => typeof ts === 'string' && ts.length > 0);

  const lastSeenAt = candidates.length > 0
    ? candidates.reduce((a, b) =>
        new Date(a).getTime() >= new Date(b).getTime() ? a : b
      )
    : null;

  const now = Date.now();
  const ageMs = lastSeenAt ? now - new Date(lastSeenAt).getTime() : Infinity;
  const broadcastActive = ageMs <= TRACKING_STALE_MS;
  const driverOnline = broadcastActive;

  let lastSeenLabel: string;
  if (!lastSeenAt) {
    lastSeenLabel = 'Unknown';
  } else if (ageMs < TRACKING_JUST_NOW_MS) {
    lastSeenLabel = 'Just now';
  } else if (!broadcastActive) {
    lastSeenLabel = 'Offline';
  } else {
    lastSeenLabel = formatLocationUpdatedAt(lastSeenAt);
  }

  return {
    broadcastActive,
    driverOnline,
    lastSeenAt,
    lastSeenLabel,
    currentPosition,
    tripStatus,
    trailLength: 0,
    isPinging: overrides?.isPinging ?? false,
    lastPingRespondedAt: overrides?.lastPingRespondedAt ?? null,
  };
}
