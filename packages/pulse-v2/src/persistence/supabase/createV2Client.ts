import { V2EnvironmentIsolationError, type V2PersistenceConfig } from "../../env/v2SupabaseEnv";

/**
 * Minimal PostgREST surface used by V2 adapters. Instantiated only here.
 * Domain modules must not import @supabase/supabase-js.
 */
export type V2DatabaseClient = {
  schema: (name: string) => {
    from: (table: string) => unknown;
  };
};

export type CreateSupabaseClient = (
  url: string,
  key: string,
) => V2DatabaseClient;

export function createV2DatabaseClient(
  config: V2PersistenceConfig,
  createClientImpl?: CreateSupabaseClient,
): V2DatabaseClient {
  if (config.mode === "memory" || config.mode === "local-durable") {
    throw new V2EnvironmentIsolationError(
      "createV2DatabaseClient is not used in memory or local-durable mode.",
    );
  }
  if (!config.anonKey) {
    throw new V2EnvironmentIsolationError("V2 client requires PULSE_V2_SUPABASE_ANON_KEY.");
  }
  if (!createClientImpl) {
    throw new V2EnvironmentIsolationError(
      "V2 database client must be injected at persistence/supabase/createV2Client " +
        "(do not import @supabase/supabase-js from domain code). Hosted V2 is not provisioned.",
    );
  }
  return createClientImpl(config.supabaseUrl, config.anonKey);
}
