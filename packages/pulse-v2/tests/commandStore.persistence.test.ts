import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CommandEnvelope } from "../../contracts/src/command/command-envelope";
import { createCommandStore } from "../src/persistence/commandStore/createCommandStore";
import { CommandStoreError } from "../src/persistence/commandStore/commandStoreError";
import { V2PersistenceError } from "../src/persistence/v2PersistenceError";
import { commandStoreTablePath } from "../src/persistence/durable/jsonTable";

function tmpDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pulse-v2-cmdstore-"));
}

function envelope(overrides: Partial<CommandEnvelope> = {}): CommandEnvelope {
  return {
    commandId: "cmd-1",
    commandName: "CreateSalesOrder",
    commandVersion: "v1",
    schemaVersion: "v1",
    idempotencyKey: "idem-1",
    correlationId: "corr-1",
    tenantId: "tenant-a",
    payload: { id: "so-1" },
    ...overrides,
  };
}

describe.each(["memory", "local-durable"] as const)("Command Store persistence (%s)", (mode) => {
  function store() {
    if (mode === "memory") return { repo: createCommandStore({ mode: "memory" }), dataDir: null };
    const dataDir = tmpDataDir();
    return { repo: createCommandStore({ mode: "local-durable", dataDir }), dataDir };
  }

  it("records and reads a command", () => {
    const { repo } = store();
    const recorded = repo.record(envelope());
    expect(recorded.created).toBe(true);
    expect(recorded.record.status).toBe("RECEIVED");
    expect(recorded.record.tenantId).toBe("tenant-a");
    expect(recorded.record.commandId).toBe("cmd-1");
    expect("workspaceId" in recorded.record).toBe(false);

    const byId = repo.getByCommandId("cmd-1");
    expect(byId?.commandName).toBe("CreateSalesOrder");
    expect(byId?.payload).toEqual({ id: "so-1" });

    const byKey = repo.getByIdempotencyKey("tenant-a", "idem-1");
    expect(byKey?.commandId).toBe("cmd-1");
  });

  it("returns the existing record for the same tenant + idempotencyKey", () => {
    const { repo } = store();
    repo.record(envelope({ commandId: "cmd-1", payload: { id: "first" } }));
    const second = repo.record(
      envelope({ commandId: "cmd-other", payload: { id: "different" } }),
    );
    expect(second.created).toBe(false);
    expect(second.record.commandId).toBe("cmd-1");
    expect(second.record.payload).toEqual({ id: "first" });
    expect(repo.getByCommandId("cmd-other")).toBeNull();
  });

  it("keeps Identity bootstrap keys out of the Command Store key space", () => {
    const { repo } = store();
    repo.record(envelope({ idempotencyKey: "bootstrap-key" }));
    expect(repo.getByIdempotencyKey("tenant-a", "bootstrap-key")?.commandId).toBe("cmd-1");
    expect(repo.getByIdempotencyKey("actor-a:Identity.createWorkspace", "bootstrap-key")).toBeNull();
  });

  it("stores COMPLETED replay data on the command record", () => {
    const { repo } = store();
    repo.record(envelope());
    repo.markProcessing("cmd-1");
    const completed = repo.markCompleted("cmd-1", { data: { orderId: "so-1" }, statusCode: 200 });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.responsePayload).toEqual({ orderId: "so-1" });
    expect(completed.responseCode).toBe(200);
    expect(completed.completedAt).toBeDefined();

    const replay = repo.getByIdempotencyKey("tenant-a", "idem-1");
    expect(replay?.status).toBe("COMPLETED");
    expect(replay?.responsePayload).toEqual({ orderId: "so-1" });
  });

  it("allows documented lifecycle transitions and rejects others", () => {
    const { repo } = store();
    repo.record(envelope());
    expect(() => repo.markCompleted("cmd-1", { data: {} })).toThrow(CommandStoreError);
    expect(() => repo.markCompleted("cmd-1", { data: {} })).toThrow(/RECEIVED → COMPLETED/);

    expect(repo.markProcessing("cmd-1").status).toBe("PROCESSING");
    expect(repo.markStale("cmd-1").status).toBe("STALE");
    expect(repo.markRetrying("cmd-1").status).toBe("RETRYING");
    expect(repo.markFailed("cmd-1").status).toBe("FAILED");
    expect(() => repo.markProcessing("cmd-1")).toThrow(CommandStoreError);
    expect(() => repo.markRetrying("cmd-1")).toThrow(/FAILED → RETRYING/);
  });

  it("PROCESSING can complete or fail", () => {
    const { repo } = store();
    repo.record(envelope({ commandId: "ok", idempotencyKey: "k-ok" }));
    repo.markProcessing("ok");
    expect(repo.markCompleted("ok", { data: { ok: true } }).status).toBe("COMPLETED");

    repo.record(envelope({ commandId: "bad", idempotencyKey: "k-bad" }));
    repo.markProcessing("bad");
    expect(repo.markFailed("bad").status).toBe("FAILED");
  });

  it("fails closed on duplicate commandId", () => {
    const { repo } = store();
    repo.record(envelope({ commandId: "same-id", idempotencyKey: "k-1" }));
    expect(() =>
      repo.record(envelope({ commandId: "same-id", idempotencyKey: "k-2" })),
    ).toThrow(V2PersistenceError);
    expect(repo.getByIdempotencyKey("tenant-a", "k-1")?.status).toBe("RECEIVED");
    expect(repo.getByIdempotencyKey("tenant-a", "k-2")).toBeNull();
  });

  it("returns not found for unknown command ids", () => {
    const { repo } = store();
    expect(repo.getByCommandId("missing")).toBeNull();
    try {
      repo.markProcessing("missing");
      throw new Error("expected not found");
    } catch (err) {
      expect(err).toBeInstanceOf(CommandStoreError);
      expect((err as CommandStoreError).code).toBe("COMMAND_STORE_NOT_FOUND");
    }
  });

  it("isolates idempotency keys by tenantId", () => {
    const { repo } = store();
    repo.record(envelope({ commandId: "cmd-a", tenantId: "tenant-a" }));
    repo.record(envelope({ commandId: "cmd-b", tenantId: "tenant-b" }));
    expect(repo.getByIdempotencyKey("tenant-a", "idem-1")?.commandId).toBe("cmd-a");
    expect(repo.getByIdempotencyKey("tenant-b", "idem-1")?.commandId).toBe("cmd-b");
    expect(repo.getByIdempotencyKey("tenant-a", "idem-1")?.tenantId).toBe("tenant-a");
  });
});

