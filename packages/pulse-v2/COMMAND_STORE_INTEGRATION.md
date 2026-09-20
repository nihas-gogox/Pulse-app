# Command Store ↔ Gateway / Runtime (V2)

**Status:** Gateway integration COMPLETE. Command Timeline is wired after `COMPLETED` (see `TIMELINE_RUNTIME.md`). Event publishing is **DEFERRED** (`EVENT_ARCHITECTURE.md`).

## Commands vs queries

| Kind | Operations | Command Store |
| ---- | ---------- | ------------- |
| Command | `createOrder`, `createTripFromOrder` | Yes — one CommandEnvelope / CommandRecord per **public** `execute()` |
| Query | `getOrder`, `getTrip`, `getTripByOrderId` | No |

`createWorkspace` remains Identity bootstrap. It is **not** Command Envelope v1 and does **not** use Command Store.

`CommandEnvelope.commandName` is domain-qualified: `${domain}.${operation}` — `commerce.createOrder`, `execution.createTripFromOrder`. Never the bare Gateway `operation` string.

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

COMPLETED → return stored `CommandResult.data` (the V2 Gateway success response). Domain is not executed again. Timeline is not appended again.

FAILED → `V2_COMMAND_FAILED`; no domain retry.

PROCESSING / STALE / RETRYING → `V2_COMMAND_IN_PROGRESS`.

`idempotencyKey` is caller-supplied and required on commands. Distinct from Identity `createWorkspace` keys.

## Lifecycle

New command: RECEIVED → PROCESSING → COMPLETED | FAILED.

RECEIVED persist failure: no domain. `markCompleted` failure: do not return `ok: true`.

After first `COMPLETED`, PlatformRuntime appends one command Timeline entry. Timeline failure does not un-complete the command.

## Not in this slice

Event publishing / Event Timeline (deferred — `EVENT_ARCHITECTURE.md`), Observatory, RLS, Postgres, hosted V2.
