/**
 * Focused TimelineEntry contract checks.
 * Runtime/persistence are not implemented; this asserts the frozen shape only.
 *
 * Also runnable with: npx tsx packages/contracts/tests/timeline-entry.contract.test.ts
 */
import assert from 'node:assert/strict';
import type {
  CommandEnvelope,
  EventEnvelope,
  TimelineCommandEntry,
  TimelineEventEntry,
  TimelineEntry,
} from '../src/index';
import { TIMELINE_ENTRY_SCHEMA_VERSION } from '../src/index';

function test(name: string, fn: () => void): void {
  fn();
  console.log(`ok - ${name}`);
}

const command: TimelineCommandEntry = {
  schemaVersion: 'v1',
  entryKind: 'command',
  tenantId: 'TENANT-000001',
  correlationId: 'corr-1',
  causationId: 'cause-1',
  recordedAt: '2026-09-21T00:00:01.000Z',
  commandId: 'cmd-1',
  commandName: 'CreateOrder',
};

const event: TimelineEventEntry = {
  schemaVersion: 'v1',
  entryKind: 'event',
  tenantId: 'TENANT-000001',
  correlationId: 'corr-1',
  causationId: 'cmd-1',
  recordedAt: '2026-09-21T00:00:02.000Z',
  eventId: 'evt-1',
  eventName: 'OrderCreated',
  occurredAt: '2026-09-21T00:00:00.000Z',
};

test('schema version constant is frozen at v1', () => {
  assert.equal(TIMELINE_ENTRY_SCHEMA_VERSION, 'v1');
});

test('entryKind discriminates command vs event provenance', () => {
  const entries: TimelineEntry[] = [command, event];
  assert.equal(entries[0]?.entryKind, 'command');
  assert.equal(entries[1]?.entryKind, 'event');
  if (entries[0]?.entryKind === 'command') {
    assert.equal(entries[0].commandId, 'cmd-1');
  }
  if (entries[1]?.entryKind === 'event') {
    assert.equal(entries[1].eventId, 'evt-1');
  }
});

test('command entry references Command Envelope identity without being a CommandEnvelope', () => {
  assert.equal(command.commandId, 'cmd-1');
  assert.equal(command.commandName, 'CreateOrder');
  assert.equal(command.correlationId, 'corr-1');
  assert.equal(command.tenantId, 'TENANT-000001');
  assert.equal('idempotencyKey' in command, false);
  assert.equal('payload' in command, false);
  assert.equal('status' in command, false);
  const _notCommandEnvelope: CommandEnvelope | TimelineCommandEntry = command;
  void _notCommandEnvelope;
});

test('event entry references Event Envelope identity without being an EventEnvelope', () => {
  assert.equal(event.eventId, 'evt-1');
  assert.equal(event.eventName, 'OrderCreated');
  assert.equal(event.occurredAt, '2026-09-21T00:00:00.000Z');
  assert.equal('payload' in event, false);
  const _notEventEnvelope: EventEnvelope | TimelineEventEntry = event;
  void _notEventEnvelope;
});

test('does not invent workspaceId, actorId, membershipId, sequence, or dedup keys', () => {
  for (const row of [command, event] as TimelineEntry[]) {
    assert.equal('workspaceId' in row, false);
    assert.equal('actorId' in row, false);
    assert.equal('membershipId' in row, false);
    assert.equal('sequence' in row, false);
    assert.equal('sequenceNumber' in row, false);
    assert.equal('dedupKey' in row, false);
  }
});

console.log('TimelineEntry contract: all checks passed');
