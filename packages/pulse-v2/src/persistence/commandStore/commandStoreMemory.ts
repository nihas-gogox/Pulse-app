import type { CommandRecord } from "../../../../contracts/src/command/command-envelope";
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

export function createCommandStoreMemoryRepository(): CommandStoreRepository {
  let rows: CommandRecord[] = [];

  return {
    record(envelope, options) {
      const next = recordCommand(rows, envelope, options);
      rows = next.rows;
      return next.outcome;
    },
    getByCommandId(commandId) {
      return getByCommandId(rows, commandId);
    },
    getByIdempotencyKey(tenantId, idempotencyKey) {
      return getByIdempotencyKey(rows, tenantId, idempotencyKey);
    },
    markProcessing(commandId) {
      const next = markProcessing(rows, commandId);
      rows = next.rows;
      return next.record;
    },
    markCompleted(commandId, result) {
      const next = markCompleted(rows, commandId, result);
      rows = next.rows;
      return next.record;
    },
    markFailed(commandId) {
      const next = markFailed(rows, commandId);
      rows = next.rows;
      return next.record;
    },
    markStale(commandId) {
      const next = markStale(rows, commandId);
      rows = next.rows;
      return next.record;
    },
    markRetrying(commandId) {
      const next = markRetrying(rows, commandId);
      rows = next.rows;
      return next.record;
    },
  };
}
