import type { CommerceStore } from "./store";
import type { V2Execute, V2GatewayResponse } from "../../gateway/types";

export function handleCommerceOperation(
  store: CommerceStore,
  execute: V2Execute,
  operation: string,
  payload: Record<string, unknown>,
  correlationId: string,
): V2GatewayResponse {
  if (operation === "createOrder") {
    const workspaceId = String(payload.workspaceId ?? "").trim();
    const id = String(payload.id ?? "").trim();
    if (!workspaceId || !id) {
      return {
        ok: false,
        code: "COMMERCE_INVALID",
        message: "createOrder requires id and workspaceId",
        correlationId,
      };
    }
    const order = store.insertSalesOrder({ id, workspaceId, status: "placed" });
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
    const order = store.getSalesOrder(id);
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
