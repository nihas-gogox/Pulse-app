import type {
  CommandEnvelope,
  CommandRecord,
  CommandStoreStatus,
} from "../../../../contracts/src/command/command-envelope";
import type { CommandResult } from "../../../../contracts/src/command/command-result";
import { V2PersistenceError } from "../v2PersistenceError";
import { CommandStoreError } from "./commandStoreError";
import type { RecordCommandOutcome } from "./commandStore.types";

const ALLOWED_TRANSITIONS: Record<CommandStoreStatus, readonly CommandStoreStatus[]> = {
  RECEIVED: ["PROCESSING"],
  PROCESSING: ["COMPLETED", "FAILED", "STALE"],
  STALE: ["RETRYING"],
  RETRYING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: [],
};

function nowIso(): string {
  return new Date().toISOString();
}

function cloneRecord(record: CommandRecord): CommandRecord {
  return {
    ...record,
    payload: record.payload,
  };
}

function findByCommandId(rows: CommandRecord[], commandId: string): CommandRecord | undefined {
  return rows.find((row) => row.commandId === commandId);
}

function findByIdempotency(
  rows: CommandRecord[],
  tenantId: string,
  idempotencyKey: string,
): CommandRecord | undefined {
  return rows.find(
    (row) => row.tenantId === tenantId && row.idempotencyKey === idempotencyKey,
  );
}

function requireRecord(rows: CommandRecord[], commandId: string): CommandRecord {
  const found = findByCommandId(rows, commandId);
  if (!found) {
    throw new CommandStoreError("COMMAND_STORE_NOT_FOUND", "command not found");
  }
  return found;
}

function assertTransition(from: CommandStoreStatus, to: CommandStoreStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new CommandStoreError(
      "COMMAND_STORE_INVALID_TRANSITION",
      `invalid command lifecycle transition ${from} → ${to}`,
    );
  }
}

function replaceRow(rows: CommandRecord[], next: CommandRecord): CommandRecord[] {
  return rows.map((row) => (row.commandId === next.commandId ? next : row));
}

export function recordCommand(
  rows: CommandRecord[],
  envelope: CommandEnvelope,
  options?: { requestHash?: string },
): { rows: CommandRecord[]; outcome: RecordCommandOutcome } {
  const existingKey = findByIdempotency(rows, envelope.tenantId, envelope.idempotencyKey);
  if (existingKey) {
    return { rows, outcome: { created: false, record: cloneRecord(existingKey) } };
  }
  if (findByCommandId(rows, envelope.commandId)) {
    throw new V2PersistenceError("duplicate entity id", { kind: "duplicate" });
  }
  const stamp = nowIso();
  const record: CommandRecord = {
    commandId: envelope.commandId,
    commandName: envelope.commandName,
    commandVersion: envelope.commandVersion,
    schemaVersion: envelope.schemaVersion,
    idempotencyKey: envelope.idempotencyKey,
    correlationId: envelope.correlationId,
    tenantId: envelope.tenantId,
    payload: envelope.payload,
    status: "RECEIVED",
    createdAt: stamp,
    updatedAt: stamp,
  };
  if (envelope.causationId !== undefined) {
    record.causationId = envelope.causationId;
  }
  if (options?.requestHash !== undefined) {
    record.requestHash = options.requestHash;
  }
  return {
    rows: [...rows, record],
    outcome: { created: true, record: cloneRecord(record) },
  };
}

export function getByCommandId(
  rows: CommandRecord[],
  commandId: string,
): CommandRecord | null {
  const found = findByCommandId(rows, commandId);
  return found ? cloneRecord(found) : null;
}

export function getByIdempotencyKey(
  rows: CommandRecord[],
  tenantId: string,
  idempotencyKey: string,
): CommandRecord | null {
  const found = findByIdempotency(rows, tenantId, idempotencyKey);
  return found ? cloneRecord(found) : null;
}

function applyStatus(
  rows: CommandRecord[],
  commandId: string,
  nextStatus: CommandStoreStatus,
  patch: Partial<CommandRecord>,
): { rows: CommandRecord[]; record: CommandRecord } {
  const current = requireRecord(rows, commandId);
  assertTransition(current.status, nextStatus);
  const stamp = nowIso();
  const next: CommandRecord = {
    ...current,
    ...patch,
    status: nextStatus,
    updatedAt: stamp,
  };
  return { rows: replaceRow(rows, next), record: cloneRecord(next) };
}

export function markProcessing(
  rows: CommandRecord[],
  commandId: string,
): { rows: CommandRecord[]; record: CommandRecord } {
  const stamp = nowIso();
  return applyStatus(rows, commandId, "PROCESSING", { processingStartedAt: stamp });
}

export function markCompleted(
  rows: CommandRecord[],
  commandId: string,
  result: CommandResult,
): { rows: CommandRecord[]; record: CommandRecord } {
  const stamp = nowIso();
  const patch: Partial<CommandRecord> = {
    completedAt: stamp,
    responsePayload: result.data,
  };
  if (result.statusCode !== undefined) {
    patch.responseCode = result.statusCode;
  }
  return applyStatus(rows, commandId, "COMPLETED", patch);
}

export function markFailed(
  rows: CommandRecord[],
  commandId: string,
): { rows: CommandRecord[]; record: CommandRecord } {
  return applyStatus(rows, commandId, "FAILED", { completedAt: nowIso() });
}

export function markStale(
  rows: CommandRecord[],
  commandId: string,
): { rows: CommandRecord[]; record: CommandRecord } {
  return applyStatus(rows, commandId, "STALE", {});
}

export function markRetrying(
  rows: CommandRecord[],
  commandId: string,
): { rows: CommandRecord[]; record: CommandRecord } {
  return applyStatus(rows, commandId, "RETRYING", {});
}