describe("Command Store local-durable specifics", () => {
  it("survives adapter recreation from the same data dir", () => {
    const dataDir = tmpDataDir();
    const first = createCommandStore({ mode: "local-durable", dataDir });
    first.record(envelope());
    first.markProcessing("cmd-1");
    first.markCompleted("cmd-1", { data: { replay: true } });

    const second = createCommandStore({ mode: "local-durable", dataDir });
    const row = second.getByCommandId("cmd-1");
    expect(row?.status).toBe("COMPLETED");
    expect(row?.responsePayload).toEqual({ replay: true });
    expect(fs.existsSync(commandStoreTablePath(dataDir))).toBe(true);
  });

  it("fails closed when a durable write cannot complete", () => {
    const dataDir = tmpDataDir();
    const repo = createCommandStore({ mode: "local-durable", dataDir });
    repo.record(envelope());
    fs.chmodSync(dataDir, 0o555);
    try {
      expect(() => repo.markProcessing("cmd-1")).toThrow(V2PersistenceError);
    } finally {
      fs.chmodSync(dataDir, 0o755);
    }
  });

  it("fails closed when the command store file is invalid JSON", () => {
    const dataDir = tmpDataDir();
    fs.writeFileSync(commandStoreTablePath(dataDir), "{not-json");
    const repo = createCommandStore({ mode: "local-durable", dataDir });
    expect(() => repo.getByCommandId("cmd-1")).toThrow(V2PersistenceError);
  });
});
