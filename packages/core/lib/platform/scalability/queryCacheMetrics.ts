/**
 * In-process Query & Cache Engine counters for Platform Health (P0).
 * Wired from `lib/queryClient.ts` — not a second cache policy.
 */

type CacheCounters = {
  invalidateQueries: number;
  setQueryData: number;
  refetchQueries: number;
  invalidationStorms: number;
  /** Rolling window: invalidations in the last ~1s (for dashboard). */
  invalidationsLastWindow: number;
  windowStartedAt: number;
};

const WINDOW_MS = 1_000;

const counters: CacheCounters = {
  invalidateQueries: 0,
  setQueryData: 0,
  refetchQueries: 0,
  invalidationStorms: 0,
  invalidationsLastWindow: 0,
  windowStartedAt: Date.now(),
};

function bumpWindow() {
  const now = Date.now();
  if (now - counters.windowStartedAt > WINDOW_MS) {
    counters.windowStartedAt = now;
    counters.invalidationsLastWindow = 0;
  }
}

export function recordInvalidateQueries() {
  bumpWindow();
  counters.invalidateQueries += 1;
  counters.invalidationsLastWindow += 1;
}

export function recordSetQueryData() {
  counters.setQueryData += 1;
}

export function recordRefetchQueries() {
  counters.refetchQueries += 1;
}

export function recordInvalidationStorm() {
  counters.invalidationStorms += 1;
}

export function getQueryCacheMetrics() {
  bumpWindow();
  return { ...counters };
}

export function resetQueryCacheMetricsForTests() {
  counters.invalidateQueries = 0;
  counters.setQueryData = 0;
  counters.refetchQueries = 0;
  counters.invalidationStorms = 0;
  counters.invalidationsLastWindow = 0;
  counters.windowStartedAt = Date.now();
}
