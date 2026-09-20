import path from "node:path";
import { BLOCKED_V2_SUPABASE_PROJECT_REFS } from "../env/productionProjectRefs";
import { V2EnvironmentIsolationError, supabaseProjectRefFromUrl } from "../env/v2SupabaseEnv";

export const V2_MIGRATIONS_RELATIVE = "packages/pulse-v2/supabase/migrations";
export const PRODUCTION_MIGRATIONS_RELATIVE = "supabase/migrations";

export function v2MigrationsAbsolute(repoRoot: string): string {
  return path.join(repoRoot, ...V2_MIGRATIONS_RELATIVE.split("/"));
}

export function productionMigrationsAbsolute(repoRoot: string): string {
  return path.join(repoRoot, ...PRODUCTION_MIGRATIONS_RELATIVE.split("/"));
}

export function assertV2MigrationPathIsolated(migrationsDir: string, repoRoot: string): void {
  const resolved = path.resolve(migrationsDir);
  const allowed = path.resolve(v2MigrationsAbsolute(repoRoot));
  const production = path.resolve(productionMigrationsAbsolute(repoRoot));
  if (resolved === production || resolved.startsWith(production + path.sep)) {
    throw new V2EnvironmentIsolationError(
      "V2 migrations must not use production supabase/migrations.",
    );
  }
  if (resolved !== allowed) {
    throw new V2EnvironmentIsolationError(
      `V2 migrations must live at ${V2_MIGRATIONS_RELATIVE} (got ${migrationsDir}).`,
    );
  }
}

export function assertV2MigrationTargetNotProduction(opts: {
  url?: string;
  linkedProjectRef?: string | null;
}): void {
  const fromUrl = opts.url ? supabaseProjectRefFromUrl(opts.url) : null;
  const ref = (opts.linkedProjectRef ?? fromUrl ?? "").toLowerCase();
  if (ref && (BLOCKED_V2_SUPABASE_PROJECT_REFS as readonly string[]).includes(ref)) {
    throw new V2EnvironmentIsolationError(
      `Refusing to apply V2 migrations to production/preprod project "${ref}".`,
    );
  }
}

export function assertV2MigrationApplyAllowed(opts: {
  migrationsDir: string;
  repoRoot: string;
  url?: string;
  linkedProjectRef?: string | null;
  allowHosted?: boolean;
}): void {
  assertV2MigrationPathIsolated(opts.migrationsDir, opts.repoRoot);
  assertV2MigrationTargetNotProduction({
    url: opts.url,
    linkedProjectRef: opts.linkedProjectRef,
  });
  const hosted = opts.url ? supabaseProjectRefFromUrl(opts.url) : null;
  if (hosted && !opts.allowHosted) {
    throw new V2EnvironmentIsolationError(
      "Hosted V2 migration apply is disabled (PULSE_V2_ALLOW_HOSTED is not set).",
    );
  }
  if (hosted && opts.allowHosted) {
    throw new V2EnvironmentIsolationError(
      "Hosted V2 is not provisioned. STOP: do not apply migrations to a hosted project.",
    );
  }
}
