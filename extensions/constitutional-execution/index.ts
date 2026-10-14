import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { resolveConstitutionalConfig } from "./src/config.js";
import { ConstitutionalError } from "./src/errors.js";
import { ConstitutionalExecutionService } from "./src/service.js";
import type {
  ConstitutionalCancelParams,
  ConstitutionalExecuteParams,
} from "./src/types.js";

type GatewayErrorShape = {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
};

function gatewayErrorShape(error: unknown): GatewayErrorShape {
  if (error instanceof ConstitutionalError) {
    return {
      code: error.retryable ? "UNAVAILABLE" : "INVALID_REQUEST",
      message: error.message,
      retryable: error.retryable,
      details: { code: error.code, ...error.details },
    };
  }
  return {
    code: "INTERNAL_ERROR",
    message: "Constitutional execution failed closed.",
    retryable: false,
    details: { code: "CONSTITUTION_REMOTE_ERROR" },
  };
}

export default definePluginEntry({
  id: "constitutional-execution",
  name: "CFL–KCH Constitutional Execution",
  description: "Shadow-first, intent-bound constitutional execution over the Gateway agent path",
  register(api) {
    const config = resolveConstitutionalConfig(api.pluginConfig);
    const service = new ConstitutionalExecutionService(
      config,
      (method, params, options) => api.runtime.gateway.request(method, params, options),
    );

    api.registerGatewayMethod(
      "constitutional.execute",
      async ({ params, respond }) => {
        try {
          respond(true, await service.execute(params as ConstitutionalExecuteParams));
        } catch (error) {
          respond(false, undefined, gatewayErrorShape(error));
        }
      },
      { scope: "operator.admin" },
    );

    api.registerGatewayMethod(
      "constitutional.status",
      async ({ params, respond }) => {
        try {
          const idempotencyKey =
            typeof params.idempotencyKey === "string" ? params.idempotencyKey : "";
          if (!idempotencyKey) {
            throw new ConstitutionalError(
              "CONSTITUTION_INVALID",
              "idempotencyKey is required.",
            );
          }
          respond(true, await service.status(idempotencyKey));
        } catch (error) {
          respond(false, undefined, gatewayErrorShape(error));
        }
      },
      { scope: "operator.admin" },
    );

    api.registerGatewayMethod(
      "constitutional.cancel",
      async ({ params, respond }) => {
        try {
          respond(true, await service.cancel(params as ConstitutionalCancelParams));
        } catch (error) {
          respond(false, undefined, gatewayErrorShape(error));
        }
      },
      { scope: "operator.admin" },
    );

    api.logger.info(
      `constitutional-execution registered (${config.enabled ? config.mode : "disabled"})`,
    );
  },
});
