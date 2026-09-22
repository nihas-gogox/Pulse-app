/** Cloudflare / PostgREST "origin is gone" — retrying these is what turns a DB Unhealthy into a client storm.
 * 504 is PGRST003 (PostgREST pool wait timeout). Today's 2026-09-22 cascade
 * showed 504s on auth + rest while diagnostic crons were also failing to start;
 * retrying those 504s held the remaining pool slots. */
/** 544 is Cloudflare/custom origin timeout (avatars/storage in the 2026-09-22 cascade). */
const ORIGIN_DOWN_STATUSES = new Set([500, 503, 504, 521, 544]);

/** Transient proxy / rate-limit statuses that are worth a short retry.
 * 500 is excluded: PostgREST Warp "thread killed by timeout" and statement
 * timeouts both surface as 500. Retrying them held the pool through the
 * 2026-09-21 unhealthy cascade.
 * 504 is excluded: waiting for a pool connection will not get faster on retry. */
const TRANSIENT_RETRY_STATUSES = new Set([408, 425, 429, 502, 520, 522, 524]);

const ORIGIN_DOWN_MESSAGE =
  /503|521|57P03|not accepting connections|database system is shutting down|web server is down|origin is unreachable/i;

/** Normalize Cloudflare / HTML error bodies from Supabase into short retryable messages. */
export function normalizeInfrastructureErrorMessage(message: string): string {
  if (/<!doctype|error code 522|cloudflare|connection timed out/i.test(message)) {
    return 'Connection timed out (522)';
  }
  if (/json parse error|unexpected character|unexpected token/i.test(message)) {
    return 'Network request failed';
  }
  return message.length > 240 ? `${message.slice(0, 240)}…` : message;
}

export function isOriginDownHttpStatus(status: number): boolean {
  return ORIGIN_DOWN_STATUSES.has(status);
}

export function isOriginDownErrorMessage(message: string): boolean {
  return ORIGIN_DOWN_MESSAGE.test(message);
}

export function isOriginDownError(error: unknown): boolean {
  if (!error) return false;
  if (isSupabaseCircuitOpen()) return true;
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && ORIGIN_DOWN_STATUSES.has(status)) return true;
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && code.toUpperCase() === '57P03') return true;
  const message =
    error instanceof Error
      ? error.message
      : typeof (error as { message?: unknown }).message === 'string'
        ? ((error as { message: string }).message)
        : String(error);
  return isOriginDownErrorMessage(message);
}


export function isRetryableHttpResponse(res: Response): boolean {
  if (res.ok) return false;
  // 503 = PostgREST/Postgres unavailable. 521 = Cloudflare "web server is down".
  // Retrying either holds pool connections and multiplies load while the instance
  // is already Unhealthy (2026-09-18 incident: profiles/org_members 503 every ~2s).
  if (ORIGIN_DOWN_STATUSES.has(res.status)) return false;
  if (TRANSIENT_RETRY_STATUSES.has(res.status)) return true;
  const ct = (res.headers.get('content-type') ?? '').toLowerCase();
  // HTML 5xx (Warp timeout pages) must not retry — the last-line fallback
  // used to treat any non-JSON 400+ as retryable.
  if (res.status >= 500) return false;
  return !ct.includes('json') && res.status >= 400;
}

export function isInfrastructureErrorMessage(message: string): boolean {
  return /522|521|520|500|502|503|504|429|timeout|timed out|network|fetch failed|gateway|connection|json parse|unexpected character|57P03/i.test(
    message,
  );
}

/**
 * PostgREST service-level failures: PGRST002 (schema cache could not be loaded)
 * and PGRST003 (could not acquire a pool connection). Both surface as 503 and
 * mean "the API layer is unavailable", never "this user has no rows".
 */
const SERVICE_UNAVAILABLE_CODES = new Set(['PGRST002', 'PGRST003']);

/**
 * True when a failure came from the API/DB layer being unavailable rather than
 * from the query itself. Callers use this to tell a transport failure apart
 * from a legitimate empty result, so an outage is surfaced once instead of
 * driving an application-level retry loop.
 */
export function isServiceUnavailableError(error: unknown): boolean {
  if (!error) return false;
  if (isOriginDownError(error)) return true;
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && SERVICE_UNAVAILABLE_CODES.has(code.toUpperCase())) {
    return true;
  }
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === 'number' && status >= 500) return true;
  const message =
    error instanceof Error
      ? error.message
      : typeof (error as { message?: unknown } | null)?.message === 'string'
        ? (error as { message: string }).message
        : String(error);
  return /PGRST00[23]|schema cache/i.test(message);
}

