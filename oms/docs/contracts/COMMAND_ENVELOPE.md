# Command Envelope (Frozen v1)

**Status:** Frozen — never remove fields; only add optional ones.

All mutating requests enter the platform through the Gateway as a **Command Envelope**. The Command Store persists the full record; `PlatformRuntime.executeCommand()` is the only path business services should use to handle commands.

Related: [EVENT_ENVELOPE.md](./EVENT_ENVELOPE.md) · [TIMELINE_ENTRY.md](./TIMELINE_ENTRY.md) · [PLATFORM_ENTITY_MODEL.md](../PLATFORM_ENTITY_MODEL.md) · TypeScript: `@pulse/contracts`

---

## Shape

```json
{
  "commandId": "550e8400-e29b-41d4-a716-446655440000",
  "commandName": "PublishExecutionPlan",
  "commandVersion": "v1",
  "schemaVersion": "v1",
  "idempotencyKey": "plan-publish-EP-2026-000001",
  "correlationId": "COR-a1b2c3d4",
  "causationId": "EP-2026-000001",
  "tenantId": "TENANT-000001",
  "payload": {}
}
```

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `commandId` | yes | string (UUID) | Assigned by Gateway on first accept |
| `commandName` | yes | string | Stable handler name, e.g. `CreateOrganization` |
| `commandVersion` | yes | string | Handler version, e.g. `v1` |
| `schemaVersion` | yes | string | Payload schema version, e.g. `v1` |
| `idempotencyKey` | yes | string | Unique per tenant + command; replay key |
| `correlationId` | yes | string | Trace ID; Gateway assigns if omitted |
| `causationId` | no | string | Upstream command or entity ID |
| `tenantId` | yes | string | Canonical tenant code — from JWT, never invented |
| `payload` | yes | object | Command-specific body; validated against `schemaVersion` |

---

## Lifecycle (Command Store)

```
RECEIVED → PROCESSING → COMPLETED
                │
         (timeout)
                ▼
              STALE → RETRYING → COMPLETED | FAILED
```

| Status | Meaning |
|--------|---------|
| `RECEIVED` | Persisted; not yet executing |
| `PROCESSING` | Handler running |
| `COMPLETED` | Success; replay returns stored response |
| `STALE` | `PROCESSING` exceeded timeout |
| `RETRYING` | Retry worker claimed |
| `FAILED` | Terminal error |

**Rules:** `(tenant_id, idempotency_key)` unique · `INSERT ON CONFLICT DO NOTHING` · serializable status transitions · stale timeout worker from day one · replay returns stored `response_payload`.

---

## Gateway flow

```
Client → Gateway (build envelope) → Command Store (RECEIVED)
      → Identity validation → Service handler via PlatformRuntime
      → Command Store (COMPLETED) → Timeline entry → Event (optional)
```

No service is directly callable from clients.

---

## Evolution rules

1. **Never remove** a field from v1 envelopes.
2. **Only add** optional fields in new `schemaVersion` values.
3. Breaking payload changes → new `schemaVersion`, not a renamed field.
4. Handler changes → new `commandVersion`; old versions remain replayable.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-29 | v1 frozen |
