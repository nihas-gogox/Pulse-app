import {
  getPlatformEventLogByCorrelationId,
  type PlatformEventLogEntry,
} from '../events/PlatformEventLog';

export type PublishAcceptanceEventRow = {
  eventName: string;
  correlationId: string;
  workspaceId: string;
  orderId: string | null;
  indentId: string | null;
  occurredAt: string;
};

export type PublishAcceptanceVerification = {
  ok: boolean;
  errors: string[];
  events: PublishAcceptanceEventRow[];
};

function mapEventRow(
  entry: PlatformEventLogEntry,
  workspaceId: string,
): PublishAcceptanceEventRow {
  const payload = entry.payload;
  return {
    eventName: entry.eventType,
    correlationId: entry.correlationId,
    workspaceId,
    orderId: typeof payload.orderId === 'string' ? payload.orderId : null,
    indentId: typeof payload.indentId === 'string' ? payload.indentId : null,
    occurredAt: entry.occurredAt,
  };
}

/** Dev acceptance helper — validates in-memory event log for a publish flow. */
export function verifyPublishIndentAcceptance(
  correlationId: string,
  expected: { workspaceId: string; orderId: string; indentId: string },
): PublishAcceptanceVerification {
  const log = getPlatformEventLogByCorrelationId(correlationId);
  const errors: string[] = [];
  const events = log.map((e) => mapEventRow(e, expected.workspaceId));

  if (log.length !== 2) {
    errors.push(`Expected 2 events, got ${log.length}`);
  }
  if (log[0]?.eventType !== 'OrderReadyForDispatch') {
    errors.push('First event must be OrderReadyForDispatch');
  }
  if (log[1]?.eventType !== 'IndentCreated') {
    errors.push('Second event must be IndentCreated');
  }

  for (const entry of log) {
    if (entry.correlationId !== correlationId) {
      errors.push(`Event ${entry.eventType} has mismatched correlationId`);
    }
    const payload = entry.payload;
    if (typeof payload.orderId === 'string' && payload.orderId !== expected.orderId) {
      errors.push(`Event ${entry.eventType} orderId mismatch`);
    }
    if (entry.eventType === 'IndentCreated') {
      if (typeof payload.indentId !== 'string' || payload.indentId !== expected.indentId) {
        errors.push('IndentCreated indentId mismatch');
      }
    }
  }

  return { ok: errors.length === 0, errors, events };
}
