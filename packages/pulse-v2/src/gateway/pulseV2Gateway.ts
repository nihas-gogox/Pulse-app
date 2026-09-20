import { createCommerceStore } from "../domains/commerce/store";
import { handleCommerceOperation } from "../domains/commerce/api";
import { createExecutionStore } from "../domains/execution/store";
import { handleExecutionOperation } from "../domains/execution/api";
import { assertV2EnvironmentIsolated } from "../env/v2SupabaseEnv";
import type {
  V2Execute,
  V2GatewayRequest,
  V2GatewayResponse,
} from "./types";

/**
 * In-process API/Gateway façade. No HTTP. No Kafka. No separate deployable.
 * Cross-domain work is execute() only — never another domain's tables.
 */
export function createPulseV2Gateway(env: NodeJS.Dict<string> = process.env) {
  const dataPlane = assertV2EnvironmentIsolated(env);
  const commerce = createCommerceStore();
  const execution = createExecutionStore();

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
        commerce,
        execute,
        request.operation,
        request.payload,
        correlationId,
      );
    }
    if (request.domain === "execution") {
      return handleExecutionOperation(
        execution,
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

  return { execute, dataPlane };
}

export type PulseV2Gateway = ReturnType<typeof createPulseV2Gateway>;
