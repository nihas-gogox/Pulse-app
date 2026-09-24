/**
 * Long-haul heartbeat policy (12 checkpoints, 350 km/day pace, stretch mode).
 * DB pacing views: `v_long_haul_health`, `v_driver_tracking_health`.
 */

export const LONG_HAUL_STANDARD_PINGS = 12;

/** After 12 checkpoints, continue reporting every 3h until trip completes / geofence. */
export const STRETCH_PING_INTERVAL_MS = 3 * 60 * 60 * 1000;

export type LongHaulHealthStatus =
  | "ON_TRACK"
  | "LATE_RISK"
  | "CRITICAL_DELAY"
  | "RUNNING_LATE"
  | string;

/** Trip statuses where distance pacing and checkpoint pings apply. */
export const ACTIVE_MOVEMENT_STATUSES_FOR_PING = new Set([
  "in_transit",
  "picked_up",
  "in_progress",
  "transit",
  "at_drop",
  "loading",
  "unloading",
  "at_pickup",
  "assigned",
  "active",
  "on_route",
]);

export function isTripStatusEligibleForLongHaulPings(status: string | null | undefined): boolean {
  return ACTIVE_MOVEMENT_STATUSES_FOR_PING.has(String(status ?? "").toLowerCase().trim());
}

/** v_long_haul_health / v_driver_tracking_health "behind schedule" family. */
export function isRunningLateHealthStatus(status: string | null | undefined): boolean {
  const h = String(status ?? "").trim().toUpperCase();
  return (
    h === "LATE_RISK" ||
    h === "CRITICAL_DELAY" ||
    h === "RUNNING_LATE" ||
    h === "RUNNING LATE"
  );
}

/**
 * Standard phase: spread `totalEtaMs` across remaining pings in the 12-ping budget
 * (distance / 350 km·day⁻¹ ETA → ~12 checkpoints on a ~1000 km long haul).
 */
export function standardHeartbeatIntervalMs(totalEtaMs: number, remainingPings: number): number {
  const MIN_MS = 5 * 60 * 1000;
  const MAX_MS = 8 * 60 * 60 * 1000;
  const rem = Math.max(1, Math.floor(remainingPings));
  const raw = totalEtaMs / rem;
  return Math.min(MAX_MS, Math.max(MIN_MS, Math.round(raw)));
}
