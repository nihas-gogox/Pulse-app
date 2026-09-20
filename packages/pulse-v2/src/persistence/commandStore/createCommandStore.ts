import type { CommandStoreRepository } from "./commandStore.types";
import { createCommandStoreDurableRepository } from "./commandStoreDurable";
import { createCommandStoreMemoryRepository } from "./commandStoreMemory";

export type CommandStorePersistenceConfig =
  | { mode: "memory" }
  | { mode: "local-durable"; dataDir: string };

/**
 * Independent Command Store factory. Not wired into Gateway or PlatformRuntime.
 */
export function createCommandStore(
  config: CommandStorePersistenceConfig,
): CommandStoreRepository {
  if (config.mode === "memory") {
    return createCommandStoreMemoryRepository();
  }
  return createCommandStoreDurableRepository(config.dataDir);
}
