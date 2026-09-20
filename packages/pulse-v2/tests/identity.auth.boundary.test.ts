import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import { isTrustedAuthorizationContext } from "../src/identity/authorizationContext";
import { createLocalAuthAdapter } from "../src/identity/localAuthAdapter";
import { createV2IdentityPort } from "../src/identity/v2IdentityPort";
import { createV2Persistence } from "../src/persistence/createPersistence";

const capturedAuthz: unknown[] = [];

jest.mock("../src/domains/commerce/api", () => {
  const actual = jest.requireActual(
    "../src/domains/commerce/api",
  ) as typeof import("../src/domains/commerce/api");
  return {
    handleCommerceOperation: (
      store: Parameters<typeof actual.handleCommerceOperation>[0],
      execute: Parameters<typeof actual.handleCommerceOperation>[1],
      operation: string,
      payload: Record<string, unknown>,
      authz: Parameters<typeof actual.handleCommerceOperation>[4],
    ) => {
      capturedAuthz.push(authz);
      return actual.handleCommerceOperation(store, execute, operation, payload, authz);
    },
  };
});

function tmpDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "pulse-v2-identity-"));
}

function durableConfig(dataDir: string) {
  return {
    mode: "local-durable" as const,
    supabaseUrl: null,
    anonKey: null,
    serviceRoleKey: null,
    hostedProjectRef: null,
    dataDir,
  };
}

