import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { resolveConstitutionalConfig } from "./src/config.js";
import { ConstitutionalError } from "./src/errors.js";
import { ConstitutionalExecutionService } from "./src/service.js";
import type {
  ConstitutionalCancelParams,
  ConstitutionalExecuteParams,
} from "./src/types.js";

function respondError(
  respond: (ok: boolean, payload?: unknown, error?: unknown) => void,
  error: unknown,
): void {
  if (error instanceof ConstitutionalError) {
    respond(false, undefined, {
      code: error.retryable ? "UNAVAILABLE" : "INVALID_REQUEST",
      message: error.message,
      retryable: error.retryable,
      details: { code: error.code, ...error.details },
    });
    return;
  }
  respond(false, undefined, {
    code: "INTERNAL_ERROR",
    message: "Constitutional execution failed closed.",
    retryable: false,
    details: { code: "CONSTITUTION_REMOTE_ERROR" },
  });
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
          respondError(respond, error);
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
          respondError(respond, error);
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
          respondError(respond, error);
        }
      },
      { scope: "operator.admin" },
    );

    api.registerService({
      id: "constitutional-execution-recovery",
      async start() {
        if (!config.enabled || config.mode !== "enforce") return;
        const summary = await service.recoverPending();
        api.logger.info(
          `constitutional-execution recovery: discovered=${summary.discovered} ` +
            `running=${summary.running} in_doubt=${summary.inDoubt} failed=${summary.failed}`,
        );
      },
      async stop() {
        await service.close();
      },
    });

    api.logger.info(
      `constitutional-execution registered (${config.enabled ? config.mode : "disabled"})`,
    );
  },
});
