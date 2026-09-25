import type { DriverPresenceRow } from "../../tracking/services/driverPresence.service";
import type { TripStageMetrics } from "./tripStageMetrics";
import type { TripTimelineEvent } from "./tripTimeline";
import type { JourneyMetrics } from "./tripJourneyMetrics";

/**
 * Operational Alerts — a thin rule layer over the Stage Metrics Engine.
 * Each rule is a pure function of (metrics, events, presence, now,
 * thresholds); none of them re-derive timing from raw trip.status or
 * geofence events directly. If a rule needs a signal the metrics engine
 * doesn't expose (POD upload, driver presence), it reads the timeline/
 * presence directly rather than reimplementing anything computeTripStageMetrics
 * already does.
 *
 * No persistence here — same "derive, don't store" stance as the metrics
 * engine. Every alert this module returns is, by construction, active right
 * now; `isActive` is always true today and exists so a future persisted
 * alert history (deactivated/resolved rows) can reuse the same shape.
 */

export type OperationalAlertSeverity = "info" | "warning" | "critical";
export type OperationalAlertCategory =
  | "acceptance"
  | "pickup"
  | "transit"
  | "delivery"
  | "tracking";

export interface OperationalAlert {
  id: string;
  severity: OperationalAlertSeverity;
  category: OperationalAlertCategory;
  title: string;
  description: string;
  startedAt: string;
  isActive: boolean;
}

export interface AlertThresholds {
  acceptanceDelayMs: number;
  pickupDwellMs: number;
  /**
   * Flat threshold, not relative to trip.estimated_duration. A
   * duration-relative version ("running 1.5x the estimate") is a reasonable
   * future refinement, not built here to avoid parsing/validating that
   * interval column speculatively.
   */
  transitUnusuallyLongMs: number;
  dropDwellMs: number;
  podOverdueMs: number;
  noLocationUpdateMs: number;
}

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  acceptanceDelayMs: 10 * 60_000,
  pickupDwellMs: 30 * 60_000,
  transitUnusuallyLongMs: 8 * 60 * 60_000,
  dropDwellMs: 30 * 60_000,
  podOverdueMs: 20 * 60_000,
  noLocationUpdateMs: 15 * 60_000,
};

function startedAtFromThreshold(anchorIso: string, thresholdMs: number): string {
  return new Date(new Date(anchorIso).getTime() + thresholdMs).toISOString();
}

export function ruleAcceptanceDelayed(
  metrics: TripStageMetrics,
  thresholds: AlertThresholds,
): OperationalAlert | null {
  const d = metrics.acceptanceDuration;
  if (!d?.isRunning || d.ms <= thresholds.acceptanceDelayMs || !metrics.assignedAt) return null;
  return {
    id: "acceptance_delayed",
    severity: "warning",
    category: "acceptance",
    title: "Acceptance delayed",
    description: "Trip has not been accepted by the driver.",
    startedAt: startedAtFromThreshold(metrics.assignedAt, thresholds.acceptanceDelayMs),
    isActive: true,
  };
}

export function rulePickupDwellExceeded(
  metrics: TripStageMetrics,
  thresholds: AlertThresholds,
): OperationalAlert | null {
  const d = metrics.pickupDwellDuration;
  if (!d?.isRunning || d.ms <= thresholds.pickupDwellMs || !metrics.pickupArrivalAt) return null;
  return {
    id: "pickup_dwell_exceeded",
    severity: "warning",
    category: "pickup",
    title: "Pickup dwell exceeded",
    description: "Driver has been at the pickup location longer than expected.",
    startedAt: startedAtFromThreshold(metrics.pickupArrivalAt, thresholds.pickupDwellMs),
    isActive: true,
  };
}

/**
 * Flat-duration fallback for trips with no route distance to measure real
 * progress against. Once JourneyMetrics is available for a trip (it has a
 * planned distance and has departed pickup), ruleJourneyBehindSchedule
 * supersedes this entirely — elapsed time alone is a poor signal for
 * long-haul (a 20hr transit is normal on one route, alarming on another),
 * so this rule deliberately stands down rather than double-alerting.
 */
export function ruleTransitUnusuallyLong(
  metrics: TripStageMetrics,
  thresholds: AlertThresholds,
  journeyMetrics: JourneyMetrics | null,
): OperationalAlert | null {
  if (journeyMetrics) return null;
  const d = metrics.transitDuration;
  if (!d?.isRunning || d.ms <= thresholds.transitUnusuallyLongMs || !metrics.pickupDepartureAt) {
    return null;
  }
  return {
    id: "transit_unusually_long",
    severity: "warning",
    category: "transit",
    title: "Transit unusually long",
    description: "Trip has been in transit longer than expected.",
    startedAt: startedAtFromThreshold(metrics.pickupDepartureAt, thresholds.transitUnusuallyLongMs),
    isActive: true,
  };
}

