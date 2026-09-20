# @pulse/platform-timeline

**Sprint 4** — Append-only. Never update. Never delete.

Frozen contract: [`TimelineEntry` v1](../../oms/docs/contracts/TIMELINE_ENTRY.md) (`@pulse/contracts`).

- One timeline entry per **successful** command (`entryKind: "command"`)
- One timeline entry per **published** event (`entryKind: "event"`)

Only Gateway / PlatformRuntime writes rows (not implemented in this package).

Timeline is **not** Command Store, **not** Event Store, **not** domain history (`getTripTimeline`).

**OPEN (not decided by the frozen contract):** ordering, deduplication, `workspaceId`↔`tenantId` mapping, actor/membership stamping.

**This package is README-only.** No repository, persistence, or writer.
