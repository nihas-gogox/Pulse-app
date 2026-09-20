const commerceContexts: AuthorizationContext[] = [];
const executionContexts: AuthorizationContext[] = [];
const executionHandlerCalls: number[] = [];

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
      executionHandlerCalls.push(1);
      executionContexts.push(authz);
      return actual.handleExecutionOperation(store, operation, payload, authz);
    },
  };
});

import type { AuthorizationContext } from "../src/identity/authorizationContext";
import {
  assertTrustedAuthorizationContext,
  isTrustedAuthorizationContext,
} from "../src/identity/authorizationContext";
import { handleCommerceOperation } from "../src/domains/commerce/api";
import { handleExecutionOperation } from "../src/domains/execution/api";
import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";
import type { MembershipRecord } from "../src/identity/identityPort";
import { createCommerceMemoryRepository } from "../src/persistence/memory/commerceMemory";
import { createExecutionMemoryRepository } from "../src/persistence/memory/executionMemory";
import type { CommerceRepository } from "../src/domains/commerce/repository";
import type { ExecutionRepository } from "../src/domains/execution/repository";
import type { V2Execute } from "../src/gateway/types";

const membership: MembershipRecord = {
  membershipId: "membership-a",
  actorId: "actor-a",
  workspaceId: "workspace-a",
  status: "active",
  role: "role-fixture-a",
};

const forgedShape = {
  actorId: "actor-a",
  membershipId: "membership-a",
  workspaceId: "workspace-a",
  role: "role-fixture-a",
  correlationId: "corr-forged",
} as AuthorizationContext;

function identityPort() {
  return createMemoryIdentityPort({
    actorProofs: [{ proof: "proof-a", actorId: "actor-a" }],
    memberships: [membership],
  });
}

function capturingStores() {
  const commerceInner = createCommerceMemoryRepository();
  const executionInner = createExecutionMemoryRepository();
  let orderInserts = 0;
  let tripInserts = 0;
  const commerce: CommerceRepository = {
    insertSalesOrder: (ctx, order) => {
      orderInserts += 1;
      return commerceInner.insertSalesOrder(ctx, order);
    },
    getSalesOrder: (ctx, id) => commerceInner.getSalesOrder(ctx, id),
  };
  const execution: ExecutionRepository = {
    insertTrip: (ctx, trip) => {
      tripInserts += 1;
      return executionInner.insertTrip(ctx, trip);
    },
    getTrip: (ctx, id) => executionInner.getTrip(ctx, id),
    getTripByOrderId: (ctx, orderId) => executionInner.getTripByOrderId(ctx, orderId),
  };
  return {
    commerce,
    execution,
    orderInserts: () => orderInserts,
    tripInserts: () => tripInserts,
  };
}

function deliverSealedContext(): AuthorizationContext {
  commerceContexts.length = 0;
  const { execute } = createPulseV2Gateway({ PULSE_V2_SUPABASE_URL: "" }, { identityPort: identityPort() });
  execute({
    domain: "commerce",
    operation: "getOrder",
    identityProof: "proof-a",
    membershipId: membership.membershipId,
    payload: { id: "missing-for-seal" },
    correlationId: "corr-a",
  });
  const sealed = commerceContexts[commerceContexts.length - 1];
  if (!sealed) throw new Error("Gateway did not deliver AuthorizationContext");
  return sealed;
}

