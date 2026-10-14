import { sha256Hex } from "./canonical-json.js";
import { ConstitutionalError } from "./errors.js";
import { ConstitutionalStore } from "./store.js";
import type {
  ConstitutionalCancelParams,
  ConstitutionalExecuteParams,
  ConstitutionalPluginConfig,
  ConstitutionalReconcileParams,
  ConstitutionalRecord,
  ConstitutionalStatus,
  ConstitutionalStatusValue,
  GatewayRequest,
} from "./types.js";
import {
  validateCancelParams,
  validateExecuteParams,
  validateReconcileParams,
} from "./validator.js";

function toStatus(record: ConstitutionalRecord): ConstitutionalStatus {
  return {
    idempotencyKey: record.idempotencyKey,
    status: record.status,
    mode: record.mode,
    envelopeHash: record.envelopeHash,
    payloadHash: record.payloadHash,
    runId: record.runId,
    sessionKey: record.sessionKey,
    output: record.output,
    outputHash: record.outputHash,
    error: record.error,
    createdAtUnix: record.createdAtUnix,
    updatedAtUnix: record.updatedAtUnix,
    completedAtUnix: record.completedAtUnix,
    metadata: record.metadata,
  };
}

function terminalStatus(payload: Record<string, unknown>): ConstitutionalStatusValue {
  const status = String(payload.status ?? "").toLowerCase();
  if (["ok", "succeeded", "success", "completed"].includes(status)) return "SUCCEEDED";
  if (["error", "failed", "cancelled", "denied"].includes(status)) return "FAILED";
  if (status === "timeout") {
    return ["endedAt", "stopReason", "terminalReceipt", "error"].some((key) => key in payload)
      ? "TIMEOUT"
      : "RUNNING";
  }
  if (["in_flight", "running", "accepted", "queued"].includes(status)) return "RUNNING";
  return "IN_DOUBT";
}

function mergedMetadata(
  record: ConstitutionalRecord,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(record.metadata ?? {}), ...patch };
}

export class ConstitutionalExecutionService {
  readonly store: ConstitutionalStore;

  constructor(
    readonly config: ConstitutionalPluginConfig,
    private readonly gatewayRequest: GatewayRequest,
  ) {
    this.store = new ConstitutionalStore(config.storePath);
  }

  async execute(params: ConstitutionalExecuteParams): Promise<ConstitutionalStatus> {
    const verified = validateExecuteParams(params, this.config);
    const reserved = await this.store.reserve({
      idempotencyKey: params.idempotencyKey,
      envelopeHash: verified.envelopeHash,
      payloadHash: verified.payloadHash,
      mode: this.config.mode,
    });
    if (this.config.mode === "shadow") {
      return toStatus(reserved.record);
    }
    if (!reserved.created && reserved.record.status !== "ACCEPTED") {
      return toStatus(reserved.record);
    }

    const envelope = params.envelope;
    if (envelope.executor_id !== "openclaw.agent" || envelope.capability !== "agent.run") {
      throw new ConstitutionalError(
        "CONSTITUTION_EXECUTOR_UNSUPPORTED",
        "The native v1 extension only dispatches openclaw.agent / agent.run.",
      );
    }

    const claim = await this.store.transitionStatus(
      params.idempotencyKey,
      ["ACCEPTED"],
      "DISPATCHING",
      {
        error: undefined,
        metadata: mergedMetadata(reserved.record, {
          dispatchStartedAtUnix: Date.now() / 1000,
        }),
      },
    );
    if (!claim.transitioned) {
      return toStatus(claim.record);
    }

    const payload = { ...envelope.payload, idempotencyKey: params.idempotencyKey };
    try {
      const acceptance = await this.gatewayRequest<Record<string, unknown>>(
        "agent",
        payload,
        { scopes: ["operator.write"] },
      );
      const runId = acceptance.runId;
      if (typeof runId !== "string" || !runId.trim()) {
        throw new ConstitutionalError(
          "CONSTITUTION_REMOTE_ERROR",
          "Gateway agent acceptance lacks runId.",
        );
      }
      const sessionKey = typeof acceptance.sessionKey === "string" ? acceptance.sessionKey : undefined;
      const updated = await this.store.setStatus(params.idempotencyKey, "RUNNING", {
        runId,
        sessionKey,
        error: undefined,
        metadata: mergedMetadata(claim.record, { acceptance }),
      });
      return toStatus(updated);
    } catch (error) {
      const uncertain = await this.store.setStatus(params.idempotencyKey, "IN_DOUBT", {
        error: String(error),
        metadata: mergedMetadata(claim.record, {
          uncertaintyRecordedAtUnix: Date.now() / 1000,
        }),
      });
      return toStatus(uncertain);
    }
  }

