import type {
  TimelineCommandEntry,
  TimelineEntry,
  TimelineEventEntry,
} from "../../contracts/src/timeline/timeline-entry";
import { TIMELINE_ENTRY_SCHEMA_VERSION } from "../../contracts/src/timeline/timeline-entry";

describe("TimelineEntry contract (frozen v1)", () => {
  const command: TimelineCommandEntry = {
    schemaVersion: "v1",
    entryKind: "command",
    tenantId: "TENANT-000001",
    correlationId: "corr-1",
    causationId: "cause-1",
    recordedAt: "2026-09-21T00:00:01.000Z",
    commandId: "cmd-1",
    commandName: "CreateOrder",
  };

  const event: TimelineEventEntry = {
    schemaVersion: "v1",
    entryKind: "event",
    tenantId: "TENANT-000001",
    correlationId: "corr-1",
    causationId: "cmd-1",
    recordedAt: "2026-09-21T00:00:02.000Z",
    eventId: "evt-1",
    eventName: "OrderCreated",
    occurredAt: "2026-09-21T00:00:00.000Z",
    parentEventId: "evt-parent",
  };

  it("freezes schemaVersion at v1", () => {
    expect(TIMELINE_ENTRY_SCHEMA_VERSION).toBe("v1");
    expect(command.schemaVersion).toBe("v1");
  });

  it("discriminates command vs event provenance", () => {
    const entries: TimelineEntry[] = [command, event];
    expect(entries.map((e) => e.entryKind)).toEqual(["command", "event"]);
    expect(command.commandId).toBe("cmd-1");
    expect(command.commandName).toBe("CreateOrder");
    expect(event.eventId).toBe("evt-1");
    expect(event.eventName).toBe("OrderCreated");
    expect(event.occurredAt).toBe("2026-09-21T00:00:00.000Z");
  });

  it("is not Command Store (no lifecycle) and not Event Store (no payload)", () => {
    expect("status" in command).toBe(false);
    expect("idempotencyKey" in command).toBe(false);
    expect("responsePayload" in command).toBe(false);
    expect("payload" in command).toBe(false);
    expect("payload" in event).toBe(false);
  });

  it("does not invent workspace, actor, membership, ordering, or dedup fields", () => {
    for (const row of [command, event] as TimelineEntry[]) {
      expect("workspaceId" in row).toBe(false);
      expect("actorId" in row).toBe(false);
      expect("membershipId" in row).toBe(false);
      expect("sequence" in row).toBe(false);
      expect("sequenceNumber" in row).toBe(false);
      expect("dedupKey" in row).toBe(false);
    }
  });

  it("uses envelope tenantId / correlationId / causationId", () => {
    expect(command.tenantId).toBe("TENANT-000001");
    expect(command.correlationId).toBe("corr-1");
    expect(command.causationId).toBe("cause-1");
    expect(event.tenantId).toBe("TENANT-000001");
  });
});
