/**
 * Startup timing metrics — dev-only capture of key app lifecycle milestones.
 *
 * USAGE
 * -----
 * Call markStartupPhase() at each milestone. Log.dump() in dev to see
 * the full timeline. No production overhead: all logging and storage is
 * guarded by __DEV__.
 *
 * MILESTONES (in expected order)
 *   js_parse_start   — module first evaluates (set as module-level side-effect in _layout.tsx)
 *   providers_mount  — RootLayout renders (after font load guard)
 *   auth_restoring   — AuthContext begins session restore
 *   auth_resolved    — Auth state known (user/null confirmed)
 *   org_resolved     — OrganizationContext finishes first load
 *   boot_gate_open   — AppBootGate un-blocks, splash hides
 *   tab_mount        — First tab screen mounts
 *   trips_query_done — useTripsQuery returns first data
 *   finance_chunk_loaded — Finance route chunk download finishes
 */

export type StartupPhase =
  | 'js_parse_start'
  | 'providers_mount'
  | 'auth_restoring'
  | 'auth_resolved'
  | 'org_resolved'
  | 'boot_gate_open'
  | 'tab_mount'
  | 'trips_query_done'
  | 'finance_chunk_loaded';

interface PhaseRecord {
  phase: StartupPhase;
  /** ms since the `js_parse_start` mark (or since module eval for the first mark). */
  elapsed: number;
  /** Absolute performance.now() timestamp. */
  at: number;
  /** Delta from previous mark, in ms. */
  delta: number;
}

const ORIGIN = typeof performance !== 'undefined' ? performance.now() : Date.now();
const records: PhaseRecord[] = [];
let lastAt = ORIGIN;

/** Record a startup milestone. No-op in production. */
export function markStartupPhase(phase: StartupPhase): void {
  if (!__DEV__) return;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  records.push({
    phase,
    elapsed: Math.round(now - ORIGIN),
    at: now,
    delta: Math.round(now - lastAt),
  });
  lastAt = now;
}

/** Log the full timeline to console. Call after boot_gate_open at minimum. */
export function dumpStartupMetrics(): void {
  if (!__DEV__ || records.length === 0) return;
  const total = records[records.length - 1]?.elapsed ?? 0;
  console.group(`[startup] total ${total}ms`);
  for (const r of records) {
    const bar = '█'.repeat(Math.min(40, Math.round(r.delta / 10)));
    console.log(`  ${r.phase.padEnd(22)} +${String(r.delta).padStart(5)}ms  ${bar}`);
  }
  console.groupEnd();
}

/** Read all recorded phases (for test assertions or debug UI). */
export function getStartupMetrics(): readonly PhaseRecord[] {
  return records;
}

/** True once boot_gate_open has been marked. */
export function isStartupComplete(): boolean {
  return records.some((r) => r.phase === 'boot_gate_open');
}
