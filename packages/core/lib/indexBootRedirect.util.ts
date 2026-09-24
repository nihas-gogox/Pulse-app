/**
 * Module-level guard so `app/index.tsx` redirects once per user session,
 * even when React Navigation keeps multiple Index mounts alive (web HMR, stack).
 */
let bootRedirectUid: string | null = null;

export function hasIndexBootRedirected(uid: string): boolean {
  return bootRedirectUid === uid;
}

/** Returns true when this caller should perform the redirect. */
export function claimIndexBootRedirect(uid: string): boolean {
  if (bootRedirectUid === uid) return false;
  bootRedirectUid = uid;
  return true;
}

export function resetIndexBootRedirect(): void {
  bootRedirectUid = null;
}

/**
 * True when the app is already past the index boot gate (`/`).
 * Any real screen — tabs, trip detail, vehicle, auth — must not be stolen
 * by the last-tab cold-start redirect.
 */
export function isPastIndexBootPath(pathname: string): boolean {
  if (!pathname || pathname === '/') return false;
  return true;
}

export type BrowserLocation = {
  pathname: string;
  search: string;
};

/** Safe read of `window.location` (web only; RN may polyfill `window` without location). */
export function getBrowserLocation(): BrowserLocation | null {
  if (typeof window === 'undefined' || !window.location) return null;
  const pathname =
    typeof window.location.pathname === 'string' ? window.location.pathname : '';
  const search =
    typeof window.location.search === 'string' ? window.location.search : '';
  return { pathname, search };
}

function normalizeSearch(search: string): string {
  if (!search || search === '?') return '';
  return search.startsWith('?') ? search : `?${search}`;
}

/**
 * Expo web often mounts `app/index` (`/`) on a hard refresh even when the
 * browser URL is still `/trip/:id`. Return that browser href so Index can
 * `replace` back onto the page the user refreshed — instead of last-tab home.
 *
 * Returns null when no extra navigation is needed.
 */
export function resolveWebRefreshHref(
  expoPathname: string,
  browserPathname: string,
  browserSearch = '',
): string | null {
  const browser = (browserPathname || '').trim();
  if (!browser || browser === '/') return null;

  const expo = (expoPathname || '').trim() || '/';
  if (expo === browser) return null;
  if (expo !== '/' && expo !== '') return null;

  return `${browser}${normalizeSearch(browserSearch)}`;
}
