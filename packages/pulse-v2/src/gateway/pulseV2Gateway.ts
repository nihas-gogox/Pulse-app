import { handleCommerceOperation } from "../domains/commerce/api";
import { handleExecutionOperation } from "../domains/execution/api";
import { assertV2PersistenceConfig } from "../env/v2SupabaseEnv";
import type { AuthorizationContext } from "../identity/authorizationContext";
import type { CreateWorkspaceResult, IdentityPort } from "../identity/identityPort";
import { createV2Persistence } from "../persistence/createPersistence";
import type {
  V2CreateWorkspaceRequest,
  V2CreateWorkspaceResponse,
  V2Execute,
  V2GatewayError,
  V2GatewayRequest,
  V2GatewayResponse,
} from "./types";

export type PulseV2GatewayOptions = {
  identityPort: IdentityPort;
};

function deny(
  code: string,
  message: string,
  correlationId: string,
): V2GatewayError {
  return { ok: false, code, message, correlationId };
}

function resolveAuthorizationContext(
  identityPort: IdentityPort,
  request: V2GatewayRequest,
  correlationId: string,
): V2GatewayResponse | AuthorizationContext {
  const proofValue = request.identityProof?.trim() ?? "";
  const actorResolved = identityPort.resolveActor({ value: proofValue });
  if (!actorResolved.ok) {
    return deny(
      "V2_UNAUTHENTICATED",
      `actor resolution failed: ${actorResolved.reason}`,
      correlationId,
    );
  }

  const trustedActorId = actorResolved.actorId;
  const claimedActorId = request.actorId?.trim() ?? "";
  if (claimedActorId && claimedActorId !== trustedActorId) {
    return deny(
      "V2_ACTOR_DENIED",
      "caller actorId is not authorization authority",
      correlationId,
    );
  }

  const resolved = identityPort.resolveMembership({
    actorId: trustedActorId,
    membershipId: request.membershipId?.trim() || undefined,
  });
  if (!resolved.ok) {
    return deny(
      "V2_MEMBERSHIP_DENIED",
      `membership resolution failed: ${resolved.reason}`,
      correlationId,
    );
  }
  if (resolved.membership.actorId !== trustedActorId) {
    return deny(
      "V2_MEMBERSHIP_DENIED",
      "membership is not bound to trusted Actor",
      correlationId,
    );
  }

  const trustedWorkspaceId = resolved.membership.workspaceId;
  const payloadWorkspaceId = String(request.payload.workspaceId ?? "").trim();
  if (payloadWorkspaceId && payloadWorkspaceId !== trustedWorkspaceId) {
    return deny(
      "V2_WORKSPACE_DENIED",
      "payload workspaceId is not authorization authority",
      correlationId,
    );
  }

  return {
    actorId: resolved.membership.actorId,
    membershipId: resolved.membership.membershipId,
    workspaceId: trustedWorkspaceId,
    correlationId,
  };
}

/**
 * In-process API/Gateway façade. No HTTP. Not a database access layer.
 * One resolveActor + one resolveMembership per public execute(); nested dispatch reuses context.
 * request.actorId is never Actor authority.
 */
export function createPulseV2Gateway(
  env: NodeJS.Dict<string> = process.env,
  options: PulseV2GatewayOptions,
) {
  const config = assertV2PersistenceConfig(env);
  const persistence = createV2Persistence(config);

  const dispatch = (
    request: V2GatewayRequest,
    ctx: AuthorizationContext,
  ): V2GatewayResponse => {
    const nestedExecute: V2Execute = (inner) => dispatch(inner, ctx);

    if (request.domain === "commerce") {
      return handleCommerceOperation(
        persistence.commerce,
        nestedExecute,
        request.operation,
        request.payload,
        ctx,
      );
    }
    if (request.domain === "execution") {
      return handleExecutionOperation(
        persistence.execution,
        request.operation,
        request.payload,
        ctx,
      );
    }
    return deny("V2_GATEWAY_UNKNOWN_DOMAIN", String(request.domain), ctx.correlationId);
  };

  const execute: V2Execute = (request: V2GatewayRequest): V2GatewayResponse => {
    const correlationId = request.correlationId.trim();
    if (!correlationId) {
      return deny("V2_GATEWAY_INVALID", "correlationId is required", "");
    }

    const ctx = resolveAuthorizationContext(options.identityPort, request, correlationId);
    if ("ok" in ctx) return ctx;

    return dispatch(request, ctx);
  };

  const createWorkspace = (
    request: V2CreateWorkspaceRequest,
  ): V2CreateWorkspaceResponse => {
    const correlationId = request.correlationId.trim();
    if (!correlationId) {
      return deny("V2_GATEWAY_INVALID", "correlationId is required", "");
    }
    const idempotencyKey = request.idempotencyKey.trim();
    if (!idempotencyKey) {
      return deny("V2_GATEWAY_INVALID", "idempotencyKey is required", correlationId);
    }
    const identityProof = request.identityProof.trim();
    if (!identityProof) {
      return deny("V2_GATEWAY_INVALID", "identityProof is required", correlationId);
    }

    const actorResolved = options.identityPort.resolveActor({ value: identityProof });
    if (!actorResolved.ok) {
      return deny(
        "V2_UNAUTHENTICATED",
        `actor resolution failed: ${actorResolved.reason}`,
        correlationId,
      );
    }

    const identityResult: CreateWorkspaceResult = options.identityPort.createWorkspace({
      actorId: actorResolved.actorId,
      correlationId,
      idempotencyKey,
    });
    if (!identityResult.ok) {
      return deny(
        "V2_WORKSPACE_CREATE_FAILED",
        `workspace creation failed: ${identityResult.reason}`,
        correlationId,
      );
    }

    return {
      ok: true,
      workspaceId: identityResult.workspaceId,
      membershipId: identityResult.membershipId,
      actorId: identityResult.actorId,
      membershipStatus: identityResult.membershipStatus,
      correlationId,
    };
  };

  return {
    execute,
    createWorkspace,
    dataPlane: { mode: config.mode, supabaseUrl: config.supabaseUrl },
  };
}

export type PulseV2Gateway = ReturnType<typeof createPulseV2Gateway>;
