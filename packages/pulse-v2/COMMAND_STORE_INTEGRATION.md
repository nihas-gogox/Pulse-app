# Command Store ↔ Gateway / Runtime (V2)

**Status:** Gateway integration COMPLETE. Timeline **not wired**. Event publishing **not implemented**.

## Commands vs queries

| Kind | Operations | Command Store |
| ---- | ---------- | ------------- |
| Command | `createOrder`, `createTripFromOrder` | Yes — one CommandEnvelope / CommandRecord per **public** `execute()` |
| Query | `getOrder`, `getTrip`, `getTripByOrderId` | No |

`createWorkspace` remains Identity bootstrap. It is **not** Command Envelope v1 and does **not** use Command Store.

## Tenancy

```text
AuthorizationContext.workspaceId → CommandEnvelope.tenantId
```

Caller `payload.workspaceId`, `request.actorId`, and any payload `tenantId` are not authority.

## Nested Commerce → Execution

Public `createOrder` is **one** command. Internal `createTripFromOrder` uses existing nested `dispatch` with the same sealed AuthorizationContext. It does **not** create a second CommandRecord or commandId.

Public `createTripFromOrder` (client `execute()`) is its own single command.

## Replay

`(tenantId, idempotencyKey)` — tenantId is trusted workspace id.

COMPLETED → return stored `CommandResult.data` (the V2 Gateway success response). Domain is not executed again.

FAILED → `V2_COMMAND_FAILED`; no domain retry.

PROCESSING / STALE / RETRYING → `V2_COMMAND_IN_PROGRESS`.

If `idempotencyKey` is omitted on a command, Gateway assigns `idem-${commandId}` (one-shot). Distinct from Identity `createWorkspace` keys.

## Lifecycle

New command: RECEIVED → PROCESSING → COMPLETED | FAILED.

RECEIVED persist failure: no domain. `markCompleted` failure: do not return `ok: true`.

## Not in this slice

Timeline append, Timeline persistence, Observatory, Event Envelope publishing, RLS, Postgres, hosted V2.
