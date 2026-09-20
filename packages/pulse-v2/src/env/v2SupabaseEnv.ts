import { BLOCKED_V2_SUPABASE_PROJECT_REFS } from "./productionProjectRefs";

export type V2DataPlaneMode = "memory" | "local-supabase";

export type V2DatabaseTarget =
  | { mode: "memory"; supabaseUrl: null }
  | { mode: "local-supabase"; supabaseUrl: string };

export class V2EnvironmentIsolationError extends Error {
  readonly code = "V2_ENV_ISOLATION";
  constructor(message: string) {
    super(message);
    this.name = "V2EnvironmentIsolationError";
  }
}

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "0.0.0.0"]);

function isPrivateLanHostname(hostname: string): boolean {
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  const m = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (m) {
    const second = Number(m[1]);
    return second >= 16 && second <= 31;
  }
  return false;
}

export function supabaseProjectRefFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

function isLocalSupabaseUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (LOCAL_HOSTS.has(host) || isPrivateLanHostname(host)) {
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  }
  return false;
}

function truthy(value: string | undefined): boolean {
  const v = (value ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * V2 never reads EXPO_PUBLIC_SUPABASE_* / VITE_SUPABASE_*.
 * Unset PULSE_V2_SUPABASE_URL → in-memory (this slice).
 */
export function resolveV2DatabaseTarget(
  env: NodeJS.Dict<string> = process.env,
): V2DatabaseTarget {
  const url = (env.PULSE_V2_SUPABASE_URL ?? "").trim();
  if (!url) {
    return { mode: "memory", supabaseUrl: null };
  }

  const ref = supabaseProjectRefFromUrl(url);
  if (ref && (BLOCKED_V2_SUPABASE_PROJECT_REFS as readonly string[]).includes(ref)) {
    throw new V2EnvironmentIsolationError(
      `Pulse V2 must not use production/preprod Supabase project ref "${ref}". ` +
        "Use in-memory (unset PULSE_V2_SUPABASE_URL) or local Supabase (127.0.0.1:54321).",
    );
  }

  if (isLocalSupabaseUrl(url)) {
    return { mode: "local-supabase", supabaseUrl: url };
  }

  const hostedRef = supabaseProjectRefFromUrl(url);
  if (hostedRef) {
    const allowHosted = truthy(env.PULSE_V2_ALLOW_HOSTED);
    const approved = (env.PULSE_V2_HOSTED_PROJECT_REF ?? "").trim().toLowerCase();
    if (!allowHosted || approved !== hostedRef) {
      throw new V2EnvironmentIsolationError(
        "Hosted V2 Supabase is not approved for this slice. STOP: do not provision a dedicated " +
          "project without infrastructure approval. After approval, set PULSE_V2_ALLOW_HOSTED=1 " +
          "and PULSE_V2_HOSTED_PROJECT_REF to that project ref. Production/preprod refs stay blocked.",
      );
    }
    throw new V2EnvironmentIsolationError(
      "A dedicated hosted V2 project was requested. STOP before provisioning or connecting: " +
        "this slice does not create external Supabase projects.",
    );
  }

  throw new V2EnvironmentIsolationError(
    `PULSE_V2_SUPABASE_URL is not a local Supabase URL: ${url}`,
  );
}

export function assertV2EnvironmentIsolated(
  env: NodeJS.Dict<string> = process.env,
): V2DatabaseTarget {
  return resolveV2DatabaseTarget(env);
}
