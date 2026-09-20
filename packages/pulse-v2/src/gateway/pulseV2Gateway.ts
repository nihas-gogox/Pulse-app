import { handleCommerceOperation } from "../domains/commerce/api";
import { handleExecutionOperation } from "../domains/execution/api";
import { assertV2PersistenceConfig } from "../env/v2SupabaseEnv";
import { createV2Persistence } from "../persistence/createPersistence";
import type {
  V2Execute,
  V2GatewayRequest,
  V2GatewayResponse,
} from "./types";

/**
 * In-process API/Gateway façade. No HTTP. Not a database access layer.
 * Persistence is injected per domain; Gateway only routes execute().
 */
export function createPulseV2Gateway(env: NodeJS.Dict<string> = process.env) {
  const config = assertV2PersistenceConfig(env);
  const persistence = createV2Persistence(config);

  const execute: V2Execute = (request: V2GatewayRequest): V2GatewayResponse => {
    const correlationId = request.correlationId.trim();
    if (!correlationId) {
      return {
        ok: false,
        code: "V2_GATEWAY_INVALID",
        message: "correlationId is required",
        correlationId: "",
      };
    }

    if (request.domain === "commerce") {
      return handleCommerceOperation(
        persistence.commerce,
        execute,
        request.operation,
        request.payload,
        correlationId,
      );
    }
    if (request.domain === "execution") {
      return handleExecutionOperation(
        persistence.execution,
        request.operation,
        request.payload,
        correlationId,
      );
    }
    return {
      ok: false,
      code: "V2_GATEWAY_UNKNOWN_DOMAIN",
      message: String(request.domain),
      correlationId,
    };
  };

  return { execute, dataPlane: { mode: config.mode, supabaseUrl: config.supabaseUrl } };
}

export type PulseV2Gateway = ReturnType<typeof createPulseV2Gateway>;
