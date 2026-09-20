# @pulse/contracts

**Pulse platform kernel** — frozen types every service depends on.

```
packages/contracts/src/
  command/     command-envelope.ts, command-result.ts
  events/      event-envelope.ts, event-catalog.ts
  timeline/    timeline-entry.ts
  identity/    identity.ts, jwt-claims.ts, permissions.ts
  common/      ids, tenant, metadata, pagination, errors, api-response
```

## Rules

- Never remove fields from v1 envelopes
- Only add optional fields in new `schemaVersion` values
- Permissions live here; **not** in JWT payloads

## Docs

- [COMMAND_ENVELOPE.md](../../oms/docs/contracts/COMMAND_ENVELOPE.md)
- [EVENT_ENVELOPE.md](../../oms/docs/contracts/EVENT_ENVELOPE.md)
- [TIMELINE_ENTRY.md](../../oms/docs/contracts/TIMELINE_ENTRY.md)
