/**
 * Main app → Pulse Driver web hand-off (driver extraction Phase 4A).
 *
 * Kill switch: EXPO_PUBLIC_DRIVER_APP_EXTRACTION_ENABLED ('true' = on). Main app only —
 * apps/driver never reads it. OFF (unset, the production default) keeps the old in-app
 * driver flow, which is the rollback path.
 *
 * WEB ONLY. Native hand-off has its own flag, EXPO_PUBLIC_DRIVER_APP_NATIVE_HANDOFF_ENABLED,
 * which is reserved and not implemented: it stays OFF until the Pulse Driver store listing
 * exists and native validation is unblocked (docs/DRIVER_EXTRACTION_PHASE3_5.md).
 */
import { Platform } from 'react-native';

/** Where the Pulse Driver web app is served on this origin (netlify: dist/driver). */
export const DRIVER_APP_BASE_PATH = '/driver';

export function isDriverWebHandoffFlagOn(): boolean {
  return process.env.EXPO_PUBLIC_DRIVER_APP_EXTRACTION_ENABLED === 'true';
}

export function isDriverWebHandoffEnabled(): boolean {
  return Platform.OS === 'web' && isDriverWebHandoffFlagOn();
}

/** Native hand-off is not implemented; always the old in-app flow (see header). */
export function isDriverNativeHandoffEnabled(): boolean {
  return false;
}

/**
 * First URL segments that exist in the Pulse Driver app with the same meaning: the
 * (driver) group routes, trip detail/ops, language settings. Kept in sync with
 * apps/driver/app by features/drivers/utils/__tests__/driverAppHandoff.util.test.ts.
 */
export const DRIVER_APP_ROOT_SEGMENTS: ReadonlySet<string> = new Set([
  'available-loads', 'become-fleet-owner', 'capacity-story', 'chat', 'commerce-mission',
  'control', 'dco-status', 'documents', 'expense-capture', 'general-expense',
  'level-progression', 'market-awards', 'my-bids', 'my-fleet', 'notifications', 'passbook',
  'pending-earnings', 'profile', 'requests', 'salary-request', 'settings', 'stories',
  'trip-history', 'wallet', 'trip', 'language-settings',
]);

/**
 * Root segments the main app ALSO serves (dispatcher chat, notifications, profile tab,
 * trip detail, language modal). Phase 4B: never handed off for signed-out visitors —
 * only a signed-in driver leaves these for /driver.
 */
export const MAIN_APP_SHARED_SEGMENTS: ReadonlySet<string> = new Set([
  'chat', 'notifications', 'profile', 'trip', 'language-settings',
]);

/**
 * Phase 4B: old driver browser URL that only the driver app serves (docs/
 * DRIVER_EXTRACTION_INVENTORY.md "Driver route URLs"): a driver-group root segment the
 * main app does not also serve, or /driver-trip/<id>.
 */
export function isDriverOnlyLegacyPath(pathname: string): boolean {
  if (pathname.startsWith('/driver-trip/')) return true;
  const seg = pathname.split('/').filter((s) => s && !/^\(.*\)$/.test(s))[0] ?? '';
  return DRIVER_APP_ROOT_SEGMENTS.has(seg) && !MAIN_APP_SHARED_SEGMENTS.has(seg);
}

/** Old in-app driver entry pages that anyone (signed in or not) may open. */
const PUBLIC_ENTRY_RENAMES: Readonly<Record<string, string>> = {
  '/driver-sign-in': '/sign-in',
  '/driver-signup': '/sign-up',
  '/onboarding/driver': '/onboarding',
};

const isUnderDriverApp = (pathname: string) =>
  pathname === DRIVER_APP_BASE_PATH || pathname.startsWith(`${DRIVER_APP_BASE_PATH}/`);

export function isPublicDriverEntryPath(pathname: string): boolean {
  return pathname in PUBLIC_ENTRY_RENAMES;
}

/** Old main-app driver path (+ query) → the same page in the Pulse Driver web app. */
export function driverAppPathFor(pathname: string, search = ''): string {
  const clean = `/${pathname.split('/').filter((s) => s && !/^\(.*\)$/.test(s)).join('/')}`;
  let mapped = '/';
  if (PUBLIC_ENTRY_RENAMES[clean]) mapped = PUBLIC_ENTRY_RENAMES[clean];
  else if (clean.startsWith('/driver-trip/')) mapped = `/trip/${clean.slice('/driver-trip/'.length)}`;
  else if (DRIVER_APP_ROOT_SEGMENTS.has(clean.split('/')[1] ?? '')) mapped = clean;
  const query = search && !search.startsWith('?') ? `?${search}` : search;
  return `${DRIVER_APP_BASE_PATH}${mapped === '/' ? '' : mapped}${query}`;
}

export type DriverHandoffInput = {
  enabled: boolean;
  pathname: string;
  sessionAttached: boolean;
  isDriver: boolean;
  /** Auth restore finished with no session (status 'unauthenticated'); false while restoring. */
  signedOut?: boolean;
};

/**
 * Hand off when the flag is on and either a signed-in driver is anywhere in the main app,
 * anyone opens an old driver entry page, or (4B) a confirmed signed-out visitor opens an
 * old driver-only URL. Signed-in non-drivers keep the main app's behavior. Never from a
 * path already under /driver: if the main app is serving it, the /driver rewrite is
 * missing and a redirect would loop.
 */
export function shouldHandOffToDriverApp(input: DriverHandoffInput): boolean {
  if (!input.enabled || isUnderDriverApp(input.pathname)) return false;
  if (isPublicDriverEntryPath(input.pathname)) return true;
  if (input.signedOut && isDriverOnlyLegacyPath(input.pathname)) return true;
  return input.sessionAttached && input.isDriver;
}
