import type { V2Execute, V2GatewayResponse } from "../../gateway/types";
import {
  isTrustedAuthorizationContext,
  type AuthorizationContext,
} from "../../identity/authorizationContext";
import type { V2TenantContext } from "../../persistence/tenantContext";
import type { CommerceRepository } from "./repository";
import { isV2PersistenceError } from "../../persistence/v2PersistenceError";

/** Persistence tenancy is copied from the sealed AuthorizationContext only. */
function persistenceCtx(authz: AuthorizationContext): V2TenantContext {
  return { workspaceId: authz.workspaceId, actorUserId: authz.actorId };
}

function deniedUntrusted(authz: AuthorizationContext): V2GatewayResponse {
  const correlationId =
    typeof authz?.correlationId === "string" ? authz.correlationId : "";
  return {
    ok: false,
    code: "V2_AUTHORIZATION_CONTEXT_DENIED",
    message: "authorization context is not trusted",
    correlationId,
  };
}

/**
 * Commerce domain handler. Gateway dispatch only — not a public package API.
 * Nested Execution uses the injected Gateway dispatch closure, not a public Execution handler.
 */
export function handleCommerceOperation(
  store: CommerceRepository,
  execute: V2Execute,
  operation: string,
  payload: Record<string, unknown>,
  authz: AuthorizationContext,
): V2GatewayResponse {
  if (!isTrustedAuthorizationContext(authz)) {
    return deniedUntrusted(authz);
  }

  const ctx = persistenceCtx(authz);

  if (operation === "createOrder") {
    const id = String(payload.id ?? "").trim();
    if (!id) {
      return {
        ok: false,
        code: "COMMERCE_INVALID",
        message: "createOrder requires id",
        correlationId: authz.correlationId,
      };
    }
    const order = store.insertSalesOrder(ctx, {
      id,
      workspaceId: authz.workspaceId,
      status: "placed",
    });
    let tripResult: V2GatewayResponse;
    try {
      tripResult = execute({
        domain: "execution",
        operation: "createTripFromOrder",
        payload: { orderId: order.id },
        correlationId: authz.correlationId,
      });
    } catch (err) {
      if (isV2PersistenceError(err)) {
        store.deleteSalesOrder(ctx, id);
        throw err;
      }
      throw err;
    }
    if (!tripResult.ok) {
      store.deleteSalesOrder(ctx, id);
      return tripResult;
    }
    return {
      ok: true,
      domain: "commerce",
      operation,
      correlationId: authz.correlationId,
      data: { order, trip: tripResult.data },
    };
  }

  if (operation === "getOrder") {
    const id = String(payload.id ?? "").trim();
    const order = store.getSalesOrder(ctx, id);
    if (!order) {
      return {
        ok: false,
        code: "COMMERCE_NOT_FOUND",
        message: `sales_orders id not found: ${id}`,
        correlationId: authz.correlationId,
      };
    }
    return {
      ok: true,
      domain: "commerce",
      operation,
      correlationId: authz.correlationId,
      data: { order },
    };
  }

  return {
    ok: false,
    code: "COMMERCE_UNKNOWN_OPERATION",
    message: operation,
    correlationId: authz.correlationId,
  };
}
