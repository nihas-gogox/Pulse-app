import { randomUUID } from "node:crypto";
import type { CommandEnvelope } from "../../../contracts/src/command/command-envelope";
import { COMMAND_ENVELOPE_SCHEMA_VERSION } from "../../../contracts/src/command/command-envelope";
import type { AuthorizationContext } from "../identity/authorizationContext";
import type { CommandStoreRepository } from "../persistence/commandStore/commandStore.types";
import { CommandStoreError } from "../persistence/commandStore/commandStoreError";
import { isV2PersistenceError } from "../persistence/v2PersistenceError";
import type { V2GatewayError, V2GatewayRequest, V2GatewayResponse } from "../gateway/types";
import type { V2CommandOperation } from "./v2CommandOperations";

/**
 * In-process V2 PlatformRuntime for Command Store-backed commands.
 * Sync subset of packages/platform/runtime PlatformRuntime.executeCommand.
 * Does not write Timeline. Does not publish events.
 *
 * tenantId is always AuthorizationContext.workspaceId (owner decision).
 */
export type V2PlatformRuntime = {
  executeCommand(
    request: V2GatewayRequest,
    ctx: AuthorizationContext,
    runDomain: () => V2GatewayResponse,
  ): V2GatewayResponse;
};

export type V2PlatformRuntimeOptions = {
  commandStore: CommandStoreRepository;
  createCommandId?: () => string;
};

function deny(code: string, message: string, correlationId: string): V2GatewayError {
  return { ok: false, code, message, correlationId };
}

function replayCompleted(record: { responsePayload?: unknown }, correlationId: string): V2GatewayResponse {
  const stored = record.responsePayload;
  if (
    stored &&
    typeof stored === "object" &&
    "ok" in stored &&
    "correlationId" in stored
  ) {
    return stored as V2GatewayResponse;
  }
  return deny("V2_COMMAND_REPLAY_INVALID", "completed command has no stored result", correlationId);
}

function buildEnvelope(
  request: V2GatewayRequest,
  ctx: AuthorizationContext,
  commandId: string,
  operation: V2CommandOperation,
): CommandEnvelope {
  const idempotencyKey = request.idempotencyKey?.trim() ?? "";
  const envelope: CommandEnvelope = {
    commandId,
    commandName: operation,
    commandVersion: "v1",
    schemaVersion: COMMAND_ENVELOPE_SCHEMA_VERSION,
    idempotencyKey,
    correlationId: ctx.correlationId,
    tenantId: ctx.workspaceId,
    payload: request.payload,
  };
  return envelope;
}

export function createV2PlatformRuntime(options: V2PlatformRuntimeOptions): V2PlatformRuntime {
  const createCommandId = options.createCommandId ?? (() => randomUUID());
  const store = options.commandStore;

  return {
    executeCommand(request, ctx, runDomain) {
      const operation = request.operation as V2CommandOperation;
      const envelope = buildEnvelope(request, ctx, createCommandId(), operation);

      let recorded;
      try {
        recorded = store.record(envelope);
      } catch (err) {
        if (isV2PersistenceError(err) || err instanceof CommandStoreError) throw err;
        throw err;
      }

      const record = recorded.record;
      if (record.status === "COMPLETED") {
        return replayCompleted(record, ctx.correlationId);
      }
      if (record.status === "FAILED") {
        return deny("V2_COMMAND_FAILED", "command previously failed", ctx.correlationId);
      }
      if (record.status === "PROCESSING" || record.status === "STALE" || record.status === "RETRYING") {
        return deny("V2_COMMAND_IN_PROGRESS", `command is ${record.status}`, ctx.correlationId);
      }

      try {
        store.markProcessing(record.commandId);
      } catch (err) {
        if (isV2PersistenceError(err) || err instanceof CommandStoreError) throw err;
        throw err;
      }

      let domainResult: V2GatewayResponse;
      try {
        domainResult = runDomain();
      } catch (err) {
        try {
          store.markFailed(record.commandId);
        } catch {
          // Prefer the original domain/persistence error after best-effort FAILED stamp.
        }
        throw err;
      }

      if (!domainResult.ok) {
        store.markFailed(record.commandId);
        return domainResult;
      }

      store.markCompleted(record.commandId, { data: domainResult });
      return domainResult;
    },
  };
}
