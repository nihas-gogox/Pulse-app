import path from "node:path";
import { BLOCKED_V2_SUPABASE_PROJECT_REFS } from "./productionProjectRefs";

export type V2DataPlaneMode = "memory" | "local-supabase" | "local-durable";

export type V2PersistenceConfig =
  | {
      mode: "memory";
      supabaseUrl: null;
      anonKey: null;
      serviceRoleKey: null;
      hostedProjectRef: null;
    }
  | {
      mode: "local-supabase";
      supabaseUrl: string;
      anonKey: string;
      serviceRoleKey: string | null;
      hostedProjectRef: null;
    }
  | {
      mode: "local-durable";
      supabaseUrl: null;
      anonKey: null;
      serviceRoleKey: null;
      hostedProjectRef: null;
      dataDir: string;
    };

/** @deprecated Use V2PersistenceConfig.mode / supabaseUrl */
export type V2DatabaseTarget =
  | { mode: "memory"; supabaseUrl: null }
  | { mode: "local-supabase"; supabaseUrl: string }
  | { mode: "local-durable"; supabaseUrl: null };

export class V2EnvironmentIsolationError extends Error {
  readonly code = "V2_ENV_ISOLATION";
  constructor(message: string) {
    super(message);
    this.name = "V2EnvironmentIsolationError";
  }
}

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "0.0.0.0"]);

const V2_ENV_KEYS = [
  "PULSE_V2_SUPABASE_URL",
  "PULSE_V2_SUPABASE_ANON_KEY",
  "PULSE_V2_SUPABASE_SERVICE_ROLE_KEY",
  "PULSE_V2_HOSTED_PROJECT_REF",
  "PULSE_V2_ALLOW_HOSTED",
  "PULSE_V2_DATA_DIR",
] as const;

export const PULSE_V2_ENV_KEYS = V2_ENV_KEYS;

const REJECTED_PRODUCTION_ENV_KEYS = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export const REJECTED_V2_PRODUCTION_ENV_KEYS = REJECTED_PRODUCTION_ENV_KEYS;

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

function v2Only(env: NodeJS.Dict<string>, key: (typeof V2_ENV_KEYS)[number]): string {
  return (env[key] ?? "").trim();
}

/**
 * V2 never reads EXPO_PUBLIC_SUPABASE_* / VITE_SUPABASE_* / unprefixed SUPABASE_*.
 * Unset PULSE_V2_SUPABASE_URL → in-memory unless PULSE_V2_DATA_DIR is set
 * (local durable Commerce/Execution files; not hosted, not production).
 * Hosted URLs never open a client (project not provisioned).
 */
export function resolveV2PersistenceConfig(
  env: NodeJS.Dict<string> = process.env,
): V2PersistenceConfig {
  const url = v2Only(env, "PULSE_V2_SUPABASE_URL");
  const anonKey = v2Only(env, "PULSE_V2_SUPABASE_ANON_KEY");
  const serviceRoleKey = v2Only(env, "PULSE_V2_SUPABASE_SERVICE_ROLE_KEY") || null;
  const dataDir = v2Only(env, "PULSE_V2_DATA_DIR");

  if (url && dataDir) {
    throw new V2EnvironmentIsolationError(
      "PULSE_V2_SUPABASE_URL and PULSE_V2_DATA_DIR cannot both be set.",
    );
  }

  if (!url) {
    if (dataDir) {
      return resolveLocalDurableDir(dataDir);
    }
    return {
      mode: "memory",
      supabaseUrl: null,
      anonKey: null,
      serviceRoleKey: null,
      hostedProjectRef: null,
    };
  }

  const ref = supabaseProjectRefFromUrl(url);
  if (ref && (BLOCKED_V2_SUPABASE_PROJECT_REFS as readonly string[]).includes(ref)) {
    throw new V2EnvironmentIsolationError(
      `Pulse V2 must not use production/preprod Supabase project ref "${ref}". ` +
        "Use in-memory (unset PULSE_V2_SUPABASE_URL) or local Supabase (127.0.0.1:54321).",
    );
  }

  if (isLocalSupabaseUrl(url)) {
    if (!anonKey) {
      throw new V2EnvironmentIsolationError(
        "PULSE_V2_SUPABASE_ANON_KEY is required when PULSE_V2_SUPABASE_URL points at local Supabase.",
      );
    }
    return {
      mode: "local-supabase",
      supabaseUrl: url,
      anonKey,
      serviceRoleKey,
      hostedProjectRef: null,
    };
  }

  const hostedRef = supabaseProjectRefFromUrl(url);
  if (hostedRef) {
    const allowHosted = truthy(env.PULSE_V2_ALLOW_HOSTED);
    const approved = v2Only(env, "PULSE_V2_HOSTED_PROJECT_REF").toLowerCase();
    if (!allowHosted || approved !== hostedRef) {
      throw new V2EnvironmentIsolationError(
        "Hosted V2 Supabase is not approved. STOP: do not provision a dedicated " +
          "project without infrastructure approval. After approval, set PULSE_V2_ALLOW_HOSTED=1 " +
          "and PULSE_V2_HOSTED_PROJECT_REF to that project ref. Production/preprod refs stay blocked.",
      );
    }
    throw new V2EnvironmentIsolationError(
      "A dedicated hosted V2 project was requested but is not provisioned. STOP: do not connect. " +
        "This slice does not create external Supabase projects.",
    );
  }

  throw new V2EnvironmentIsolationError(
    `PULSE_V2_SUPABASE_URL is not a local Supabase URL: ${url}`,
  );
}

function resolveLocalDurableDir(dataDir: string): V2PersistenceConfig {
  if (dataDir.toLowerCase().includes("supabase.co")) {
    throw new V2EnvironmentIsolationError(
      "PULSE_V2_DATA_DIR must not point at a hosted Supabase host.",
    );
  }
  if (!path.isAbsolute(dataDir)) {
    throw new V2EnvironmentIsolationError(
      "PULSE_V2_DATA_DIR must be an absolute local path (LOCAL V2 DATABASE ONLY).",
    );
  }
  return {
    mode: "local-durable",
    supabaseUrl: null,
    anonKey: null,
    serviceRoleKey: null,
    hostedProjectRef: null,
    dataDir,
  };
}

export function resolveV2DatabaseTarget(
  env: NodeJS.Dict<string> = process.env,
): V2DatabaseTarget {
  const cfg = resolveV2PersistenceConfig(env);
  if (cfg.mode === "local-durable") {
    return { mode: "local-durable", supabaseUrl: null };
  }
  return { mode: cfg.mode, supabaseUrl: cfg.supabaseUrl };
}

export function assertV2EnvironmentIsolated(
  env: NodeJS.Dict<string> = process.env,
): V2DatabaseTarget {
  return resolveV2DatabaseTarget(env);
}

export function assertV2PersistenceConfig(
  env: NodeJS.Dict<string> = process.env,
): V2PersistenceConfig {
  return resolveV2PersistenceConfig(env);
}
