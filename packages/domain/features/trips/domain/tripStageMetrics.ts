import type { TripRow } from "../services/trips.service";
import type { TripTimelineEvent, TripTimelineEventType } from "./tripTimeline";

/**
 * Stage Metrics Engine — pure domain service. Consumes only the Timeline
 * (Phase 3) and the trip row (for a completedAt fallback); knows nothing
 * about React, queries, or screens. Derives durations on every call rather
 * than persisting them — the timeline stays the source of truth until one
 * of expensive reporting / very large datasets / SLA history / billing /
 * KPI snapshots actually requires a stored snapshot.
 *
 * Works for active trips: a duration whose start anchor exists but whose
 * end anchor doesn't yet is reported with `isRunning: true`, computed
 * against `nowMs`. Because each duration's end anchor is the next
 * duration's start anchor, at most one duration is ever running at a time
 * for a given trip — no separate "what's the current stage" lookup needed.
 *
 * v1 scope, deliberately not handled (same class of question the user
 * raised when postponing analytics): repeated geofence entry/exit (e.g. a
 * driver leaves pickup and comes back) uses the FIRST occurrence of each
 * event type as its anchor. Revisit if that undercounts dwell time in
 * practice.
 */

export interface DurationMetric {
  ms: number;
  isRunning: boolean;
}

export interface TripStageMetrics {
  assignedAt: string | null;
  acceptedAt: string | null;
  pickupArrivalAt: string | null;
  pickupDepartureAt: string | null;
  dropArrivalAt: string | null;
  completedAt: string | null;

  acceptanceDuration: DurationMetric | null;
  pickupTravelDuration: DurationMetric | null;
  pickupDwellDuration: DurationMetric | null;
  transitDuration: DurationMetric | null;
  dropDwellDuration: DurationMetric | null;
  totalDuration: DurationMetric | null;
}

function firstOccurrence(
  events: TripTimelineEvent[],
  type: TripTimelineEventType,
): string | null {
  return events.find((e) => e.type === type)?.occurredAt ?? null;
}

/** Duration between two anchors; running against `nowMs` if `endIso` is missing. */
function duration(
  startIso: string | null,
  endIso: string | null,
  nowMs: number,
): DurationMetric | null {
  if (!startIso) return null;
  const startMs = new Date(startIso).getTime();
  if (!Number.isFinite(startMs)) return null;
  if (endIso) {
    const endMs = new Date(endIso).getTime();
    if (!Number.isFinite(endMs)) return null;
    return { ms: Math.max(0, endMs - startMs), isRunning: false };
  }
  return { ms: Math.max(0, nowMs - startMs), isRunning: true };
}

export function computeTripStageMetrics(
  trip: TripRow,
  events: TripTimelineEvent[],
  nowMs: number = Date.now(),
): TripStageMetrics {
  const assignedAt = firstOccurrence(events, "assigned");
  const acceptedAt = firstOccurrence(events, "driver_accepted");
  const pickupArrivalAt = firstOccurrence(events, "entered_pickup");
  const pickupDepartureAt = firstOccurrence(events, "exited_pickup");
  const dropArrivalAt = firstOccurrence(events, "entered_drop");
  const completedAt = firstOccurrence(events, "completed") ?? trip.completed_at ?? null;

  return {
    assignedAt,
    acceptedAt,
    pickupArrivalAt,
    pickupDepartureAt,
    dropArrivalAt,
    completedAt,

    acceptanceDuration: duration(assignedAt, acceptedAt, nowMs),
    // Deliberately null (not a fallback to assignedAt) when acceptedAt is
    // missing -- e.g. a trip predating the driver_accepted event, or an app
    // version that never recorded it. Falling back would silently blend two
    // different metrics ("time since acceptance" vs "time since assignment")
    // under one name.
    pickupTravelDuration: duration(acceptedAt, pickupArrivalAt, nowMs),
    pickupDwellDuration: duration(pickupArrivalAt, pickupDepartureAt, nowMs),
    transitDuration: duration(pickupDepartureAt, dropArrivalAt, nowMs),
    dropDwellDuration: duration(dropArrivalAt, completedAt, nowMs),
    totalDuration: duration(assignedAt, completedAt, nowMs),
  };
}