describe("V2 Identity/Auth (Model B, local)", () => {
  beforeEach(() => {
    capturedAuthz.length = 0;
  });

  it("maps a known Auth Subject to an Actor and reuses it", () => {
    const dataDir = tmpDataDir();
    const auth = createLocalAuthAdapter({
      enrolled: [{ proof: "opaque-s1", subjectId: "sub-1" }],
    });
    const first = createV2IdentityPort({
      auth,
      repository: createV2Persistence(durableConfig(dataDir)).identity,
    });
    const a1 = first.resolveActor({ value: "opaque-s1" });
    expect(a1.ok).toBe(true);
    if (!a1.ok) return;
    const second = createV2IdentityPort({
      auth,
      repository: createV2Persistence(durableConfig(dataDir)).identity,
    });
    const a2 = second.resolveActor({ value: "opaque-s1" });
    expect(a2).toEqual({ ok: true, actorId: a1.actorId });
    expect(a1.actorId).not.toBe("opaque-s1");
    expect(a1.actorId).not.toBe("sub-1");
  });

  it("creates a new Actor for a new Auth Subject", () => {
    const auth = createLocalAuthAdapter({
      enrolled: [
        { proof: "opaque-s1", subjectId: "sub-1" },
        { proof: "opaque-s2", subjectId: "sub-2" },
      ],
    });
    const port = createV2IdentityPort({
      auth,
      repository: createV2Persistence(durableConfig(tmpDataDir())).identity,
    });
    const a1 = port.resolveActor({ value: "opaque-s1" });
    const a2 = port.resolveActor({ value: "opaque-s2" });
    expect(a1.ok && a2.ok).toBe(true);
    if (!a1.ok || !a2.ok) return;
    expect(a1.actorId).not.toBe(a2.actorId);
  });

  it("does not treat actorId or workspaceId as authentication proof", () => {
    const port = createV2IdentityPort({
      auth: createLocalAuthAdapter({ enrolled: [{ proof: "opaque-s1", subjectId: "sub-1" }] }),
      repository: createV2Persistence(durableConfig(tmpDataDir())).identity,
    });
    const created = port.resolveActor({ value: "opaque-s1" });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(port.resolveActor({ value: created.actorId }).ok).toBe(false);
    expect(port.resolveActor({ value: "ws-forged" }).ok).toBe(false);
  });

  it("denies data-plane without Membership, then bootstrap creates Workspace + Membership", () => {
    const dataDir = tmpDataDir();
    const auth = createLocalAuthAdapter({
      enrolled: [{ proof: "opaque-s1", subjectId: "sub-1" }],
    });
    const identityPort = createV2IdentityPort({
      auth,
      repository: createV2Persistence(durableConfig(dataDir)).identity,
    });
    const { execute, createWorkspace } = createPulseV2Gateway(
      { PULSE_V2_SUPABASE_URL: "", PULSE_V2_DATA_DIR: dataDir },
      { identityPort },
    );
    const denied = execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: "opaque-s1",
      payload: { id: "missing" },
      correlationId: "c-no-mem",
    });
    expect(denied.ok).toBe(false);
    if (denied.ok) return;
    expect(denied.code).toBe("V2_MEMBERSHIP_DENIED");

    const created = createWorkspace({
      identityProof: "opaque-s1",
      correlationId: "c-boot",
      idempotencyKey: "key-1",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.membershipStatus).toBe("active");

    const replay = createWorkspace({
      identityProof: "opaque-s1",
      correlationId: "c-boot-2",
      idempotencyKey: "key-1",
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.workspaceId).toBe(created.workspaceId);
    expect(replay.membershipId).toBe(created.membershipId);

    const other = createWorkspace({
      identityProof: "opaque-s1",
      correlationId: "c-boot-3",
      idempotencyKey: "key-2",
    });
    expect(other.ok).toBe(true);
    if (!other.ok) return;
    expect(other.workspaceId).not.toBe(created.workspaceId);
  });

  it("suspended and revoked memberships are denied", () => {
    const dataDir = tmpDataDir();
    const persistence = createV2Persistence(durableConfig(dataDir));
    const auth = createLocalAuthAdapter({
      enrolled: [{ proof: "opaque-s1", subjectId: "sub-1" }],
    });
    const identityPort = createV2IdentityPort({ auth, repository: persistence.identity });
    const actor = identityPort.resolveActor({ value: "opaque-s1" });
    expect(actor.ok).toBe(true);
    if (!actor.ok) return;
    persistence.identity.insertWorkspace("ws-sus");
    persistence.identity.insertMembership({
      membershipId: "mem-sus",
      actorId: actor.actorId,
      workspaceId: "ws-sus",
      status: "suspended",
      role: "unspecified",
    });
    const inactive = identityPort.resolveMembership({ actorId: actor.actorId });
    expect(inactive.ok).toBe(false);
    if (inactive.ok) return;
    expect(inactive.reason).toBe("inactive");

    persistence.identity.insertWorkspace("ws-rev");
    persistence.identity.insertMembership({
      membershipId: "mem-rev",
      actorId: actor.actorId,
      workspaceId: "ws-rev",
      status: "revoked",
      role: "unspecified",
    });
    const revoked = identityPort.resolveMembership({
      actorId: actor.actorId,
      membershipId: "mem-rev",
    });
    expect(revoked.ok).toBe(false);
    if (revoked.ok) return;
    expect(revoked.reason).toBe("inactive");
  });

  it("missing membership is denied", () => {
    const identityPort = createV2IdentityPort({
      auth: createLocalAuthAdapter({ enrolled: [{ proof: "opaque-s1", subjectId: "sub-1" }] }),
      repository: createV2Persistence(durableConfig(tmpDataDir())).identity,
    });
    const actor = identityPort.resolveActor({ value: "opaque-s1" });
    expect(actor.ok).toBe(true);
    if (!actor.ok) return;
    expect(identityPort.resolveMembership({ actorId: actor.actorId })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("caller actorId and payload workspaceId remain non-authoritative", () => {
    const dataDir = tmpDataDir();
    const auth = createLocalAuthAdapter({
      enrolled: [{ proof: "opaque-s1", subjectId: "sub-1" }],
    });
    const identityPort = createV2IdentityPort({
      auth,
      repository: createV2Persistence(durableConfig(dataDir)).identity,
    });
    const { execute, createWorkspace } = createPulseV2Gateway(
      { PULSE_V2_SUPABASE_URL: "", PULSE_V2_DATA_DIR: dataDir },
      { identityPort },
    );
    const boot = createWorkspace({
      identityProof: "opaque-s1",
      correlationId: "c-authz",
      idempotencyKey: "k-authz",
    });
    expect(boot.ok).toBe(true);
    if (!boot.ok) return;

    const spoofActor = execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: "opaque-s1",
      actorId: "forged-actor",
      payload: { id: "x" },
      correlationId: "c-actor-spoof",
    });
    expect(spoofActor.ok).toBe(false);
    if (spoofActor.ok) return;
    expect(spoofActor.code).toBe("V2_ACTOR_DENIED");

    const spoofWs = execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: "opaque-s1",
      payload: { id: "x", workspaceId: "other-ws" },
      correlationId: "c-ws-spoof",
    });
    expect(spoofWs.ok).toBe(false);
    if (spoofWs.ok) return;
    expect(spoofWs.code).toBe("V2_WORKSPACE_DENIED");
  });

  it("domains receive a sealed AuthorizationContext from Actor → Membership → Workspace", () => {
    const dataDir = tmpDataDir();
    const auth = createLocalAuthAdapter({
      enrolled: [{ proof: "opaque-s1", subjectId: "sub-1" }],
    });
    const identityPort = createV2IdentityPort({
      auth,
      repository: createV2Persistence(durableConfig(dataDir)).identity,
    });
    const { execute, createWorkspace } = createPulseV2Gateway(
      { PULSE_V2_SUPABASE_URL: "", PULSE_V2_DATA_DIR: dataDir },
      { identityPort },
    );
    const boot = createWorkspace({
      identityProof: "opaque-s1",
      correlationId: "c-seal",
      idempotencyKey: "k-seal",
    });
    expect(boot.ok).toBe(true);
    if (!boot.ok) return;
    execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: "opaque-s1",
      payload: { id: "missing" },
      correlationId: "c-seal-exec",
    });
    const ctx = capturedAuthz[capturedAuthz.length - 1];
    expect(isTrustedAuthorizationContext(ctx as never)).toBe(true);
    expect(ctx).toEqual(
      expect.objectContaining({
        actorId: boot.actorId,
        membershipId: boot.membershipId,
        workspaceId: boot.workspaceId,
        correlationId: "c-seal-exec",
      }),
    );
  });

  it("does not leak Workspace A commerce data to Workspace B", () => {
    const dataDir = tmpDataDir();
    const auth = createLocalAuthAdapter({
      enrolled: [
        { proof: "opaque-a", subjectId: "sub-a" },
        { proof: "opaque-b", subjectId: "sub-b" },
      ],
    });
    const identityPort = createV2IdentityPort({
      auth,
      repository: createV2Persistence(durableConfig(dataDir)).identity,
    });
    const { execute, createWorkspace } = createPulseV2Gateway(
      { PULSE_V2_SUPABASE_URL: "", PULSE_V2_DATA_DIR: dataDir },
      { identityPort },
    );
    const a = createWorkspace({
      identityProof: "opaque-a",
      correlationId: "c-a",
      idempotencyKey: "k-a",
    });
    const b = createWorkspace({
      identityProof: "opaque-b",
      correlationId: "c-b",
      idempotencyKey: "k-b",
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const placed = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "opaque-a",
      payload: { id: "so-a-only" },
      correlationId: "c-place",
    });
    expect(placed.ok).toBe(true);
    const leaked = execute({
      domain: "commerce",
      operation: "getOrder",
      identityProof: "opaque-b",
      payload: { id: "so-a-only" },
      correlationId: "c-leak",
    });
    expect(leaked.ok).toBe(false);
    if (leaked.ok) return;
    expect(leaked.code).toBe("COMMERCE_NOT_FOUND");
  });
});
