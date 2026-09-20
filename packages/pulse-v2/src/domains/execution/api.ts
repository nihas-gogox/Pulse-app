import type { ExecutionRepository } from "./repository";
import type { V2GatewayResponse } from "../../gateway/types";

function tenantFromPayload(payload: Record<string, unknown>, correlationId: string) {
  const workspaceId = String(payload.workspaceId ?? "").trim();
  if (!workspaceId) {
    return {
      ok: false as const,
      response: {
        ok: false as const,
        code: "EXECUTION_INVALID",
        message: "workspaceId is required (tenant isolation)",
        correlationId,
      },
    };
  }
  return { ok: true as const, ctx: { workspaceId, actorUserId: null as string | null } };
}

export function handleExecutionOperation(
  store: ExecutionRepository,
  operation: string,
  payload: Record<string, unknown>,
  correlationId: string,
): V2GatewayResponse {
  const tenant = tenantFromPayload(payload, correlationId);
  if (!tenant.ok) return tenant.response;

  if (operation === "createTripFromOrder") {
    const orderId = String(payload.orderId ?? "").trim();
    if (!orderId) {
      return {
        ok: false,
        code: "EXECUTION_INVALID",
        message: "createTripFromOrder requires orderId and workspaceId",
        correlationId,
      };
    }
    const existing = store.getTripByOrderId(tenant.ctx, orderId);
    if (existing) {
      return {
        ok: true,
        domain: "execution",
        operation,
        correlationId,
        data: { trip: existing },
      };
    }
    const trip = store.insertTrip(tenant.ctx, {
      id: `trip-${orderId}`,
      workspaceId: tenant.ctx.workspaceId,
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
    const trip = store.getTrip(tenant.ctx, id);
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