/** Extra attempts after the first. Total attempts = 1 + this (max 3). */
export const FETCH_MAX_RETRIES = 2;
/** Auth token refresh: initial + 2 retries, still under AUTH_TIMEOUT_MS. */
export const AUTH_TOKEN_MAX_RETRIES = 2;
/**
 * Client/request timeouts are not transient under pool saturation.
 * A second 12s hold is how cancelled requests become idle-in-transaction.
 */
export const TIMEOUT_MAX_RETRIES = 0;

export function retryDelayMs(
  attempt: number,
  randomOrError?: (() => number) | unknown,
): number {
  const random =
    typeof randomOrError === 'function'
      ? (randomOrError as () => number)
      : Math.random;
  const base = Math.min(2_000 * Math.pow(2, attempt - 1), 8_000);
  const jitter = base * 0.2 * (random() * 2 - 1);
  return Math.round(base + jitter);
}

export function authTokenRetryDelayMs(
  attempt: number,
  randomOrError?: (() => number) | unknown,
): number {
  return retryDelayMs(attempt, randomOrError);
}

export function isTransientFetchError(error: Error): boolean {
  if (error.name === "TimeoutError" || error.name === "AbortError") return false;
  if (isSupabaseCircuitOpen()) return false;
  return (
    error.message === "Network request failed" ||
    error.message === "Load failed" ||
    /network|failed|access control checks|schema cache/i.test(error.message)
  );
}

export function canRetryFetchAttempt(args: {
  attempt: number;
  maxRetries: number;
  timeoutMaxRetries: number;
  error: Error;
}): boolean {
  const { attempt, maxRetries, timeoutMaxRetries, error } = args;
  if (error.name === "AbortError") return false;
  if (isSupabaseCircuitOpen()) return false;
  if (error.name === "TimeoutError") {
    return attempt < timeoutMaxRetries;
  }
  return attempt < maxRetries && isTransientFetchError(error);
}

/** After the first origin-down (503/504), fail locally for a cooldown. */
export const SUPABASE_CIRCUIT_COOLDOWN_MS = 45_000;

let circuitOpenUntilMs = 0;

export function noteSupabaseOriginDown(): void {
  circuitOpenUntilMs = Date.now() + SUPABASE_CIRCUIT_COOLDOWN_MS;
}

export function noteSupabaseHealthy(): void {
  circuitOpenUntilMs = 0;
}

export function isSupabaseCircuitOpen(now = Date.now()): boolean {
  return now < circuitOpenUntilMs;
}

export function resetSupabaseCircuit(): void {
  circuitOpenUntilMs = 0;
}

export function supabaseCircuitOpenError(): Error {
  const err = new Error("Service Unavailable 503");
  err.name = "ServiceUnavailableError";
  (err as { status?: number }).status = 503;
  return err;
}

/** Cap parallel PostgREST/Storage GETs so a hub screen cannot open 20+ 12s holds at once. */
export const MAX_CONCURRENT_DATA_FETCHES = 6;

export function requestUrlString(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Auth + writes skip the gate so session refresh / indent create are not queued behind list reads. */
export function shouldQueueDataFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): boolean {
  const method = String(init?.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;
  const url = requestUrlString(input);
  if (url.includes("/auth/v1/")) return false;
  return true;
}

export function createConcurrencyGate(max: number) {
  let active = 0;
  const waiters: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    onAbort?: () => void;
    signal?: AbortSignal;
  }> = [];

  const abortError = (): Error => {
    const err = new Error("Request cancelled");
    err.name = "AbortError";
    return err;
  };

  return {
    get activeCount() {
      return active;
    },
    get queuedCount() {
      return waiters.length;
    },
    async acquire(signal?: AbortSignal): Promise<void> {
      if (signal?.aborted) throw abortError();
      if (active < max) {
        active += 1;
        return;
      }
      await new Promise<void>((resolve, reject) => {
        const entry: (typeof waiters)[number] = { resolve, reject, signal };
        const onAbort = () => {
          const idx = waiters.indexOf(entry);
          if (idx >= 0) waiters.splice(idx, 1);
          reject(abortError());
        };
        entry.onAbort = onAbort;
        waiters.push(entry);
        signal?.addEventListener("abort", onAbort, { once: true });
      });
      active += 1;
    },
    release() {
      active = Math.max(0, active - 1);
      const next = waiters.shift();
      if (!next) return;
      if (next.signal && next.onAbort) {
        next.signal.removeEventListener("abort", next.onAbort);
      }
      next.resolve();
    },
  };
}

export const dataFetchConcurrencyGate = createConcurrencyGate(
  MAX_CONCURRENT_DATA_FETCHES,
);
