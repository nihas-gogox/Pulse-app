# Command Timeline runtime (V2)

**Status:** Command-only Timeline append is implemented. Event Timeline, Observatory, and projections are **not**.

## Writer

**`createV2PlatformRuntime` is the only writer.** Gateway does not append. Domain handlers do not append. Command Store does not append. Repositories persist only what Runtime passes to `appendCommand`.

```text
Gateway execute()
  → Identity / AuthorizationContext
  → PlatformRuntime
  → Command Store RECEIVED → PROCESSING → domain → COMPLETED
  → Timeline append (command entry)
  → Gateway response
```

## Scope

One Timeline **command** entry per newly completed **public** command:

- `commerce.createOrder`
- `execution.createTripFromOrder`

Nested `createOrder` → internal `createTripFromOrder` is **one** command and **one** Timeline entry.

Queries (`getOrder`, `getTrip`, `getTripByOrderId`) and `createWorkspace` do not write Timeline.

## When it appends

| Command Store outcome | Timeline |
| --------------------- | -------- |
| First `COMPLETED` | Exactly one `entryKind: "command"` row |
| COMPLETED replay | No append |
| FAILED | No append |
| RECEIVED / PROCESSING / STALE / RETRYING | No append |

## Fields

Frozen TimelineEntry v1 only. Identity comes from the Command Envelope / CommandRecord:

`schemaVersion`, `entryKind=command`, `tenantId`, `correlationId`, `causationId?`, `recordedAt`, `commandId`, `commandName`

Not stored: payload, idempotencyKey, actorId, membershipId, workspaceId, status, responsePayload, domain result.

`tenantId` is the envelope field (`AuthorizationContext.workspaceId` at command construction). `recordedAt` is append wall-clock. **Ordering remains OPEN.** **Dedup remains OPEN** (COMPLETED replay is enough for this slice).

## Persistence

`memory` or local-durable `v2_platform.timeline.json` via existing atomic `jsonTable`. Append-only (no update/delete). Restart reconstructs from the same data dir.

## Timeline append failure

Order is: domain success → `markCompleted` success → Timeline append.

If append fails: command stays **COMPLETED**. Domain is **not** rolled back. Gateway still returns the successful command response. Missing row is a **provenance gap**. No outbox, saga, or retry worker.

## Deferred

Event publishing, event Timeline, Observatory, Timeline query API, ordering, dedup keys, RLS, Postgres, hosted V2.
