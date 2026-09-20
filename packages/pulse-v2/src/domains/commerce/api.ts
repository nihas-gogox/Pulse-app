import type { CommerceRepository } from "./repository";
import type { V2Execute, V2GatewayResponse } from "../../gateway/types";

function tenantFromPayload(payload: Record<string, unknown>, correlationId: string) {
  const workspaceId = String(payload.workspaceId ?? "").trim();
  if (!workspaceId) {
    return {
      ok: false as const,
      response: {
        ok: false as const,
        code: "COMMERCE_INVALID",
        message: "workspaceId is required (tenant isolation)",
        correlationId,
      },
    };
  }
  return { ok: true as const, ctx: { workspaceId, actorUserId: null as string | null } };
}

export function handleCommerceOperation(
  store: CommerceRepository,
  execute: V2Execute,
  operation: string,
  payload: Record<string, unknown>,
  correlationId: string,
): V2GatewayResponse {
  const tenant = tenantFromPayload(payload, correlationId);
  if (!tenant.ok) return tenant.response;

  if (operation === "createOrder") {
    const id = String(payload.id ?? "").trim();
    if (!id) {
      return {
        ok: false,
        code: "COMMERCE_INVALID",
        message: "createOrder requires id and workspaceId",
        correlationId,
      };
    }
    const order = store.insertSalesOrder(tenant.ctx, {
      id,
      workspaceId: tenant.ctx.workspaceId,
      status: "placed",
    });
    const tripResult = execute({
      domain: "execution",
      operation: "createTripFromOrder",
      payload: { orderId: order.id, workspaceId: order.workspaceId },
      correlationId,
    });
    if (!tripResult.ok) return tripResult;
    return {
      ok: true,
      domain: "commerce",
      operation,
      correlationId,
      data: { order, trip: tripResult.data },
    };
  }

  if (operation === "getOrder") {
    const id = String(payload.id ?? "").trim();
    const order = store.getSalesOrder(tenant.ctx, id);
    if (!order) {
      return {
        ok: false,
        code: "COMMERCE_NOT_FOUND",
        message: `sales_orders id not found: ${id}`,
        correlationId,
      };
    }
    return {
      ok: true,
      domain: "commerce",
      operation,
      correlationId,
      data: { order },
    };
  }

  return {
    ok: false,
    code: "COMMERCE_UNKNOWN_OPERATION",
    message: operation,
    correlationId,
  };
}
