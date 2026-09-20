export { BLOCKED_V2_SUPABASE_PROJECT_REFS } from "./env/productionProjectRefs";
export {
  assertV2EnvironmentIsolated,
  assertV2PersistenceConfig,
  resolveV2DatabaseTarget,
  resolveV2PersistenceConfig,
  V2EnvironmentIsolationError,
  PULSE_V2_ENV_KEYS,
  REJECTED_V2_PRODUCTION_ENV_KEYS,
} from "./env/v2SupabaseEnv";
export { createPulseV2Gateway } from "./gateway/pulseV2Gateway";
export type { PulseV2Gateway, PulseV2GatewayOptions } from "./gateway/pulseV2Gateway";
export type {
  V2Execute,
  V2GatewayRequest,
  V2GatewayResponse,
} from "./gateway/types";
export type { AuthorizationContext } from "./identity/authorizationContext";
export type {
  IdentityPort,
  MembershipRecord,
  MembershipResolveResult,
  MembershipStatus,
} from "./identity/identityPort";
export { createMemoryIdentityPort } from "./identity/memoryIdentityPort";
export { assertV2DomainTables, scanV2DomainTables, scanV2SourceText } from "./architecture/domainTableGuard";
export { assertV2ForbiddenImports, scanV2ForbiddenImports, scanV2ImportSource } from "./architecture/v2ImportGuard";
export { createV2Persistence } from "./persistence/createPersistence";
export { createV2DatabaseClient } from "./persistence/supabase/createV2Client";
export {
  V2_MIGRATIONS_RELATIVE,
  PRODUCTION_MIGRATIONS_RELATIVE,
  assertV2MigrationApplyAllowed,
} from "./persistence/migrationIsolation";
