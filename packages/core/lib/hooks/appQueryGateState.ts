/** Quiet period after global bootstrap before non-urgent TanStack queries may fetch. */
export const APP_QUERY_GATE_QUIET_MS = 6_000;

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
