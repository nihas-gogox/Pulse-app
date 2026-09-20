# Timeline Entry (Frozen v1)

**Status:** Frozen — never remove fields; only add optional ones in a new `schemaVersion`.

Platform Timeline is an **append-only, domain-neutral provenance log**.

Related: [COMMAND_ENVELOPE.md](./COMMAND_ENVELOPE.md) · [EVENT_ENVELOPE.md](./EVENT_ENVELOPE.md) · TypeScript: `@pulse/contracts` `TimelineEntry`

---

## Distinctions (do not collapse)

| Concept | Owns | Mutable? |
| ------- | ---- | -------- |
| **Command Store** | Command execution records (`CommandRecord`), lifecycle `RECEIVED → PROCESSING → COMPLETED \| FAILED \| STALE`, idempotency | Yes (status) |
| **Event** | Domain/platform facts (`EventEnvelope`) | N/A (published fact) |
| **Timeline entry** | Provenance that a successful command or published event occurred | **No** — append only |
| **Domain history** | Product-specific traces (e.g. `getTripTimeline`) | Domain-owned; **not** Timeline |

Timeline is **not** the Command Store, **not** the Event Store, and **not** a replacement for domain history.

---

## Rules

1. One Timeline entry per **successful** command.
2. One Timeline entry per **published** event.
3. Never update. Never delete.
4. Future writers: Gateway / PlatformRuntime only.
5. Observatory later reads Timeline projections — not in-memory logs.
6. No command lifecycle fields (`status`, `RECEIVED`, `responsePayload`, …).
7. No event `payload` on the Timeline row.

---

## Shape

### Command-originated

```json
{
  "schemaVersion": "v1",
  "entryKind": "command",
  "tenantId": "TENANT-000001",
  "correlationId": "COR-a1b2c3d4",
  "causationId": "EP-2026-000001",
  "recordedAt": "2026-09-21T00:00:01.000Z",
  "commandId": "550e8400-e29b-41d4-a716-446655440000",
  "commandName": "PublishExecutionPlan"
}
```

### Event-originated

```json
{
  "schemaVersion": "v1",
  "entryKind": "event",
  "tenantId": "TENANT-000001",
  "correlationId": "COR-a1b2c3d4",
  "causationId": "550e8400-e29b-41d4-a716-446655440000",
  "recordedAt": "2026-09-21T00:00:02.000Z",
  "eventId": "660e8400-e29b-41d4-a716-446655440001",
  "eventName": "ExecutionPlanPublished",
  "occurredAt": "2026-06-29T12:00:00.000Z",
  "parentEventId": "660e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Required | Applies to | Notes |
| ----- | -------- | ---------- | ----- |
| `schemaVersion` | yes | both | Timeline contract version (`v1`) |
| `entryKind` | yes | both | Discriminator: `command` \| `event` |
| `tenantId` | yes | both | Same field as Command/Event Envelope v1 |
| `correlationId` | yes | both | Same trace as originating command/event |
| `causationId` | no | both | Same optional field as envelopes |
| `recordedAt` | yes | both | Append wall-clock. **Not** an ordering guarantee |
| `commandId` | yes | command | Command Envelope `commandId` |
| `commandName` | yes | command | Command Envelope `commandName` (operation identity) |
| `eventId` | yes | event | Event Envelope `eventId` |
| `eventName` | yes | event | Event Envelope `eventName` |
| `occurredAt` | yes | event | Event Envelope `occurredAt` |
| `parentEventId` | no | event | Event Envelope `parentEventId` |

---

## Explicitly unresolved (OPEN)

Do **not** treat the following as frozen by this contract:

| Topic | Status |
| ----- | ------ |
| `AuthorizationContext.workspaceId` → envelope `tenantId` | OPEN — not decided here |
| `actorId` / `membershipId` on Timeline or envelopes | OPEN — not Timeline fields; not added to Command/Event Envelope v1 |
| Timeline **ordering** (sequence, timestamp order, partition) | OPEN — UNSPECIFIED |
| Timeline **deduplication** key | OPEN — UNSPECIFIED; `commandId` / `eventId` / `correlationId` are **not** declared a dedup key here |
| Copying envelope `payload` onto Timeline | **Out of scope** — Timeline is not Command Store or Event Store |
| Runtime writer / persistence / Observatory | **Not this contract** |

---

## Evolution rules

1. Never remove a field from v1.
2. Only add optional fields in a new `schemaVersion`.
3. Do not add Command Store lifecycle or Event Store payload to this type.

---

## Changelog

| Date | Change |
| ---- | ------ |
| 2026-09-21 | v1 frozen |
