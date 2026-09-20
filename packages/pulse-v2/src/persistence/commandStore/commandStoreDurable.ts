import type { CommandRecord } from "../../../../contracts/src/command/command-envelope";
import { commandStoreTablePath, readJsonTable, writeJsonTable } from "../durable/jsonTable";
import type { CommandStoreRepository } from "./commandStore.types";
import {
  getByCommandId,
  getByIdempotencyKey,
  markCompleted,
  markFailed,
  markProcessing,
  markRetrying,
  markStale,
  recordCommand,
} from "./commandStoreState";

export function createCommandStoreDurableRepository(dataDir: string): CommandStoreRepository {
  const filePath = commandStoreTablePath(dataDir);

  const load = (): CommandRecord[] => readJsonTable<CommandRecord>(filePath);
  const save = (rows: CommandRecord[]): void => {
    writeJsonTable(filePath, rows);
  };

  return {
    record(envelope, options) {
      const next = recordCommand(load(), envelope, options);
      if (next.outcome.created) save(next.rows);
      return next.outcome;
    },
    getByCommandId(commandId) {
      return getByCommandId(load(), commandId);
    },
    getByIdempotencyKey(tenantId, idempotencyKey) {
      return getByIdempotencyKey(load(), tenantId, idempotencyKey);
    },
    markProcessing(commandId) {
      const next = markProcessing(load(), commandId);
      save(next.rows);
      return next.record;
    },
    markCompleted(commandId, result) {
      const next = markCompleted(load(), commandId, result);
      save(next.rows);
      return next.record;
    },
    markFailed(commandId) {
      const next = markFailed(load(), commandId);
      save(next.rows);
      return next.record;
    },
    markStale(commandId) {
      const next = markStale(load(), commandId);
      save(next.rows);
      return next.record;
    },
    markRetrying(commandId) {
      const next = markRetrying(load(), commandId);
      save(next.rows);
      return next.record;
    },
  };
}
