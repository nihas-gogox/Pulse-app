import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import type { V2CreateWorkspaceRequest } from "../src/gateway/types";
import type {
  CreateWorkspaceInput,
  CreateWorkspaceResult,
  IdentityPort,
  IdentityProof,
  MembershipResolveInput,
  MembershipResolveResult,
} from "../src/identity/identityPort";
import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";

function spyIdentityPort(input: {
  actorId: string;
  proof: string;
  createResult?: CreateWorkspaceResult;
}): {
  port: IdentityPort;
  createCalls: CreateWorkspaceInput[];
  membershipCalls: number;
} {
  const createCalls: CreateWorkspaceInput[] = [];
  let membershipCalls = 0;
  const port: IdentityPort = {
    resolveActor(proof: IdentityProof) {
      const value = proof.value.trim();
      if (!value) return { ok: false, reason: "unauthenticated" };
      if (value !== input.proof) return { ok: false, reason: "not_found" };
      return { ok: true, actorId: input.actorId };
    },
    resolveMembership(_membershipInput: MembershipResolveInput): MembershipResolveResult {
      membershipCalls += 1;
      return { ok: false, reason: "not_found" };
    },
    createWorkspace(createInput: CreateWorkspaceInput): CreateWorkspaceResult {
      createCalls.push(createInput);
      return input.createResult ?? { ok: false, reason: "not_implemented" };
    },
  };
  return {
    port,
    createCalls,
    get membershipCalls() {
      return membershipCalls;
    },
  };
}

describe("Gateway createWorkspace wiring", () => {
  const request: V2CreateWorkspaceRequest = {
    identityProof: "opaque-proof-A",
    correlationId: "corr-bootstrap",
    idempotencyKey: "idem-bootstrap",
  };

  it("passes trusted Actor from resolveActor, not the proof string", () => {
    const spy = spyIdentityPort({ actorId: "actor-A", proof: "opaque-proof-A" });
    const { createWorkspace } = createPulseV2Gateway(
      { PULSE_V2_SUPABASE_URL: "" },
      { identityPort: spy.port },
    );

    createWorkspace(request);

    expect(spy.createCalls).toEqual([
      {
        actorId: "actor-A",
        correlationId: "corr-bootstrap",
        idempotencyKey: "idem-bootstrap",
      },
    ]);
    expect(spy.createCalls[0]?.actorId).not.toBe("opaque-proof-A");
  });

  it("does not accept actorId as a public request field", () => {
    const keys = Object.keys(request).sort();
    expect(keys).toEqual(["correlationId", "idempotencyKey", "identityProof"]);
    expect("actorId" in request).toBe(false);
    expect("workspaceId" in request).toBe(false);
    expect("membershipId" in request).toBe(false);
  });

  it("fails closed without createWorkspace or resolveMembership when Actor resolution fails", () => {
    const spy = spyIdentityPort({ actorId: "actor-A", proof: "opaque-proof-A" });
    const { createWorkspace } = createPulseV2Gateway(
      { PULSE_V2_SUPABASE_URL: "" },
      { identityPort: spy.port },
    );

    const result = createWorkspace({
      ...request,
      identityProof: "unknown-proof",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("V2_UNAUTHENTICATED");
      expect(result.correlationId).toBe("corr-bootstrap");
    }
    expect(spy.createCalls).toEqual([]);
    expect(spy.membershipCalls).toBe(0);
  });

  it("does not call resolveMembership after a trusted Actor is resolved", () => {
    const spy = spyIdentityPort({ actorId: "actor-A", proof: "opaque-proof-A" });
    const { createWorkspace } = createPulseV2Gateway(
      { PULSE_V2_SUPABASE_URL: "" },
      { identityPort: spy.port },
    );

    createWorkspace(request);

    expect(spy.createCalls).toHaveLength(1);
    expect(spy.membershipCalls).toBe(0);
  });

  it("forwards correlationId and idempotencyKey unchanged", () => {
    const spy = spyIdentityPort({ actorId: "actor-A", proof: "opaque-proof-A" });
    const { createWorkspace } = createPulseV2Gateway(
      { PULSE_V2_SUPABASE_URL: "" },
      { identityPort: spy.port },
    );

    createWorkspace({
      identityProof: "opaque-proof-A",
      correlationId: " corr-exact ",
      idempotencyKey: " idem-exact ",
    });

    expect(spy.createCalls[0]).toEqual({
      actorId: "actor-A",
      correlationId: "corr-exact",
      idempotencyKey: "idem-exact",
    });
  });

  it("does not manufacture success when Identity returns not_implemented", () => {
    const spy = spyIdentityPort({
      actorId: "actor-A",
      proof: "opaque-proof-A",
      createResult: { ok: false, reason: "not_implemented" },
    });
    const { createWorkspace } = createPulseV2Gateway(
      { PULSE_V2_SUPABASE_URL: "" },
      { identityPort: spy.port },
    );

    const result = createWorkspace(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("V2_WORKSPACE_CREATE_FAILED");
      expect(result.message).toContain("not_implemented");
    }
  });

  it("MemoryIdentityPort path remains not_implemented", () => {
    const identityPort = createMemoryIdentityPort({
      actorProofs: [{ proof: "opaque-proof-A", actorId: "actor-A" }],
      memberships: [],
    });
    const { createWorkspace } = createPulseV2Gateway(
      { PULSE_V2_SUPABASE_URL: "" },
      { identityPort },
    );

    const result = createWorkspace(request);

    expect(identityPort.createWorkspace({
      actorId: "actor-A",
      correlationId: "c",
      idempotencyKey: "k",
    })).toEqual({ ok: false, reason: "not_implemented" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("V2_WORKSPACE_CREATE_FAILED");
    }
  });
});
