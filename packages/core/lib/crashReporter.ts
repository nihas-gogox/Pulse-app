/**
 * Thin wrapper around the crash reporter (Sentry). Centralizes init + capture so
 * the rest of the app never imports Sentry directly — call these from the logger
 * façade (lib/logger.ts) and the app-wide error boundary.
 *
 * Safe no-op until `initCrashReporter()` runs and a DSN is present, so the app
 * works identically with or without Sentry configured.
 */
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

let initialized = false;

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** App version + build channel become the Sentry release/environment tags. */
const RELEASE =
  Constants.expoConfig?.version != null
    ? `pulse@${Constants.expoConfig.version}`
    : undefined;
const ENVIRONMENT =
  process.env.EXPO_PUBLIC_ENV ??
  (process.env.NODE_ENV === 'production' ? 'production' : 'development');

/**
 * Initialize crash reporting. Call once at app startup (app/_layout.tsx).
 * Disabled in dev and when no DSN is configured.
 */
/**
 * Postgres/PostgREST errors that mean "no valid session" rather than a real
 * bug. They fire when a signed-out or expired session briefly hits org-scoped
 * RPCs (e.g. on the /sign-in page while cached queries drain) and the JWT is
 * anon/expired, so every `is_org_member`-gated function returns
 * "permission denied". This is expected auth noise, not an actionable crash.
 */
const AUTH_NOISE_PATTERNS = [
  'permission denied for function',
  'permission denied for table',
];

function isAuthNoise(event: Sentry.ErrorEvent): boolean {
  const values = event.exception?.values ?? [];
  return values.some((v) =>
    AUTH_NOISE_PATTERNS.some((p) => (v.value ?? '').includes(p)),
  );
}

/**
 * Warning-level auth signals that are already handled in code and self-recover:
 * a slow token refresh keeps the existing session, an expired one clears it, and
 * a sign-out that times out remotely still clears locally. They were logged via
 * `captureMessage(level: 'warning')`, but Sentry still grouped them as separate
 * unresolved *issues* (GX-PULSE-1A / 1B / 10 / Y-adjacent), which buried the real
 * crashes. Keep them out of the issue stream — the breadcrumb trail retains them
 * for any report that does fail.
 */
const BENIGN_AUTH_SIGNALS = [
  'refresh_invalid_session_cleared',
  'refresh_session_timeout',
  'refresh_timeout_degraded_session_preserved',
  'sign_out_timeout_local_cleared',
  'force_sign_out_timeout_local_cleared',
];

function isBenignAuthSignal(event: Sentry.ErrorEvent): boolean {
  if (event.level !== 'warning') return false;
  const haystack = [
    event.message ?? '',
    ...(event.exception?.values ?? []).map((v) => v.value ?? ''),
  ].join(' ');
  return BENIGN_AUTH_SIGNALS.some((s) => haystack.includes(s));
}

export function initCrashReporter(): void {
  if (initialized || __DEV__ || !DSN) return;
  Sentry.init({
    dsn: DSN,
    // Keep tracing off by default; enable later once volume/cost is understood.
    tracesSampleRate: 0,
    enableNative: true,
    release: RELEASE,
    environment: ENVIRONMENT,
    // Drop expected "no session" permission-denied noise before it reports.
    beforeSend: (event) =>
      isAuthNoise(event) || isBenignAuthSignal(event) ? null : event,
  });
  initialized = true;
}

/** Attach the signed-in user to crash reports. Call after login/session restore. */
export function setCrashReporterUser(user: { id: string; email?: string | null }): void {
  if (__DEV__ || !initialized) return;
  Sentry.setUser({ id: user.id, email: user.email ?? undefined });
}

/** Clear user context on logout. */
export function clearCrashReporterUser(): void {
  if (__DEV__ || !initialized) return;
  Sentry.setUser(null);
}

export function captureException(
  error: Error,
  context?: Record<string, unknown>,
): void {
  if (__DEV__ || !initialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(
  message: string,
  level: 'warning' | 'error' = 'error',
  context?: Record<string, unknown>,
): void {
  if (__DEV__ || !initialized) return;
  Sentry.captureMessage(message, {
    level,
    ...(context ? { extra: context } : {}),
  });
}

/** Expose the wrap helper so app/_layout can wrap the root component. */
export const wrapWithCrashReporter = Sentry.wrap;
