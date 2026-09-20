/**
 * Command Store persistence types.
 *
 * Frozen Command Envelope v1 is authoritative (`@pulse/contracts` /
 * oms/docs/contracts/COMMAND_ENVELOPE.md). This adapter does not add
 * workspaceId, actorId, or membershipId to the envelope.
 *
 * Mapping dependency (unresolved; not decided here):
 * AuthorizationContext.workspaceId is V2 tenancy authority at Gateway.
 * CommandEnvelope.tenantId remains the persisted tenancy field.
 * This adapter stores envelope.tenantId as given. It is not the
 * authorization boundary and does not treat caller workspace/tenant
 * claims as Identity authority.
 *
 * Actor/membership stamping is deferred to runtime integration —
 * CommandRecord has no authoritative actorId/membershipId fields.
 */
export type {
  CommandEnvelope,
  CommandRecord,
  CommandStoreStatus,
} from "../../../../contracts/src/command/command-envelope";
export type { CommandResult } from "../../../../contracts/src/command/command-result";

import type { CommandEnvelope, CommandRecord } from "../../../../contracts/src/command/command-envelope";
import type { CommandResult } from "../../../../contracts/src/command/command-result";

export type RecordCommandOutcome = {
  /** false when (tenantId, idempotencyKey) already existed (idempotent). */
  created: boolean;
  record: CommandRecord;
};

export type CommandStoreRepository = {
  record(envelope: CommandEnvelope, options?: { requestHash?: string }): RecordCommandOutcome;
  getByCommandId(commandId: string): CommandRecord | null;
  getByIdempotencyKey(tenantId: string, idempotencyKey: string): CommandRecord | null;
  markProcessing(commandId: string): CommandRecord;
  markCompleted(commandId: string, result: CommandResult): CommandRecord;
  markFailed(commandId: string): CommandRecord;
  markStale(commandId: string): CommandRecord;
  markRetrying(commandId: string): CommandRecord;
};
