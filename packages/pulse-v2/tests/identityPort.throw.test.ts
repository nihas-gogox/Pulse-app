jest.mock("../src/identity/authorizationContext", () => {
  const actual = jest.requireActual(
    "../src/identity/authorizationContext",
  ) as typeof import("../src/identity/authorizationContext");
  return {
    ...actual,
    sealTrustedAuthorizationContext: jest.fn((fields) =>
      actual.sealTrustedAuthorizationContext(fields),
    ),
  };
});

const commerceCalls: number[] = [];

jest.mock("../src/domains/commerce/api", () => {
  const actual = jest.requireActual("../src/domains/commerce/api") as typeof import("../src/domains/commerce/api");
  return {
    handleCommerceOperation: (
      store: Parameters<typeof actual.handleCommerceOperation>[0],
      execute: Parameters<typeof actual.handleCommerceOperation>[1],
      operation: string,
      payload: Record<string, unknown>,
      authz: Parameters<typeof actual.handleCommerceOperation>[4],
    ) => {
      commerceCalls.push(1);
      return actual.handleCommerceOperation(store, execute, operation, payload, authz);
    },
  };
});

import { sealTrustedAuthorizationContext } from "../src/identity/authorizationContext";
import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";
import type {
  CreateWorkspaceResult,
  IdentityPort,
  MembershipResolveResult,
} from "../src/identity/identityPort";

const sealMock = sealTrustedAuthorizationContext as unknown as jest.Mock;

const membership = {
  membershipId: "mem-sec006",
  actorId: "actor-sec006",
  workspaceId: "ws-sec006",
  status: "active" as const,
  role: "role-sec006",
};

function memoryPort(): IdentityPort & { lookupCount: number } {
  return createMemoryIdentityPort({
    actorProofs: [{ proof: "proof-sec006", actorId: membership.actorId }],
    memberships: [membership],
  });
}

describe("SEC-006 IdentityPort throws map to typed Gateway deny", () => {
  beforeEach(() => {
    commerceCalls.length = 0;
    sealMock.mockClear();
  });

  it("maps resolveActor throw to V2_UNAUTHENTICATED without membership lookup or domain", () => {
    const identityPort: IdentityPort & { lookupCount: number } = {
      lookupCount: 0,
      resolveActor: () => {
        throw new Error("actor boom");
      },
      resolveMembership: () => {
        identityPort.lookupCount += 1;
        throw new Error("should not run");
      },
      createWorkspace: () => {
        throw new Error("should not run");
      },
    };
    const { execute } = createPulseV2Gateway({ PULSE_V2_SUPABASE_URL: "" }, { identityPort });
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-sec006",
      actorId: "spoof-actor",
      membershipId: "spoof-mem",
      payload: { id: "so-throw", workspaceId: "ws-spoof", role: "spoof-role" },
      correlationId: "corr-actor-throw",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("V2_UNAUTHENTICATED");
      expect(result.correlationId).toBe("corr-actor-throw");
    }
    expect(identityPort.lookupCount).toBe(0);
    expect(commerceCalls).toHaveLength(0);
    expect(sealMock).not.toHaveBeenCalled();
  });

  it("maps resolveMembership throw to V2_MEMBERSHIP_DENIED after one lookup", () => {
    let lookups = 0;
    const identityPort: IdentityPort = {
      resolveActor: () => ({ ok: true, actorId: membership.actorId }),
      resolveMembership: (): MembershipResolveResult => {
        lookups += 1;
        throw new Error("membership boom");
      },
      createWorkspace: () => {
        throw new Error("should not run");
      },
    };
    const { execute } = createPulseV2Gateway({ PULSE_V2_SUPABASE_URL: "" }, { identityPort });
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-sec006",
      payload: { id: "so-mem-throw" },
      correlationId: "corr-mem-throw",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("V2_MEMBERSHIP_DENIED");
      expect(result.correlationId).toBe("corr-mem-throw");
    }
    expect(lookups).toBe(1);
    expect(commerceCalls).toHaveLength(0);
    expect(sealMock).not.toHaveBeenCalled();
  });

  it("maps createWorkspace resolveActor throw without fabricating identifiers", () => {
    const identityPort: IdentityPort = {
      resolveActor: () => {
        throw new Error("bootstrap actor boom");
      },
      resolveMembership: () => ({ ok: false, reason: "not_found" }),
      createWorkspace: (): CreateWorkspaceResult => {
        throw new Error("should not create");
      },
    };
    const { createWorkspace } = createPulseV2Gateway({ PULSE_V2_SUPABASE_URL: "" }, { identityPort });
    const result = createWorkspace({
      identityProof: "proof-sec006",
      correlationId: "corr-boot-actor",
      idempotencyKey: "idem-boot-actor",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("V2_UNAUTHENTICATED");
      expect(result.correlationId).toBe("corr-boot-actor");
      expect("workspaceId" in result).toBe(false);
      expect("membershipId" in result).toBe(false);
    }
    expect(sealMock).not.toHaveBeenCalled();
  });

  it("maps createWorkspace Identity write throw to V2_WORKSPACE_CREATE_FAILED", () => {
    const identityPort: IdentityPort = {
      resolveActor: () => ({ ok: true, actorId: membership.actorId }),
      resolveMembership: () => ({ ok: false, reason: "not_found" }),
      createWorkspace: () => {
        throw new Error("write boom");
      },
    };
    const { createWorkspace } = createPulseV2Gateway({ PULSE_V2_SUPABASE_URL: "" }, { identityPort });
    const result = createWorkspace({
      identityProof: "proof-sec006",
      correlationId: "corr-boot-write",
      idempotencyKey: "idem-boot-write",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("V2_WORKSPACE_CREATE_FAILED");
      expect(result.correlationId).toBe("corr-boot-write");
      expect("workspaceId" in result).toBe(false);
    }
  });

  it("keeps typed Identity denials unchanged", () => {
    const identityPort = memoryPort();
    const { execute } = createPulseV2Gateway({ PULSE_V2_SUPABASE_URL: "" }, { identityPort });
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-unknown",
      payload: { id: "so-typed" },
      correlationId: "corr-typed",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("V2_UNAUTHENTICATED");
      expect(result.message).toContain("not_found");
      expect(result.correlationId).toBe("corr-typed");
    }
    expect(identityPort.lookupCount).toBe(0);
    expect(commerceCalls).toHaveLength(0);
  });

  it("keeps the successful execute path", () => {
    const identityPort = memoryPort();
    const { execute } = createPulseV2Gateway({ PULSE_V2_SUPABASE_URL: "" }, { identityPort });
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-sec006",
      membershipId: membership.membershipId,
      payload: { id: "so-ok" },
      correlationId: "corr-ok",
    });
    expect(result.ok).toBe(true);
    expect(identityPort.lookupCount).toBe(1);
    expect(commerceCalls.length).toBeGreaterThan(0);
    expect(sealMock).toHaveBeenCalledTimes(1);
  });
});
