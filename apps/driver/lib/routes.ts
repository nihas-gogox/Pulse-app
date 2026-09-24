/**
 * Pulse Driver route table (driver extraction, Phase 3; plan §2).
 *
 * Paths are relative to the web base URL: '/driver' while served at
 * gogopulse.com/driver, '' later on driver.gogopulse.com. Expo Router adds the
 * base itself, so code never hard-codes '/driver'.
 */
export const DRIVER_ROUTES = {
  HOME: '/',
  SIGN_IN: '/sign-in',
  SIGN_UP: '/sign-up',
  ONBOARDING: '/onboarding',
  WALLET: '/wallet',
  PASSBOOK_HISTORY: '/passbook/history',
  trip: (tripId: string) => `/trip/${encodeURIComponent(tripId)}` as const,
} as const;

/**
 * Old in-app route names that the (unchanged) driver screens still navigate to.
 * Each has a redirect route in apps/driver/app that forwards to the contract URL,
 * so the same screen code runs in both the old main-app flow and this app.
 * Removed once the old flow is gone (Phase 4C) and the call sites use DRIVER_ROUTES.
 */
export const LEGACY_ROUTE_ALIASES = {
  '/driver-sign-in': DRIVER_ROUTES.SIGN_IN,
  '/driver-signup': DRIVER_ROUTES.SIGN_UP,
  '/onboarding/driver': DRIVER_ROUTES.ONBOARDING,
  '/driver-trip/:tripId': '/trip/:tripId',
} as const;

/** Routes reachable without a session. Everything else needs a signed-in driver. */
const PUBLIC_PATHS: ReadonlySet<string> = new Set([
  DRIVER_ROUTES.SIGN_IN,
  DRIVER_ROUTES.SIGN_UP,
  DRIVER_ROUTES.ONBOARDING,
  '/driver-sign-in',
  '/driver-signup',
  '/onboarding/driver',
]);

/**
 * Router path without the web base URL. Before the navigator is ready, usePathname()
 * can still return the raw browser path ('/driver/onboarding' instead of '/onboarding').
 */
export function stripBaseUrl(pathname: string, baseUrl: string | null | undefined): string {
  const base = (baseUrl ?? '').replace(/\/+$/, '');
  if (!base) return pathname;
  if (pathname === base) return '/';
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
}

export function isPublicDriverPath(pathname: string, baseUrl?: string | null): boolean {
  return PUBLIC_PATHS.has(stripBaseUrl(pathname, baseUrl));
}

/** Where a signed-in non-driver is sent: the main Pulse app. */
export const MAIN_APP_URL = 'https://gogopulse.com';