  async status(idempotencyKey: string): Promise<ConstitutionalStatus> {
    const record = await this.store.get(idempotencyKey);
    if (!record) {
      return { idempotencyKey, status: "UNKNOWN", mode: this.config.mode };
    }
    if (!record.runId || !["RUNNING", "IN_DOUBT"].includes(record.status)) {
      return toStatus(record);
    }
    try {
      const payload = await this.gatewayRequest<Record<string, unknown>>(
        "agent.wait",
        { runId: record.runId, timeoutMs: this.config.waitTimeoutMs },
        { timeoutMs: this.config.waitTimeoutMs + 5_000, scopes: ["operator.read"] },
      );
      const status = terminalStatus(payload);
      const terminal = ["SUCCEEDED", "FAILED", "TIMEOUT"].includes(status);
      const output = status === "SUCCEEDED" ? payload : undefined;
      const updated = await this.store.setStatus(idempotencyKey, status, {
        output,
        outputHash: output === undefined ? undefined : sha256Hex(output),
        error:
          status === "FAILED" || status === "TIMEOUT"
            ? String(payload.error ?? payload.stopReason ?? status)
            : undefined,
        completedAtUnix: terminal ? Date.now() / 1000 : undefined,
        metadata: mergedMetadata(record, { terminal: payload }),
      });
      return toStatus(updated);
    } catch (error) {
      const updated = await this.store.setStatus(idempotencyKey, "IN_DOUBT", {
        error: String(error),
        metadata: mergedMetadata(record, {
          statusUncertaintyRecordedAtUnix: Date.now() / 1000,
        }),
      });
      return toStatus(updated);
    }
  }

  async reconcile(params: ConstitutionalReconcileParams): Promise<ConstitutionalStatus> {
    validateReconcileParams(params, this.config);
    const current = await this.store.get(params.idempotencyKey);
    if (!current) {
      throw new ConstitutionalError("CONSTITUTION_UNKNOWN", "Unknown constitutional execution.");
    }
    if (!["DISPATCHING", "IN_DOUBT"].includes(current.status)) {
      return toStatus(current);
    }
    if (current.runId && current.runId !== params.runId) {
      throw new ConstitutionalError(
        "CONSTITUTION_IDEMPOTENCY_CONFLICT",
        "Reconciliation runId conflicts with the persisted remote run.",
      );
    }
    const transitioned = await this.store.transitionStatus(
      params.idempotencyKey,
      ["DISPATCHING", "IN_DOUBT"],
      "RUNNING",
      {
        runId: params.runId,
        sessionKey: params.sessionKey ?? current.sessionKey,
        error: undefined,
        metadata: mergedMetadata(current, {
          reconciledAtUnix: Date.now() / 1000,
          reconciliationReason: params.reason,
        }),
      },
    );
    return toStatus(transitioned.record);
  }

  async cancel(params: ConstitutionalCancelParams): Promise<ConstitutionalStatus> {
    validateCancelParams(params, this.config);
    const record = await this.store.get(params.idempotencyKey);
    if (!record) {
      throw new ConstitutionalError("CONSTITUTION_UNKNOWN", "Unknown constitutional execution.");
    }
    const updated = await this.store.setStatus(params.idempotencyKey, "CANCEL_REQUESTED", {
      error: `Cancellation requested but not dispatched: ${params.reason}`,
      metadata: mergedMetadata(record, {
        cancellationRequestedAtUnix: Date.now() / 1000,
      }),
    });
    throw new ConstitutionalError(
      "CONSTITUTION_CANCEL_UNAVAILABLE",
      "Cancellation is recorded but fail-closed until the exact Gateway abort mapping is audited.",
      { details: { status: toStatus(updated) } },
    );
  }
}
