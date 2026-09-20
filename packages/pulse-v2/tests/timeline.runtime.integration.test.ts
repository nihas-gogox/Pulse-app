import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";
import { createTimeline } from "../src/persistence/timeline/createTimeline";
import { V2PersistenceError } from "../src/persistence/v2PersistenceError";
import { timelineTablePath } from "../src/persistence/durable/jsonTable";
import type { TimelineRepository } from "../src/runtime/timelinePort";
import type { MembershipRecord } from "../src/identity/identityPort";
import { TIMELINE_ENTRY_SCHEMA_VERSION } from "../../contracts/src/timeline/timeline-entry";

function tmpDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pulse-v2-tl-"));
}

const membershipA: MembershipRecord = {
  membershipId: "mem-a",
  actorId: "actor-a",
  workspaceId: "ws-a",
  status: "active",
  role: "unspecified",
};

function identityA() {
  return createMemoryIdentityPort({
    actorProofs: [{ proof: "proof-a", actorId: "actor-a" }],
    memberships: [membershipA],
  });
}

describe("Command Timeline runtime", () => {
  function gw(extra?: { timeline?: TimelineRepository; env?: NodeJS.Dict<string> }) {
    return createPulseV2Gateway(
      extra?.env ?? { PULSE_V2_SUPABASE_URL: "" },
      { identityPort: identityA(), timeline: extra?.timeline },
    );
  }

  it("successful createOrder COMPLETED writes exactly one command Timeline entry", () => {
    const { execute, commandStore, timeline } = gw();
    const placed = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-tl-1",
      payload: { id: "so-tl-1" },
      correlationId: "c-tl-1",
    });
    expect(placed.ok).toBe(true);
    const record = commandStore.getByIdempotencyKey("ws-a", "k-tl-1");
    expect(record?.status).toBe("COMPLETED");
    const rows = timeline.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        schemaVersion: TIMELINE_ENTRY_SCHEMA_VERSION,
        entryKind: "command",
        tenantId: "ws-a",
        commandId: record?.commandId,
        commandName: "commerce.createOrder",
        correlationId: "c-tl-1",
      }),
    );
    expect(typeof rows[0] && rows[0]?.entryKind === "command" && rows[0].recordedAt).toBeTruthy();
    expect("payload" in rows[0]!).toBe(false);
    expect("idempotencyKey" in rows[0]!).toBe(false);
    expect("workspaceId" in rows[0]!).toBe(false);
    expect("actorId" in rows[0]!).toBe(false);
  });

  it("COMPLETED replay does not append a second Timeline entry", () => {
    const { execute, timeline } = gw();
    execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-tl-replay",
      payload: { id: "so-tl-replay" },
      correlationId: "c-tl-replay-1",
    });
    expect(timeline.list()).toHaveLength(1);
    const second = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-tl-replay",
      payload: { id: "so-ignored" },
      correlationId: "c-tl-replay-2",
    });
    expect(second.ok).toBe(true);
    expect(timeline.list()).toHaveLength(1);
  });

  it("public createTripFromOrder writes one Timeline entry named execution.createTripFromOrder", () => {
    const { execute, timeline } = gw();
    execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-tl-setup",
      payload: { id: "so-tl-trip" },
      correlationId: "c-tl-setup",
    });
    expect(timeline.list()).toHaveLength(1);
    const trip = execute({
      domain: "execution",
      operation: "createTripFromOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-tl-trip",
      payload: { orderId: "so-tl-trip" },
      correlationId: "c-tl-trip",
    });
    expect(trip.ok).toBe(true);
    expect(timeline.list()).toHaveLength(2);
    const names = timeline.list().map((row) => (row.entryKind === "command" ? row.commandName : ""));
    expect(names).toEqual(["commerce.createOrder", "execution.createTripFromOrder"]);
  });

  it("FAILED command does not append Timeline", () => {
    const { execute, commandStore, timeline } = gw();
    const bad = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-tl-fail",
      payload: {},
      correlationId: "c-tl-fail",
    });
    expect(bad.ok).toBe(false);
    expect(commandStore.getByIdempotencyKey("ws-a", "k-tl-fail")?.status).toBe("FAILED");
    expect(timeline.list()).toHaveLength(0);
  });

  it("nested createOrder writes one CommandRecord and one Timeline entry", () => {
    const { execute, commandStore, timeline } = gw();
    const placed = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-tl-nested",
      payload: { id: "so-tl-nested" },
      correlationId: "c-tl-nested",
    });
    expect(placed.ok).toBe(true);
    expect(commandStore.getByIdempotencyKey("ws-a", "k-tl-nested")?.commandName).toBe(
      "commerce.createOrder",
    );
    expect(timeline.list()).toHaveLength(1);
    expect(timeline.list()[0]?.entryKind === "command" && timeline.list()[0].commandName).toBe(
      "commerce.createOrder",
    );
  });

  it("queries do not write Timeline", () => {
    const { execute, timeline } = gw();
    execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-tl-q",
      payload: { id: "so-tl-q" },
      correlationId: "c-tl-q",
    });
    expect(timeline.list()).toHaveLength(1);
    execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: "proof-a",
      payload: { id: "so-tl-q" },
      correlationId: "c-get-o",
    });
    execute({
      domain: "execution",
      operation: "getTrip",
      identityProof: "proof-a",
      payload: { id: "trip-so-tl-q" },
      correlationId: "c-get-t",
    });
    execute({
      domain: "execution",
      operation: "getTripByOrderId",
      identityProof: "proof-a",
      payload: { orderId: "so-tl-q" },
      correlationId: "c-get-by",
    });
    expect(timeline.list()).toHaveLength(1);
  });

  it("local-durable Timeline survives repository reconstruction", () => {
    const dataDir = tmpDataDir();
    const first = gw({ env: { PULSE_V2_SUPABASE_URL: "", PULSE_V2_DATA_DIR: dataDir } });
    const placed = first.execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-tl-dur",
      payload: { id: "so-tl-dur" },
      correlationId: "c-tl-dur",
    });
    expect(placed.ok).toBe(true);
    expect(fs.existsSync(timelineTablePath(dataDir))).toBe(true);
    const restarted = createTimeline({ mode: "local-durable", dataDir });
    const rows = restarted.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.entryKind).toBe("command");
    expect(rows[0] && rows[0].entryKind === "command" && rows[0].commandName).toBe(
      "commerce.createOrder",
    );
  });

  it("Timeline append failure leaves COMPLETED command and domain data", () => {
    const failing: TimelineRepository = {
      appendCommand() {
        throw new V2PersistenceError("Failed to write durable table", { kind: "io" });
      },
      list() {
        return [];
      },
    };
    const { execute, commandStore } = gw({ timeline: failing });
    const placed = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      idempotencyKey: "k-tl-gap",
      payload: { id: "so-tl-gap" },
      correlationId: "c-tl-gap",
    });
    expect(placed.ok).toBe(true);
    expect(commandStore.getByIdempotencyKey("ws-a", "k-tl-gap")?.status).toBe("COMPLETED");
    const order = execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: "proof-a",
      payload: { id: "so-tl-gap" },
      correlationId: "c-tl-gap-read",
    });
    expect(order.ok).toBe(true);
    expect(failing.list()).toHaveLength(0);
  });
});