function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString("en-IN")} km`;
}

function formatDurationMs(ms: number): string {
  const totalMin = Math.round(Math.abs(ms) / 60_000);
  const days = Math.floor(totalMin / (24 * 60));
  const hours = Math.floor((totalMin % (24 * 60)) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = totalMin % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/**
 * Journey Health alert: distance/pace-based, not elapsed-time-based.
 * Fires only at the two tiers that actually warrant operator attention —
 * "watch" is a soft signal shown in the UI's health badge, not urgent
 * enough to be an actionable alert on its own.
 */
export function ruleJourneyBehindSchedule(
  journeyMetrics: JourneyMetrics | null,
  nowMs: number,
): OperationalAlert | null {
  if (!journeyMetrics) return null;
  if (journeyMetrics.health !== "delayed" && journeyMetrics.health !== "critical") return null;

  const delayText =
    journeyMetrics.delayMs != null && journeyMetrics.delayMs > 0
      ? `, running ${formatDurationMs(journeyMetrics.delayMs)} behind expected arrival`
      : "";

  return {
    id: "journey_behind_schedule",
    severity: journeyMetrics.health === "critical" ? "critical" : "warning",
    category: "transit",
    title: journeyMetrics.health === "critical" ? "Vehicle critically behind schedule" : "Vehicle behind schedule",
    description:
      `Covered ${formatKm(journeyMetrics.completedDistanceKm)} of ${formatKm(journeyMetrics.routeDistanceKm)} ` +
      `at ${Math.round(journeyMetrics.actualPaceKmPerDay)} km/day (expected ${Math.round(journeyMetrics.expectedPaceKmPerDay)} km/day)${delayText}.`,
    // No real signal for exactly when pace crossed into this health tier
    // (health is recomputed fresh from cumulative averages each time, not
    // tracked as a timeseries) -- "now" is honest, a fabricated onset time
    // is not.
    startedAt: new Date(nowMs).toISOString(),
    isActive: true,
  };
}

export function ruleDropDwellExceeded(
  metrics: TripStageMetrics,
  thresholds: AlertThresholds,
): OperationalAlert | null {
  const d = metrics.dropDwellDuration;
  if (!d?.isRunning || d.ms <= thresholds.dropDwellMs || !metrics.dropArrivalAt) return null;
  return {
    id: "drop_dwell_exceeded",
    severity: "warning",
    category: "delivery",
    title: "Drop dwell exceeded",
    description: "Driver has been at the drop location longer than expected.",
    startedAt: startedAtFromThreshold(metrics.dropArrivalAt, thresholds.dropDwellMs),
    isActive: true,
  };
}

/** Distinct from drop_dwell_exceeded: specifically no POD uploaded yet, not just "at drop a while". */
export function rulePodOverdue(
  metrics: TripStageMetrics,
  events: TripTimelineEvent[],
  thresholds: AlertThresholds,
): OperationalAlert | null {
  const d = metrics.dropDwellDuration;
  if (!d?.isRunning || d.ms <= thresholds.podOverdueMs || !metrics.dropArrivalAt) return null;
  const podUploaded = events.some((e) => e.type === "pod_uploaded");
  if (podUploaded) return null;
  return {
    id: "pod_overdue",
    severity: "critical",
    category: "delivery",
    title: "POD overdue",
    description: "No proof of delivery has been uploaded since arriving at drop.",
    startedAt: startedAtFromThreshold(metrics.dropArrivalAt, thresholds.podOverdueMs),
    isActive: true,
  };
}

export function ruleNoLocationUpdates(
  metrics: TripStageMetrics,
  presence: DriverPresenceRow | null,
  nowMs: number,
  thresholds: AlertThresholds,
): OperationalAlert | null {
  if (metrics.completedAt) return null;
  if (!presence) return null;
  const lastSeenMs = new Date(presence.recorded_at).getTime();
  if (!Number.isFinite(lastSeenMs)) return null;
  if (nowMs - lastSeenMs <= thresholds.noLocationUpdateMs) return null;
  return {
    id: "no_location_updates",
    severity: "critical",
    category: "tracking",
    title: "No location updates",
    description: "No GPS updates received from the driver in over the expected window.",
    startedAt: presence.recorded_at,
    isActive: true,
  };
}

export function evaluateOperationalAlerts(params: {
  metrics: TripStageMetrics;
  events: TripTimelineEvent[];
  presence: DriverPresenceRow | null;
  /** Optional: only meaningful once a trip has a route distance and has departed pickup. See computeJourneyMetrics. */
  journeyMetrics?: JourneyMetrics | null;
  nowMs?: number;
  thresholds?: Partial<AlertThresholds>;
}): OperationalAlert[] {
  const nowMs = params.nowMs ?? Date.now();
  const thresholds: AlertThresholds = { ...DEFAULT_ALERT_THRESHOLDS, ...params.thresholds };
  const journeyMetrics = params.journeyMetrics ?? null;

  return [
    ruleAcceptanceDelayed(params.metrics, thresholds),
    rulePickupDwellExceeded(params.metrics, thresholds),
    ruleTransitUnusuallyLong(params.metrics, thresholds, journeyMetrics),
    ruleJourneyBehindSchedule(journeyMetrics, nowMs),
    ruleDropDwellExceeded(params.metrics, thresholds),
    rulePodOverdue(params.metrics, params.events, thresholds),
    ruleNoLocationUpdates(params.metrics, params.presence, nowMs, thresholds),
  ].filter((a): a is OperationalAlert => a !== null);
}
