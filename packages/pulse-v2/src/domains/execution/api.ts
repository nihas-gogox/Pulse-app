import type { V2GatewayResponse } from "../../gateway/types";
import {
  isTrustedAuthorizationContext,
  type AuthorizationContext,
} from "../../identity/authorizationContext";
import type { V2TenantContext } from "../../persistence/tenantContext";
import type { ExecutionRepository } from "./repository";

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

export function handleExecutionOperation(
  store: ExecutionRepository,
  operation: string,
  payload: Record<string, unknown>,
  authz: AuthorizationContext,
): V2GatewayResponse {
  if (!isTrustedAuthorizationContext(authz)) {
    return deniedUntrusted(authz);
  }

  const ctx = persistenceCtx(authz);

  if (operation === "createTripFromOrder") {
    const orderId = String(payload.orderId ?? "").trim();
    if (!orderId) {
      return {
        ok: false,
        code: "EXECUTION_INVALID",
        message: "createTripFromOrder requires orderId",
        correlationId: authz.correlationId,
      };
    }
    const existing = store.getTripByOrderId(ctx, orderId);
    if (existing) {
      return {
        ok: true,
        domain: "execution",
        operation,
        correlationId: authz.correlationId,
        data: { trip: existing },
      };
    }
    const trip = store.insertTrip(ctx, {
      id: `trip-${orderId}`,
      workspaceId: authz.workspaceId,
      orderId,
      status: "created",
    });
    return {
      ok: true,
      domain: "execution",
      operation,
      correlationId: authz.correlationId,
      data: { trip },
    };
  }

  if (operation === "getTrip") {
    const id = String(payload.id ?? "").trim();
    const trip = store.getTrip(ctx, id);
    if (!trip) {
      return {
        ok: false,
        code: "EXECUTION_NOT_FOUND",
        message: `trips id not found: ${id}`,
        correlationId: authz.correlationId,
      };
    }
    return {
      ok: true,
      domain: "execution",
      operation,
      correlationId: authz.correlationId,
      data: { trip },
    };
  }

  return {
    ok: false,
    code: "EXECUTION_UNKNOWN_OPERATION",
    message: operation,
    correlationId: authz.correlationId,
  };
}
