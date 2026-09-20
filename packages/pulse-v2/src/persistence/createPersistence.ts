import type { CommerceRepository } from "../domains/commerce/repository";
import type { ExecutionRepository } from "../domains/execution/repository";
import type { V2PersistenceConfig } from "../env/v2SupabaseEnv";
import { createCommerceMemoryRepository } from "./memory/commerceMemory";
import { createExecutionMemoryRepository } from "./memory/executionMemory";
import { createV2DatabaseClient, type CreateSupabaseClient } from "./supabase/createV2Client";
import { createCommerceSupabaseRepository } from "./supabase/commerceAdapter";
import { createExecutionSupabaseRepository } from "./supabase/executionAdapter";

export type V2Persistence = {
  commerce: CommerceRepository;
  execution: ExecutionRepository;
};

export function createV2Persistence(
  config: V2PersistenceConfig,
  createClientImpl?: CreateSupabaseClient,
): V2Persistence {
  if (config.mode === "memory") {
    return {
      commerce: createCommerceMemoryRepository(),
      execution: createExecutionMemoryRepository(),
    };
  }
  const client = createV2DatabaseClient(config, createClientImpl);
  return {
    commerce: createCommerceSupabaseRepository(client),
    execution: createExecutionSupabaseRepository(client),
  };
}
