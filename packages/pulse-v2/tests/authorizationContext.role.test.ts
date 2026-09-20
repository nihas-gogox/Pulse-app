const commerceContexts: Array<{
  actorId: string;
  membershipId: string;
  workspaceId: string;
  role: string;
  correlationId: string;
}> = [];
const executionContexts: Array<{
  actorId: string;
  membershipId: string;
  workspaceId: string;
  role: string;
  correlationId: string;
}> = [];

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
      commerceContexts.push({ ...authz });
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
      executionContexts.push({ ...authz });
      return actual.handleExecutionOperation(store, operation, payload, authz);
    },
  };
});

import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";
import type { MembershipRecord } from "../src/identity/identityPort";

const TEST_ROLE_A = "role-fixture-a";
const TEST_ROLE_B = "role-fixture-b";
const proofA = "proof-role-a";
const proofB = "proof-role-b";

const membershipA: MembershipRecord = {
  membershipId: "mem-role-a",
  actorId: "actor-a",
  workspaceId: "ws-role-a",
  status: "active",
  role: TEST_ROLE_A,
};

const membershipB: MembershipRecord = {
  membershipId: "mem-role-b",
  actorId: "actor-b",
  workspaceId: "ws-role-b",
  status: "active",
  role: TEST_ROLE_B,
};

function gateway(memberships: MembershipRecord[]) {
  const identityPort = createMemoryIdentityPort({
    actorProofs: [
      { proof: proofA, actorId: "actor-a" },
      { proof: proofB, actorId: "actor-b" },
    ],
    memberships,
  });
  return {
    ...createPulseV2Gateway({ PULSE_V2_SUPABASE_URL: "" }, { identityPort }),
    identityPort,
  };
}

describe("AuthorizationContext.role from Membership", () => {
  beforeEach(() => {
    commerceContexts.length = 0;
    executionContexts.length = 0;
  });

  it("copies role from the verified Membership", () => {
    const { execute, identityPort } = gateway([membershipA]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorizationContext.role.test-26",
      identityProof: proofA,
      membershipId: membershipA.membershipId,
      payload: { id: "so-role-copy" },
      correlationId: "c-role-copy",
    });
    expect(result.ok).toBe(true);
    expect(commerceContexts[0]?.role).toBe(TEST_ROLE_A);
    expect(commerceContexts[0]?.workspaceId).toBe(membershipA.workspaceId);
    expect(commerceContexts[0]?.membershipId).toBe(membershipA.membershipId);
    expect(identityPort.lookupCount).toBe(1);
  });

  it("ignores payload.role and uses Membership.role", () => {
    const { execute } = gateway([membershipA]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorizationContext.role.test-27",
      identityProof: proofA,
      membershipId: membershipA.membershipId,
      payload: { id: "so-role-payload", role: TEST_ROLE_B },
      correlationId: "c-role-payload",
    });
    expect(result.ok).toBe(true);
    expect(commerceContexts[0]?.role).toBe(TEST_ROLE_A);
    expect(commerceContexts[0]?.role).not.toBe(TEST_ROLE_B);
  });

  it("does not change allow/deny when Membership.role differs", () => {
    const first = gateway([membershipA]).execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorizationContext.role.test-28",
      identityProof: proofA,
      membershipId: membershipA.membershipId,
      payload: { id: "so-role-a" },
      correlationId: "c-role-a",
    });
    const second = gateway([{ ...membershipA, role: TEST_ROLE_B }]).execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorizationContext.role.test-29",
      identityProof: proofA,
      membershipId: membershipA.membershipId,
      payload: { id: "so-role-b" },
      correlationId: "c-role-b",
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });

  it("still denies another Actor's Membership", () => {
    const { execute, identityPort } = gateway([membershipA, membershipB]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorizationContext.role.test-30",
      identityProof: proofA,
      membershipId: membershipB.membershipId,
      payload: { id: "so-wrong-mem" },
      correlationId: "c-wrong-mem",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("V2_MEMBERSHIP_DENIED");
    expect(commerceContexts).toHaveLength(0);
    expect(identityPort.lookupCount).toBe(1);
  });

  it("still denies caller actorId spoof before membership lookup", () => {
    const { execute, identityPort } = gateway([membershipA, membershipB]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorizationContext.role.test-31",
      identityProof: proofA,
      actorId: "actor-b",
      membershipId: membershipA.membershipId,
      payload: { id: "so-spoof" },
      correlationId: "c-spoof",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("V2_ACTOR_DENIED");
    expect(identityPort.lookupCount).toBe(0);
    expect(commerceContexts).toHaveLength(0);
  });

  it("still denies payload workspaceId mismatch", () => {
    const { execute } = gateway([membershipA]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorizationContext.role.test-32",
      identityProof: proofA,
      membershipId: membershipA.membershipId,
      payload: { id: "so-ws", workspaceId: membershipB.workspaceId },
      correlationId: "c-ws",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("V2_WORKSPACE_DENIED");
    expect(commerceContexts).toHaveLength(0);
  });

  it("reuses the same Role on nested Commerce → Execution without a second lookup", () => {
    const { execute, identityPort } = gateway([membershipA]);
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-authorizationContext.role.test-33",
      identityProof: proofA,
      membershipId: membershipA.membershipId,
      payload: { id: "so-nested-role" },
      correlationId: "c-nested-role",
    });
    expect(result.ok).toBe(true);
    expect(identityPort.lookupCount).toBe(1);
    expect(commerceContexts[0]?.role).toBe(TEST_ROLE_A);
    expect(executionContexts[0]?.role).toBe(TEST_ROLE_A);
    expect(executionContexts[0]?.workspaceId).toBe(membershipA.workspaceId);
    expect(executionContexts[0]?.membershipId).toBe(membershipA.membershipId);
  });

  it("does not expose Role on createWorkspace response", () => {
    const identityPort = createMemoryIdentityPort({
      actorProofs: [{ proof: proofA, actorId: "actor-a" }],
      memberships: [],
    });
    const { createWorkspace } = createPulseV2Gateway(
      { PULSE_V2_SUPABASE_URL: "" },
      { identityPort },
    );
    const created = createWorkspace({
      identityProof: proofA,
      correlationId: "c-create",
      idempotencyKey: "idem-role-ctx",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(Object.keys(created).sort()).toEqual([
      "actorId",
      "correlationId",
      "membershipId",
      "membershipStatus",
      "ok",
      "workspaceId",
    ]);
    expect("role" in created).toBe(false);
  });
});
