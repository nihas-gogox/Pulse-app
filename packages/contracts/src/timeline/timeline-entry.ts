/**
 * Frozen Timeline Entry contract v1.
 *
 * Authoritative docs: oms/docs/contracts/TIMELINE_ENTRY.md,
 * oms/docs/contracts/EVENT_ENVELOPE.md (Timeline rule),
 * packages/platform/timeline/README.md.
 *
 * Timeline is an append-only, domain-neutral provenance log.
 * One entry per successful command. One entry per published event.
 * Never updated. Never deleted. Not Command Store. Not Event Store.
 * Not domain history (e.g. getTripTimeline).
 *
 * Never remove fields; only add optional ones in a new schemaVersion value.
 */
import type { SchemaVersion } from '../common/metadata';

export const TIMELINE_ENTRY_SCHEMA_VERSION: SchemaVersion = 'v1';

export type TimelineEntryKind = 'command' | 'event';

/**
 * Fields shared by every Timeline row. Tenancy uses envelope `tenantId`.
 * AuthorizationContext.workspaceId → tenantId mapping is OPEN (not decided here).
 * actorId / membershipId are not Timeline fields (not on Command/Event envelopes).
 */
export interface TimelineEntryBase {
  schemaVersion: SchemaVersion;
  entryKind: TimelineEntryKind;
  tenantId: string;
  correlationId: string;
  causationId?: string;
  /**
   * Wall-clock when this row was appended. NOT an ordering guarantee.
   * Timeline ordering remains OPEN / UNSPECIFIED.
   */
  recordedAt: string;
}

/** Provenance of one successful command. Does not carry CommandRecord lifecycle. */
export interface TimelineCommandEntry extends TimelineEntryBase {
  entryKind: 'command';
  commandId: string;
  commandName: string;
}

/**
 * Provenance of one published event. References Event Envelope identity;
 * does not store event payload (Timeline is not the Event Store).
 */
export interface TimelineEventEntry extends TimelineEntryBase {
  entryKind: 'event';
  eventId: string;
  eventName: string;
  /** When the fact occurred — Event Envelope v1 `occurredAt`. */
  occurredAt: string;
  /** Event Envelope v1 graph parent. Optional. Not a Timeline-invented edge table. */
  parentEventId?: string;
}

export type TimelineEntry = TimelineCommandEntry | TimelineEventEntry;
