import type { TripRow } from "../services/trips.service";
import type { TripStageMetrics } from "./tripStageMetrics";

/**
 * Journey Metrics — answers "is this trip progressing fast enough to meet
 * its commitment?", distinct from Stage Metrics ("where is the trip in its
 * operational workflow?"). Meaningful primarily for long-haul trips, where
 * elapsed time alone is a poor signal (a 20hr transit is normal for one
 * route, alarming for another) and distance/pace is the real story.
 *
 * Pure function of (trip, distanceCoveredM, stageMetrics, nowMs) — no
 * queries, no React. distanceCoveredM comes from summing
 * trip_location_checkpoints.distance_delta_m server-side (see
 * getCheckpointDistanceSumsForTrips), an honest proxy for distance actually
 * travelled from real GPS deltas -- not a fabricated odometer reading, and
 * not straight-line pickup-to-current-position (which would understate
 * progress on anything but a perfectly straight route).
 *
 * Returns null when journey progress isn't yet a meaningful concept for
 * this trip: no departure from pickup yet, or no planned route distance to
 * measure progress against.
 */

export type JourneyHealth = "healthy" | "watch" | "delayed" | "critical";

export interface JourneyMetrics {
  routeDistanceKm: number;
  completedDistanceKm: number;
  remainingDistanceKm: number;

  /** km/day the trip is expected to cover to arrive on time. */
  expectedPaceKmPerDay: number;
  /** km/day actually covered so far (completedDistanceKm / elapsed days). */
  actualPaceKmPerDay: number;
  /** True when expectedPaceKmPerDay came from trip.estimated_duration rather than the default assumption. */
  expectedPaceIsEstimateBased: boolean;

  expectedArrival: string;
  /** Projection at the current observed pace; null if the vehicle hasn't moved (pace is 0). */
  predictedArrival: string | null;
  /** predictedArrival - expectedArrival, in ms. Null when predictedArrival is null. Positive = late. */
  delayMs: number | null;

  health: JourneyHealth;
}

const MS_PER_DAY = 24 * 60 * 60_000;

/**
 * Default assumption when trip.estimated_duration isn't available or
 * doesn't parse — a plain, documented constant, not derived from any real
 * operational data. Revisit if/when a real per-corridor or per-trip-type
 * expected-pace source exists.
 */
export const DEFAULT_EXPECTED_PACE_KM_PER_DAY = 400;

/**
 * Parses a Postgres interval's default text output: "HH:MM:SS[.ffffff]",
 * optionally prefixed with "N day(s) ". Returns null (not a guess) for any
 * format outside this, so callers fall back to the documented default
 * rather than silently misinterpreting an unfamiliar shape -- a multi-day
 * interval misparsed as a few hours would produce a wildly, dangerously
 * wrong expected pace for exactly the long-haul trips this exists for.
 */
export function parseIntervalMs(raw: string | null | undefined): number | null {
  const s = raw?.trim();
  if (!s) return null;
  const m = s.match(/^(?:(\d+)\s+days?\s+)?(\d{1,3}):(\d{2}):(\d{2})(?:\.\d+)?$/i);
  if (!m) return null;
  const days = m[1] ? Number(m[1]) : 0;
  const hours = Number(m[2]);
  const minutes = Number(m[3]);
  const seconds = Number(m[4]);
  if (![days, hours, minutes, seconds].every(Number.isFinite)) return null;
  const ms = ((days * 24 + hours) * 60 + minutes) * 60_000 + seconds * 1000;
  return ms > 0 ? ms : null;
}

function classifyHealth(actualPace: number, expectedPace: number): JourneyHealth {
  if (expectedPace <= 0) return "healthy";
  const variancePercent = (actualPace - expectedPace) / expectedPace;
  const deficitPercent = Math.max(0, -variancePercent);
  if (deficitPercent < 0.05) return "healthy";
  if (deficitPercent < 0.15) return "watch";
  if (deficitPercent < 0.3) return "delayed";
  return "critical";
}

export function computeJourneyMetrics(
  trip: TripRow,
  distanceCoveredM: number,
  metrics: TripStageMetrics,
  nowMs: number = Date.now(),
): JourneyMetrics | null {
  if (!metrics.pickupDepartureAt) return null;

  const routeDistanceKm = Number(trip.distance);
  if (!Number.isFinite(routeDistanceKm) || routeDistanceKm <= 0) return null;

  const completedDistanceKm = Math.max(0, distanceCoveredM / 1000);
  const remainingDistanceKm = Math.max(0, routeDistanceKm - completedDistanceKm);

  const departureMs = new Date(metrics.pickupDepartureAt).getTime();
  const endMs = metrics.completedAt ? new Date(metrics.completedAt).getTime() : nowMs;
  const elapsedMs = Math.max(0, endMs - departureMs);
  const elapsedDays = elapsedMs / MS_PER_DAY;

  const estimateMs = parseIntervalMs(trip.estimated_duration);
  const expectedPaceIsEstimateBased = estimateMs != null;
  const expectedPaceKmPerDay = estimateMs
    ? routeDistanceKm / (estimateMs / MS_PER_DAY)
    : DEFAULT_EXPECTED_PACE_KM_PER_DAY;

  const actualPaceKmPerDay = elapsedDays > 0 ? completedDistanceKm / elapsedDays : 0;

  const expectedDurationMs = estimateMs ?? (routeDistanceKm / DEFAULT_EXPECTED_PACE_KM_PER_DAY) * MS_PER_DAY;
  const expectedArrival = new Date(departureMs + expectedDurationMs).toISOString();

  let predictedArrival: string | null = null;
  let delayMs: number | null = null;
  if (actualPaceKmPerDay > 0) {
    const remainingMs = (remainingDistanceKm / actualPaceKmPerDay) * MS_PER_DAY;
    const predictedMs = nowMs + remainingMs;
    predictedArrival = new Date(predictedMs).toISOString();
    delayMs = predictedMs - new Date(expectedArrival).getTime();
  }

  return {
    routeDistanceKm,
    completedDistanceKm,
    remainingDistanceKm,
    expectedPaceKmPerDay,
    actualPaceKmPerDay,
    expectedPaceIsEstimateBased,
    expectedArrival,
    predictedArrival,
    delayMs,
    health: classifyHealth(actualPaceKmPerDay, expectedPaceKmPerDay),
  };
}
