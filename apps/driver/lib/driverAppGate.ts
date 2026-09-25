/**
 * Pulse Driver entry gate (driver extraction, Phase 3).
 *
 * "Who is logged in" comes from the shared session (AuthProvider, @pulse/domain).
 * "May this user enter the driver app" is decided here: role === 'driver' — the same
 * check the old (driver) group layout uses (`profile.role !== 'driver'` → wrong role).
 * No new authorization rule; RLS stays the real boundary.
 *
 * Mount rules mirror the main app's boot gate (lib/bootGate.ts): the data plane mounts
 * once the Supabase session is attached; public auth pages render without it.
 */
import type { AuthStatus } from '@pulse/core/lib/authEngine';

export type DriverGateInput = {
  sessionAttached: boolean;
  status: AuthStatus;
  /** AuthContext `loading` (session or profile still resolving). */
  loading: boolean;
  hasProfile: boolean;
  role: string | null | undefined;
  publicRoute: boolean;
};

export type DriverGateDecision =
  /** Session/profile still resolving. */
  | 'splash'
  /** Public auth page, no session: render without the data plane. */
  | 'public'
  /** No session on a private page: go to sign-in. */
  | 'sign-in'
  /** Session attached on a public page (e.g. sign-in finishing): render with the data plane. */
  | 'public-with-session'
  /** Signed in, but not a driver: reject, link to the main app. */
  | 'not-driver'
  | 'driver';

export function decideDriverGate(input: DriverGateInput): DriverGateDecision {
  if (!input.sessionAttached) {
    if (input.publicRoute) return 'public';
    if (input.status === 'unauthenticated' || input.status === 'expired') return 'sign-in';
    return 'splash';
  }
  if (input.publicRoute) return 'public-with-session';
  if (input.loading || !input.hasProfile) return 'splash';
  return input.role === 'driver' ? 'driver' : 'not-driver';
}