describe("SEC-002 domain-handler trusted context entry", () => {
  beforeEach(() => {
    commerceContexts.length = 0;
    executionContexts.length = 0;
    executionHandlerCalls.length = 0;
  });

  it("accepts a Gateway-sealed context for Commerce → Execution as the same object", () => {
    const port = identityPort();
    const { execute } = createPulseV2Gateway({ PULSE_V2_SUPABASE_URL: "" }, { identityPort: port });
    const result = execute({
      domain: "commerce",
      operation: "createOrder",
      identityProof: "proof-a",
      membershipId: membership.membershipId,
      payload: { id: "so-trusted" },
      correlationId: "corr-a",
    });
    expect(result.ok).toBe(true);
    expect(port.lookupCount).toBe(1);
    expect(commerceContexts[0]).toBeDefined();
    expect(executionContexts[0]).toBe(commerceContexts[0]);
    expect(isTrustedAuthorizationContext(commerceContexts[0]!)).toBe(true);
    expect(isTrustedAuthorizationContext(executionContexts[0]!)).toBe(true);
    expect(() => assertTrustedAuthorizationContext(commerceContexts[0]!)).not.toThrow();
  });

  it("rejects a plain structural object at Commerce and Execution with no side effects", () => {
    const stores = capturingStores();
    let nestedExecuteCalls = 0;
    const execute: V2Execute = () => {
      nestedExecuteCalls += 1;
      return { ok: false, code: "UNEXPECTED", message: "", correlationId: "corr-forged" };
    };
    const commerceResult = handleCommerceOperation(
      stores.commerce,
      execute,
      "createOrder",
      { id: "so-forged" },
      forgedShape,
    );
    const executionBefore = executionHandlerCalls.length;
    const executionResult = handleExecutionOperation(
      stores.execution,
      "createTripFromOrder",
      { orderId: "so-forged" },
      forgedShape,
    );
    expect(commerceResult.ok).toBe(false);
    if (!commerceResult.ok) expect(commerceResult.code).toBe("V2_AUTHORIZATION_CONTEXT_DENIED");
    expect(executionResult.ok).toBe(false);
    if (!executionResult.ok) expect(executionResult.code).toBe("V2_AUTHORIZATION_CONTEXT_DENIED");
    expect(nestedExecuteCalls).toBe(0);
    expect(stores.orderInserts()).toBe(0);
    expect(stores.tripInserts()).toBe(0);
    expect(executionHandlerCalls.length).toBe(executionBefore + 1);
    expect(isTrustedAuthorizationContext(forgedShape)).toBe(false);
    expect(() => assertTrustedAuthorizationContext(forgedShape)).toThrow();
  });

  it("rejects spread clones even when values match or workspace/role differ", () => {
    const sealed = deliverSealedContext();
    const stores = capturingStores();
    const clones: AuthorizationContext[] = [
      { ...sealed } as AuthorizationContext,
      { ...sealed, workspaceId: "workspace-b" } as AuthorizationContext,
      { ...sealed, role: "role-fixture-b" } as AuthorizationContext,
    ];
    for (const clone of clones) {
      const commerceResult = handleCommerceOperation(
        stores.commerce,
        () => ({ ok: false, code: "UNEXPECTED", message: "", correlationId: "x" }),
        "createOrder",
        { id: "so-clone" },
        clone,
      );
      const executionResult = handleExecutionOperation(
        stores.execution,
        "createTripFromOrder",
        { orderId: "so-clone" },
        clone,
      );
      expect(commerceResult.ok).toBe(false);
      if (!commerceResult.ok) expect(commerceResult.code).toBe("V2_AUTHORIZATION_CONTEXT_DENIED");
      expect(executionResult.ok).toBe(false);
      if (!executionResult.ok) expect(executionResult.code).toBe("V2_AUTHORIZATION_CONTEXT_DENIED");
    }
    expect(stores.orderInserts()).toBe(0);
    expect(stores.tripInserts()).toBe(0);
  });

  it("rejects a superficially labeled fake brand", () => {
    const fake = {
      actorId: "actor-a",
      membershipId: "membership-a",
      workspaceId: "workspace-a",
      role: "role-fixture-a",
      correlationId: "corr-fake-brand",
      [Symbol("pulse-v2.AuthorizationContext")]: true,
    } as AuthorizationContext;
    const stores = capturingStores();
    const commerceResult = handleCommerceOperation(
      stores.commerce,
      () => ({ ok: false, code: "UNEXPECTED", message: "", correlationId: "corr-fake-brand" }),
      "createOrder",
      { id: "so-fake-brand" },
      fake,
    );
    expect(commerceResult.ok).toBe(false);
    if (!commerceResult.ok) expect(commerceResult.code).toBe("V2_AUTHORIZATION_CONTEXT_DENIED");
    expect(stores.orderInserts()).toBe(0);
    expect(isTrustedAuthorizationContext(fake)).toBe(false);
  });

  it("does not perform Identity lookup when a domain is called with a forged context", () => {
    const port = identityPort();
    const stores = capturingStores();
    handleCommerceOperation(
      stores.commerce,
      () => ({ ok: false, code: "UNEXPECTED", message: "", correlationId: "corr-forged" }),
      "createOrder",
      { id: "so-no-id" },
      forgedShape,
    );
    expect(port.lookupCount).toBe(0);
    expect(stores.orderInserts()).toBe(0);
  });
});
