import type { AuthorizationContext } from "../../identity/authorizationContext";
import type { V2Execute, V2GatewayResponse } from "../../gateway/types";
import type { V2TenantContext } from "../../persistence/tenantContext";
import type { CommerceRepository } from "./repository";

function persistenceCtx(authz: AuthorizationContext): V2TenantContext {
  return { workspaceId: authz.workspaceId, actorUserId: authz.actorId };
}

export function handleCommerceOperation(
  store: CommerceRepository,
  execute: V2Execute,
  operation: string,
  payload: Record<string, unknown>,
  authz: AuthorizationContext,
): V2GatewayResponse {
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
    const tripResult = execute({
      domain: "execution",
      operation: "createTripFromOrder",
      payload: { orderId: order.id },
      correlationId: authz.correlationId,
    });
    if (!tripResult.ok) return tripResult;
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
