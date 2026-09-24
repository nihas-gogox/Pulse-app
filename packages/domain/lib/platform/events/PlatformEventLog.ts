import { uuidv7 } from '@pulse/core/lib/uuidv7';
import type { PlatformDomainEvent, PlatformDomainEventName } from './types';

export type PlatformEventLogEntry = {
  id: string;
  correlationId: string;
  eventType: PlatformDomainEventName;
  aggregateType: 'order' | 'indent' | 'trip';
  aggregateId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

const entries: PlatformEventLogEntry[] = [];
const rnDevFlag = (globalThis as { __DEV__?: boolean }).__DEV__;
let enabled = typeof rnDevFlag !== 'undefined' ? rnDevFlag : process.env.NODE_ENV !== 'production';

function aggregateFromEvent(event: PlatformDomainEvent): Pick<PlatformEventLogEntry, 'aggregateType' | 'aggregateId'> {
  const payload = event.payload as Record<string, unknown>;
  if (event.name === 'IndentCreated' && typeof payload.indentId === 'string') {
    return { aggregateType: 'indent', aggregateId: payload.indentId };
  }
  if (typeof payload.orderId === 'string') {
    return { aggregateType: 'order', aggregateId: payload.orderId };
  }
  if (typeof payload.tripId === 'string') {
    return { aggregateType: 'trip', aggregateId: payload.tripId };
  }
  return { aggregateType: 'order', aggregateId: 'unknown' };
}

export function setPlatformEventLogEnabled(value: boolean): void {
  enabled = value;
}

export function isPlatformEventLogEnabled(): boolean {
  return enabled;
}

export function recordPlatformEventLog(event: PlatformDomainEvent): void {
  if (!enabled) return;
  const { aggregateType, aggregateId } = aggregateFromEvent(event);
  entries.push({
    id: uuidv7(),
    correlationId: event.correlationId,
    eventType: event.name,
    aggregateType,
    aggregateId,
    occurredAt: event.occurredAt,
    payload: { ...event.payload },
  });
}

export function getPlatformEventLog(): readonly PlatformEventLogEntry[] {
  return entries;
}

export function getPlatformEventLogByCorrelationId(correlationId: string): PlatformEventLogEntry[] {
  return entries.filter((e) => e.correlationId === correlationId);
}

export function clearPlatformEventLog(): void {
  entries.length = 0;
}
