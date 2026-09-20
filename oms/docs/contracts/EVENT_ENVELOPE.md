# Event Envelope (Frozen v1)

**Status:** Frozen — never remove fields; only add optional ones.

Domain events propagate state between services. Each event also produces one **append-only** Platform Timeline entry (written by Gateway / Platform Runtime — never by business services directly).

Related: [COMMAND_ENVELOPE.md](./COMMAND_ENVELOPE.md) · [TIMELINE_ENTRY.md](./TIMELINE_ENTRY.md) · TypeScript: `@pulse/contracts`

---

## Shape

```json
{
  "eventId": "660e8400-e29b-41d4-a716-446655440001",
  "eventName": "ExecutionPlanPublished",
  "eventVersion": "v1",
  "schemaVersion": "v1",
  "occurredAt": "2026-06-29T12:00:00.000Z",
  "tenantId": "TENANT-000001",
  "correlationId": "COR-a1b2c3d4",
  "causationId": "EP-2026-000001",
  "parentEventId": "660e8400-e29b-41d4-a716-446655440000",
  "payload": {}
}
```

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `eventId` | yes | string (UUID) | Unique event instance |
| `eventName` | yes | string | Catalog name, e.g. `IndentCreated` |
| `eventVersion` | yes | string | Semantics version, e.g. `v1` |
| `schemaVersion` | yes | string | Payload schema version |
| `occurredAt` | yes | string (ISO 8601) | When the fact occurred |
| `tenantId` | yes | string | Canonical tenant code |
| `correlationId` | yes | string | Same trace as originating command |
| `causationId` | no | string | Direct cause (command or entity ID) |
| `parentEventId` | no | string | Graph parent — may differ from `causationId` |
| `payload` | yes | object | Event-specific body |

---

## Timeline rule

Every successful command → **one** timeline entry.  
Every published event → **one** timeline entry.

Timeline is append-only: **never update, never delete.**

Observatory reads Timeline projections — not in-memory logs.

---

## Graph projection

`parentEventId` forms a DAG. Project at read time (recursive CTE). No separate edge tables.

---

## Evolution rules

1. **Never remove** a field from v1 envelopes.
2. **Only add** optional fields in new `schemaVersion` values.
3. New event semantics → new `eventVersion`; consumers subscribe by name + version.
4. `causationId` ≠ `parentEventId` when graph parent differs from direct cause.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-29 | v1 frozen — `parentEventId` included |
