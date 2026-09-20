# Event architecture (V2) — decisions frozen, runtime deferred

**Status:** Architecture decisions **FROZEN**. Event publishing, Event → Timeline, Event Store, and consumers are **DEFERRED**. This document does not authorize implementation.

Event Envelope v1 remains frozen (`oms/docs/contracts/EVENT_ENVELOPE.md`, `@pulse/contracts`). TimelineEntry v1 remains frozen. Command Store and command Timeline runtime are unchanged.

## Authoritative status

```text
Event Envelope v1              FROZEN
Event architecture             DECISIONS FROZEN
Event publishing               DEFERRED
Event consumers                NONE
Event Store                    DEFERRED
Event → Timeline runtime       DEFERRED
Event ordering                 OPEN / FUTURE
Event deduplication            OPEN / FUTURE
Event catalog selection        DEFERRED until consumer exists
```

## 1. No events until a real consumer

V2 Event Publishing is **DEFERRED** until a concrete consuming workflow is authorized.

Do **not** invent demonstration names (`OrderCreated`, `TripCreated`, `TripDelivered`, or any other). Quality Charter P-Q4 reserved-event rule stands: no V2 event without a real publisher **and** an identified consumer.

Do **not** merge or extend `@pulse/contracts` `DomainEventName` and production `docs/architecture/10-platform-event-catalog.md`. Do **not** create a third V2 catalog. The first real consumer chooses the name through a dedicated later decision.

## 2. Writer boundary (when later authorized)

Canonical V2 publish path:

```text
Domain operation
      ↓
CommandExecutionContext.publishEvent(...)
      ↓
PlatformRuntime.publishEvent(...)
      ↓
in-process handling / Event Timeline
```

This matches frozen `CommandExecutionContext.publishEvent` and `CommandResult.events = never`. Domains must not persist Event Envelopes or own event infrastructure. Do not add a second event API.

**Not implemented.** Canonical `packages/platform/runtime` `publishEvent` remains a stub. V2 `createV2PlatformRuntime` does not publish events.

## 3. Timing (when later authorized)

```text
Domain succeeds
      ↓
Command Store markCompleted
      ↓
Command Timeline append
      ↓
Event publish
      ↓
Event Timeline append
```

This extends the landed command path; it does **not** move publish before `COMPLETED` or into the domain transaction. Command Timeline runtime must not be rewritten for this freeze.

## 4. Failure (when later authorized)

If Command is `COMPLETED` and Event publication fails:

- Command stays `COMPLETED`. Domain is not rolled back. Command Timeline stays valid.
- No saga, distributed transaction, automatic retry worker, or rollback.
- Failed Event is a separate provenance/delivery concern. Recovery requires a later owner authorization.

## 5. Event Timeline (when later authorized)

One successfully published Event → one Timeline `entryKind: "event"` row using TimelineEntry v1 **identity/provenance only**. Event Envelope still has `payload`; Timeline does **not** store payload. Timeline is **not** an Event Store.

## 6. Persistence and infrastructure

Day-1 (when authorized) is in-process publication → Timeline event provenance. **No** Event Store, Kafka, Redis, RabbitMQ, broker, queue, microservice, or network bus. Durable Event storage is a separate later decision.

## 7. Deduplication and ordering

**OPEN — FUTURE OWNER DECISION.** Do not treat `eventId`, `correlationId`, or `causationId` as a Timeline/Event dedup key. Do not add sequence numbers or treat `occurredAt` / `recordedAt` as ordering guarantees.

## 8. Tenancy and identity (when later authorized)

`event.tenantId = AuthorizationContext.workspaceId` — same trusted Workspace rule as commands. Never from payload or caller claims.

Do **not** add `actorId` / `membershipId` to Event Envelope v1. Do not invent sidecar metadata. Further actor provenance is a later decision.

## Not authorized by this freeze

`publishEvent()` / `appendEvent()` implementation, domain emission, event payloads, consumers (Finance, Network, Communications, Observatory), Event Store, retry/recovery, event bus.
