/**
 * Quiet period after global bootstrap before non-urgent TanStack queries may fetch.
 * The fetch concurrency gate already caps parallel PostgREST calls, so this only
 * needs a short yield — a multi-second pause left every other tab blank.
 */
export const APP_QUERY_GATE_QUIET_MS = 300;

let bootstrapReadyAtMs = 0;

export function markAppQueryGateBootstrapReady(): void {
  bootstrapReadyAtMs = Date.now();
}

export function getMsSinceBootstrapReady(): number {
  if (!bootstrapReadyAtMs) return Number.POSITIVE_INFINITY;
  return Date.now() - bootstrapReadyAtMs;
}

export function isWithinAppQueryBootQuietPeriod(): boolean {
  return getMsSinceBootstrapReady() < APP_QUERY_GATE_QUIET_MS;
}
