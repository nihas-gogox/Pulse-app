/**
 * Urgent hubs may skip the post-ready quiet window. They wait at most a
 * short cap so a slow bootstrap does not leave the tab blank. Parallel
 * PostgREST calls stay limited by the fetch concurrency gate.
 */
export const APP_QUERY_GATE_URGENT_MAX_WAIT_MS = 1_500;
/** Non-urgent lists still yield to bootstrap, then unblock. */
export const APP_QUERY_GATE_DEFAULT_MAX_WAIT_MS = 1_500;
/** Show cached Load cards instead of an endless spinner. */
export const APP_QUERY_GATE_UI_MAX_WAIT_MS = 1_500;

export function isAppQueryGateOpen(args: {
  orgId: string | null;
  bootstrapReady: boolean;
  bootstrapStatus: string;
  urgent: boolean;
  quietElapsed: boolean;
  waitExpired: boolean;
  immediate?: boolean;
}): boolean {
  if (!args.orgId) return false;
  if (args.immediate) return true;
  const bootstrapFailed = args.bootstrapStatus === "error";
  const settled = args.bootstrapReady || bootstrapFailed || args.waitExpired;
  if (!settled) return false;
  if (args.urgent) return true;
  if (bootstrapFailed || args.waitExpired) return true;
  return args.quietElapsed;
}

/** Disabled TanStack queries look "unfetched" — that is not a loading state. */
export function isEnabledListQueryPending(args: {
  enabled: boolean;
  isLoading: boolean;
  isFetched: boolean;
  isError: boolean;
}): boolean {
  if (!args.enabled) return false;
  return args.isLoading || (!args.isFetched && !args.isError);
}
