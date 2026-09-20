import type { AuthorizationContext } from "../src/identity/authorizationContext";

const commerceContexts: AuthorizationContext[] = [];
const executionContexts: AuthorizationContext[] = [];

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

import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";
import type { MembershipRecord } from "../src/identity/identityPort";

const membership: MembershipRecord = {
  membershipId: "mem-imm",
  actorId: "actor-imm",
  workspaceId: "ws-imm",
  status: "active",
  role: "role-fixture-imm",
};

function executeCreateOrder() {
  const identityPort = createMemoryIdentityPort({
    actorProofs: [{ proof: "proof-imm", actorId: "actor-imm" }],
    memberships: [membership],
  });
  const { execute } = createPulseV2Gateway({ PULSE_V2_SUPABASE_URL: "" }, { identityPort });
  return {
    identityPort,
    result: execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-imm",
      membershipId: membership.membershipId,
      payload: { id: "so-imm" },
      correlationId: "c-imm",
    }),
  };
}

function compileTimeReadonly(ctx: AuthorizationContext) {
  // @ts-expect-error trusted actorId is readonly
  ctx.actorId = "mutated";
  // @ts-expect-error trusted membershipId is readonly
  ctx.membershipId = "mutated";
  // @ts-expect-error trusted workspaceId is readonly
  ctx.workspaceId = "mutated";
  // @ts-expect-error trusted role is readonly
  ctx.role = "mutated";
  // @ts-expect-error trusted correlationId is readonly
  ctx.correlationId = "mutated";
}

type MutableAuthorizationContext = {
  -readonly [K in keyof AuthorizationContext]: string;
};

function assignTrustedField(
  ctx: AuthorizationContext,
  field: keyof AuthorizationContext,
  value: string,
) {
  (ctx as MutableAuthorizationContext)[field] = value;
}

describe("AuthorizationContext request-scope immutability", () => {
  beforeEach(() => {
    commerceContexts.length = 0;
    executionContexts.length = 0;
  });

  it("prevents runtime mutation of all trusted fields", () => {
    void compileTimeReadonly;
    const { result } = executeCreateOrder();
    expect(result.ok).toBe(true);
    const ctx = commerceContexts[0];
    expect(ctx).toBeDefined();
    if (!ctx) return;

    expect(Object.isFrozen(ctx)).toBe(true);

    const snapshot = { ...ctx };
    const fields: (keyof AuthorizationContext)[] = [
      "actorId",
      "membershipId",
      "workspaceId",
      "role",
      "correlationId",
    ];
    for (const field of fields) {
      expect(() => assignTrustedField(ctx, field, `mutated-${field}`)).toThrow(TypeError);
    }

    expect(ctx.actorId).toBe(snapshot.actorId);
    expect(ctx.membershipId).toBe(snapshot.membershipId);
    expect(ctx.workspaceId).toBe(snapshot.workspaceId);
    expect(ctx.role).toBe(snapshot.role);
    expect(ctx.correlationId).toBe(snapshot.correlationId);
    expect(ctx.actorId).toBe(membership.actorId);
    expect(ctx.membershipId).toBe(membership.membershipId);
    expect(ctx.workspaceId).toBe(membership.workspaceId);
    expect(ctx.role).toBe(membership.role);
    expect(ctx.correlationId).toBe("c-imm");
  });

  it("keeps the same frozen context across nested Commerce → Execution", () => {
    const { result, identityPort } = executeCreateOrder();
    expect(result.ok).toBe(true);
    expect(identityPort.lookupCount).toBe(1);
    expect(commerceContexts[0]).toBe(executionContexts[0]);
    expect(Object.isFrozen(executionContexts[0])).toBe(true);
    expect(executionContexts[0]?.role).toBe(membership.role);
    expect(executionContexts[0]?.workspaceId).toBe(membership.workspaceId);
    if (!executionContexts[0]) return;
    expect(() => assignTrustedField(executionContexts[0], "workspaceId", "ws-other")).toThrow(
      TypeError,
    );
    expect(executionContexts[0].workspaceId).toBe(membership.workspaceId);
    expect(() => assignTrustedField(executionContexts[0], "role", "role-other")).toThrow(TypeError);
    expect(executionContexts[0].role).toBe(membership.role);
  });
});
