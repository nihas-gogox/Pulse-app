import type { ExecutionStore } from "./store";
import type { V2GatewayResponse } from "../../gateway/types";

export function handleExecutionOperation(
  store: ExecutionStore,
  operation: string,
  payload: Record<string, unknown>,
  correlationId: string,
): V2GatewayResponse {
  if (operation === "createTripFromOrder") {
    const orderId = String(payload.orderId ?? "").trim();
    const workspaceId = String(payload.workspaceId ?? "").trim();
    if (!orderId || !workspaceId) {
      return {
        ok: false,
        code: "EXECUTION_INVALID",
        message: "createTripFromOrder requires orderId and workspaceId",
        correlationId,
      };
    }
    const existing = store.getTripByOrderId(orderId);
    if (existing) {
      return {
        ok: true,
        domain: "execution",
        operation,
        correlationId,
        data: { trip: existing },
      };
    }
    const trip = store.insertTrip({
      id: `trip-${orderId}`,
      workspaceId,
      orderId,
      status: "created",
    });
    return {
      ok: true,
      domain: "execution",
      operation,
      correlationId,
      data: { trip },
    };
  }

  if (operation === "getTrip") {
    const id = String(payload.id ?? "").trim();
    const trip = store.getTrip(id);
    if (!trip) {
      return {
        ok: false,
        code: "EXECUTION_NOT_FOUND",
        message: `trips id not found: ${id}`,
        correlationId,
      };
    }
    return {
      ok: true,
      domain: "execution",
      operation,
      correlationId,
      data: { trip },
    };
  }

  return {
    ok: false,
    code: "EXECUTION_UNKNOWN_OPERATION",
    message: operation,
    correlationId,
  };
}
