/**
 * Driver-home performance marks (Phase 0).
 *
 * Dev-only, zero production overhead. Mirrors lib/startupMetrics.ts.
 * Remove this module + call sites when baseline metrics are captured.
 *
 * Derived durations (see dumpDriverPerfMetrics):
 *   startupDurationMs      — origin → dashboard_interactive
 *   dashboardReadyMs       — same as startup (interactive dashboard)
 *   firstMapMs             — origin → map_first_render
 *   driversQueryMs         — drivers_query_start → drivers_query_done
 *   tripsQueryMs           — trips_query_start → trips_query_done
 *   homeRenderCount        — DriverHomeScreen function body executions
 */

export type DriverPerfPhase =
  | 'login_start'
  | 'session_start'
  | 'layout_ready'
  | 'home_first_render'
  | 'drivers_query_start'
  | 'drivers_query_done'
  | 'trips_query_start'
  | 'trips_query_done'
  | 'dashboard_interactive'
  | 'gps_request_start'
  | 'map_first_render'
  | 'active_trip_first_render';

type PhaseRecord = {
  phase: DriverPerfPhase;
  /** ms since session origin */
  elapsed: number;
  at: number;
  delta: number;
};

const now = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

let origin = 0;
let lastAt = 0;
let sessionStarted = false;
/** Sign-in press time; becomes origin if layout starts after login. */
let pendingLoginAt: number | null = null;
let homeRenderCount = 0;
const records: PhaseRecord[] = [];
const seen = new Set<DriverPerfPhase>();

function record(phase: DriverPerfPhase, at: number): void {
  if (seen.has(phase)) return;
  seen.add(phase);
  const elapsed = Math.round(at - origin);
  const delta = Math.round(at - lastAt);
  lastAt = at;
  records.push({ phase, elapsed, at, delta });
  console.debug(`[driverPerf] ${phase} +${delta}ms (t=${elapsed}ms)`);
  if (
    phase === 'dashboard_interactive' ||
    phase === 'map_first_render' ||
    phase === 'active_trip_first_render'
  ) {
    dumpDriverPerfMetrics();
  }
}

/** Call at the start of password / Google sign-in (before role is known). */
export function noteDriverLoginAttempt(): void {
  if (!__DEV__) return;
  if (pendingLoginAt != null || sessionStarted) return;
  pendingLoginAt = now();
  console.debug('[driverPerf] login_attempt');
}

/**
 * Starts the driver session timeline when the driver route gate opens.
 * Origin = login attempt time when available, else now.
 */
export function beginDriverPerfSession(): void {
  if (!__DEV__) return;
  if (!sessionStarted) {
    const loginAt = pendingLoginAt;
    pendingLoginAt = null;
    origin = loginAt ?? now();
    lastAt = origin;
    sessionStarted = true;
    if (loginAt != null) {
      record('login_start', loginAt);
    }
    record('session_start', now());
  }
  record('layout_ready', now());
}

/** First-only milestone mark. Auto-starts session if needed. */
export function markDriverPerfPhase(phase: DriverPerfPhase): void {
  if (!__DEV__) return;
  if (!sessionStarted) {
    origin = pendingLoginAt ?? now();
    pendingLoginAt = null;
    lastAt = origin;
    sessionStarted = true;
    record('session_start', origin);
  }
  record(phase, now());
}

/** Count DriverHomeScreen renders (dev only). */
export function noteDriverHomeRender(): void {
  if (!__DEV__) return;
  homeRenderCount += 1;
  markDriverPerfPhase('home_first_render');
}

export function getDriverHomeRenderCount(): number {
  return homeRenderCount;
}

export function getDriverPerfMetrics(): readonly PhaseRecord[] {
  return records;
}

function elapsedOf(phase: DriverPerfPhase): number | null {
  const r = records.find((x) => x.phase === phase);
  return r ? r.elapsed : null;
}

function durationBetween(
  start: DriverPerfPhase,
  end: DriverPerfPhase,
): number | null {
  const a = records.find((x) => x.phase === start);
  const b = records.find((x) => x.phase === end);
  if (!a || !b) return null;
  return Math.round(b.at - a.at);
}

/** Console summary of derived measurements. */
export function dumpDriverPerfMetrics(): void {
  if (!__DEV__ || records.length === 0) return;
  const startupDurationMs = elapsedOf('dashboard_interactive');
  const dashboardReadyMs = startupDurationMs;
  const firstMapMs = elapsedOf('map_first_render');
  const driversQueryMs = durationBetween(
    'drivers_query_start',
    'drivers_query_done',
  );
  const tripsQueryMs = durationBetween('trips_query_start', 'trips_query_done');

  console.group(
    `[driverPerf] summary renders=${homeRenderCount}` +
      (startupDurationMs != null ? ` startup=${startupDurationMs}ms` : '') +
      (firstMapMs != null ? ` map=${firstMapMs}ms` : ''),
  );
  console.log({
    startupDurationMs,
    dashboardReadyMs,
    firstMapMs,
    driversQueryMs,
    tripsQueryMs,
    homeRenderCount,
    gpsRequestMs: elapsedOf('gps_request_start'),
    activeTripMs: elapsedOf('active_trip_first_render'),
  });
  for (const r of records) {
    const bar = '█'.repeat(Math.min(40, Math.max(0, Math.round(r.delta / 10))));
    console.log(
      `  ${r.phase.padEnd(26)} +${String(r.delta).padStart(5)}ms  t=${String(r.elapsed).padStart(5)}ms  ${bar}`,
    );
  }
  console.groupEnd();
}

/** Test / logout helper — clears marks so a new session can be measured. */
export function resetDriverPerfMetrics(): void {
  if (!__DEV__) return;
  origin = 0;
  lastAt = 0;
  sessionStarted = false;
  pendingLoginAt = null;
  homeRenderCount = 0;
  records.length = 0;
  seen.clear();
}
