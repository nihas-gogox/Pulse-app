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

import type { AuthorizationContext } from "../src/identity/authorizationContext";
import { sealTrustedAuthorizationContext } from "../src/identity/authorizationContext";
import fs from "node:fs";
import path from "node:path";
import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";
import type { MembershipRecord } from "../src/identity/identityPort";

const commerceContexts: AuthorizationContext[] = [];
const executionContexts: AuthorizationContext[] = [];
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
      commerceContexts.push(authz);
      return actual.handleCommerceOperation(store, execute, operation, payload, authz);
    },
  };
});

jest.mock("../src/domains/execution/api", () => {
  const actual = jest.requireActual("../src/domains/execution/api") as typeof import("../src/domains/execution/api");
  return {
    handleExecutionOperation: (
      store: Parameters<typeof actual.handleExecutionOperation>[0],
      operation: string,
      payload: Record<string, unknown>,
      authz: Parameters<typeof actual.handleExecutionOperation>[3],
    ) => {
      executionContexts.push(authz);
      return actual.handleExecutionOperation(store, operation, payload, authz);
    },
  };
});

const membership: MembershipRecord = {
  membershipId: "mem-ctor",
  actorId: "actor-ctor",
  workspaceId: "ws-ctor",
  status: "active",
  role: "role-ctor",
};

const otherMembership: MembershipRecord = {
  membershipId: "mem-other",
  actorId: "actor-other",
  workspaceId: "ws-other",
  status: "active",
  role: "role-other",
};

function gateway(memberships: MembershipRecord[]) {
  const identityPort = createMemoryIdentityPort({
    actorProofs: [
      { proof: "proof-ctor", actorId: "actor-ctor" },
      { proof: "proof-other", actorId: "actor-other" },
    ],
    memberships,
  });
  const { execute } = createPulseV2Gateway({ PULSE_V2_SUPABASE_URL: "" }, { identityPort });
  return { execute, identityPort };
}

const sealMock = sealTrustedAuthorizationContext as unknown as jest.Mock;

describe("AuthorizationContext exclusive construction", () => {
  beforeEach(() => {
    commerceContexts.length = 0;
    executionContexts.length = 0;
    commerceCalls.length = 0;
    sealMock.mockClear();
  });

  it("seals exactly once per public execute and delivers that frozen context to Commerce", () => {
    const { execute, identityPort } = gateway([membership]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-ctor",
      membershipId: membership.membershipId,
      payload: { id: "so-ctor" },
      correlationId: "c-ctor",
    });
    expect(result.ok).toBe(true);
    expect(sealMock).toHaveBeenCalledTimes(1);
    expect(identityPort.lookupCount).toBe(1);
    expect(commerceContexts[0]).toBe(sealMock.mock.results[0]?.value);
    expect(Object.isFrozen(commerceContexts[0])).toBe(true);
  });

  it("passes the same sealed object from Commerce to Execution", () => {
    const { execute } = gateway([membership]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-ctor",
      membershipId: membership.membershipId,
      payload: { id: "so-nested" },
      correlationId: "c-nested",
    });
    expect(result.ok).toBe(true);
    expect(sealMock).toHaveBeenCalledTimes(1);
    expect(commerceContexts[0]).toBe(executionContexts[0]);
    expect(executionContexts[0]).toBe(sealMock.mock.results[0]?.value);
  });

  it("does not take workspace or role from payload", () => {
    const { execute } = gateway([membership]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-ctor",
      membershipId: membership.membershipId,
      payload: {
        id: "so-payload",
        workspaceId: membership.workspaceId,
        role: "payload-role",
      },
      correlationId: "c-payload",
    });
    expect(result.ok).toBe(true);
    expect(commerceContexts[0]?.workspaceId).toBe(membership.workspaceId);
    expect(commerceContexts[0]?.role).toBe(membership.role);
    expect(commerceContexts[0]?.role).not.toBe("payload-role");
    expect(sealMock.mock.calls[0]?.[0]).toEqual({
      actorId: membership.actorId,
      membershipId: membership.membershipId,
      workspaceId: membership.workspaceId,
      role: membership.role,
      correlationId: "c-payload",
    });
  });

  it("denies a foreign Membership before sealing or invoking Commerce", () => {
    const { execute, identityPort } = gateway([membership, otherMembership]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-ctor",
      membershipId: otherMembership.membershipId,
      payload: { id: "so-foreign" },
      correlationId: "c-foreign",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("V2_MEMBERSHIP_DENIED");
    expect(identityPort.lookupCount).toBe(1);
    expect(sealMock).not.toHaveBeenCalled();
    expect(commerceCalls).toHaveLength(0);
    expect(commerceContexts).toHaveLength(0);
  });

  it("denies actor spoof before sealing, membership lookup, or Commerce", () => {
    const { execute, identityPort } = gateway([membership, otherMembership]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-ctor",
      actorId: "actor-other",
      membershipId: membership.membershipId,
      payload: { id: "so-spoof" },
      correlationId: "c-spoof",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("V2_ACTOR_DENIED");
    expect(identityPort.lookupCount).toBe(0);
    expect(sealMock).not.toHaveBeenCalled();
    expect(commerceCalls).toHaveLength(0);
  });

  it("denies payload workspace mismatch before sealing or invoking Commerce", () => {
    const { execute } = gateway([membership]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-ctor",
      membershipId: membership.membershipId,
      payload: { id: "so-ws", workspaceId: "ws-other" },
      correlationId: "c-ws",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("V2_WORKSPACE_DENIED");
    expect(sealMock).not.toHaveBeenCalled();
    expect(commerceCalls).toHaveLength(0);
  });

  it("does not export the sealer from the public package index", () => {
    const indexSrc = fs.readFileSync(path.join(__dirname, "../src/index.ts"), "utf8");
    expect(indexSrc).not.toContain("sealTrustedAuthorizationContext");
  });
});
