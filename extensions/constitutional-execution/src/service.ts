import { sha256Hex } from "./canonical-json.js";
import { ConstitutionalError } from "./errors.js";
import type {
  KchAuthorityBroker,
  KchAuthorityClaim,
  KchAuthorityPrepareParams,
} from "./kch-broker-client.js";
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

function metadataObject(record: ConstitutionalRecord, key: string): Record<string, unknown> | undefined {
  const value = record.metadata?.[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export class ConstitutionalExecutionService {
  readonly store: ConstitutionalStore;

  constructor(
    readonly config: ConstitutionalPluginConfig,
    private readonly gatewayRequest: GatewayRequest,
    private readonly authorityBroker?: KchAuthorityBroker,
  ) {
    this.store = new ConstitutionalStore(config.storePath);
  }

  private brokerParams(
    params: ConstitutionalExecuteParams,
    envelopeHash: string,
  ): KchAuthorityPrepareParams {
    const envelope = params.envelope;
    return {
      envelopeHash,
      leaseId: envelope.lease_id,
      reservationId: envelope.reservation_id,
      decisionId: envelope.decision_id,
      intentId: envelope.intent_id,
      policyHash: envelope.policy_hash,
      epoch: envelope.epoch,
      sessionId: envelope.session_id,
      toolName: envelope.executor_id,
      argsSha256: envelope.payload_hash,
      ttlSeconds: this.config.kchClaimTtlSeconds,
    };
  }

  private assertBrokerClaim(
    claim: KchAuthorityClaim,
    params: ConstitutionalExecuteParams,
    envelopeHash: string,
    expectedStatus: string,
    active: boolean,
  ): void {
    const envelope = params.envelope;
    const now = Date.now() / 1000;
    const maxAge = this.config.maxLiveAuthorityAgeMs / 1000;
    const futureSkew = this.config.clockSkewMs / 1000;
    const identityMatches =
      claim.envelopeHash === envelopeHash &&
      claim.leaseId === envelope.lease_id &&
      claim.reservationId === envelope.reservation_id &&
      claim.decisionId === envelope.decision_id &&
      claim.intentId === envelope.intent_id &&
      claim.policyHash === envelope.policy_hash &&
      claim.epoch === envelope.epoch &&
      claim.sessionId === envelope.session_id &&
      claim.toolName === envelope.executor_id &&
      claim.argsSha256 === envelope.payload_hash;
    const freshness =
      Number.isFinite(claim.verifiedAtUnix) &&
      claim.verifiedAtUnix <= now + futureSkew &&
      now - claim.verifiedAtUnix <= maxAge;
    if (
      !identityMatches ||
      !freshness ||
      claim.status !== expectedStatus ||
      claim.active !== active ||
      !claim.generation ||
      (expectedStatus === "PREPARED" && !claim.claimId)
    ) {
      throw new ConstitutionalError(
        "CONSTITUTION_LIVE_AUTHORITY_DENIED",
        "KCH authority claim does not match the executable envelope.",
        {
          details: {
            status: claim.status,
            generation: claim.generation,
            attestationLevel: claim.attestationLevel,
          },
        },
      );
    }
  }

  private authorityMetadata(claim: KchAuthorityClaim): Record<string, unknown> {
    return {
      claimId: claim.claimId,
      proposalId: claim.proposalId,
      status: claim.status,
      generation: claim.generation,
      verifiedAtUnix: claim.verifiedAtUnix,
      attestationLevel: claim.attestationLevel,
    };
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
      if (!this.authorityBroker) return toStatus(reserved.record);
      try {
        const shadow = await this.authorityBroker.verify(
          this.brokerParams(params, verified.envelopeHash),
        );
        const updated = await this.store.update(
          params.idempotencyKey,
          {
            metadata: mergedMetadata(reserved.record, {
              kchShadowAuthority: this.authorityMetadata(shadow),
              kchShadowActive: shadow.active,
            }),
          },
          "KCH_SHADOW_AUTHORITY_OBSERVED",
        );
        return toStatus(updated);
      } catch (error) {
        const updated = await this.store.update(
          params.idempotencyKey,
          {
            metadata: mergedMetadata(reserved.record, {
              kchShadowAuthorityError: String(error),
            }),
          },
          "KCH_SHADOW_AUTHORITY_UNAVAILABLE",
        );
        return toStatus(updated);
      }
    }

    if (!this.authorityBroker) {
      throw new ConstitutionalError(
        "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
        "Enforce mode requires the transactional KCH authority broker.",
        { retryable: true },
      );
    }

    if (!reserved.created && reserved.record.status !== "ACCEPTED") {
      return toStatus(reserved.record);
    }

    const envelope = params.envelope;
    if (envelope.executor_id !== "openclaw.agent" || envelope.capability !== "agent.run") {
      throw new ConstitutionalError(
        "CONSTITUTION_EXECUTOR_UNSUPPORTED",
        "The transactional v2 extension only dispatches openclaw.agent / agent.run.",
      );
    }

    const localClaim = await this.store.transitionStatus(
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
    if (!localClaim.transitioned) return toStatus(localClaim.record);

    let prepared: KchAuthorityClaim;
    try {
      validateExecuteParams(params, this.config);
      prepared = await this.authorityBroker.prepare(
        this.brokerParams(params, verified.envelopeHash),
      );
      this.assertBrokerClaim(prepared, params, verified.envelopeHash, "PREPARED", true);
      await this.store.update(
        params.idempotencyKey,
        {
          metadata: mergedMetadata(localClaim.record, {
            kchAuthority: this.authorityMetadata(prepared),
          }),
        },
        "KCH_AUTHORITY_PREPARED",
      );
    } catch (error) {
      if (
        error instanceof ConstitutionalError &&
        error.code === "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE"
      ) {
        await this.store.transitionStatus(
          params.idempotencyKey,
          ["DISPATCHING"],
          "ACCEPTED",
          {
            error: error.message,
            metadata: mergedMetadata(localClaim.record, {
              kchPrepareUnavailableAtUnix: Date.now() / 1000,
            }),
          },
        );
      } else {
        await this.store.setStatus(params.idempotencyKey, "FAILED", {
          error: String(error),
          completedAtUnix: Date.now() / 1000,
          metadata: mergedMetadata(localClaim.record, {
            kchPrepareDeniedAtUnix: Date.now() / 1000,
          }),
        });
      }
      throw error;
    }

    let committed: KchAuthorityClaim;
    try {
      committed = await this.authorityBroker.commit({
        claimId: prepared.claimId as string,
        envelopeHash: verified.envelopeHash,
        dispatchId: params.idempotencyKey,
      });
      this.assertBrokerClaim(committed, params, verified.envelopeHash, "COMMITTED", false);
    } catch (error) {
      if (
        error instanceof ConstitutionalError &&
        error.code === "CONSTITUTION_LIVE_AUTHORITY_DENIED"
      ) {
        return toStatus(
          await this.store.setStatus(params.idempotencyKey, "FAILED", {
            error: error.message,
            completedAtUnix: Date.now() / 1000,
            metadata: mergedMetadata(localClaim.record, {
              kchAuthority: this.authorityMetadata(prepared),
              kchCommitDeniedAtUnix: Date.now() / 1000,
            }),
          }),
        );
      }
      const uncertain = await this.store.setStatus(params.idempotencyKey, "IN_DOUBT", {
        error: String(error),
        metadata: mergedMetadata(localClaim.record, {
          kchAuthority: this.authorityMetadata(prepared),
          kchCommitUncertainAtUnix: Date.now() / 1000,
        }),
      });
      return toStatus(uncertain);
    }

    const payload = { ...envelope.payload, idempotencyKey: params.idempotencyKey };
    try {
      const acceptance = await this.gatewayRequest<Record<string, unknown>>("agent", payload, {
        scopes: ["operator.write"],
      });
      const runId = acceptance.runId;
      if (typeof runId !== "string" || !runId.trim()) {
        throw new ConstitutionalError(
          "CONSTITUTION_REMOTE_ERROR",
          "Gateway agent acceptance lacks runId.",
        );
      }
      const sessionKey =
        typeof acceptance.sessionKey === "string" ? acceptance.sessionKey : undefined;
      const acceptanceReceiptHash = sha256Hex(acceptance);

      let receipted: KchAuthorityClaim;
      try {
        receipted = await this.authorityBroker.receipt({
          claimId: committed.claimId as string,
          envelopeHash: verified.envelopeHash,
          runId,
          receiptHash: acceptanceReceiptHash,
        });
        this.assertBrokerClaim(receipted, params, verified.envelopeHash, "COMMITTED", false);
      } catch (error) {
        const uncertain = await this.store.setStatus(params.idempotencyKey, "IN_DOUBT", {
          runId,
          sessionKey,
          error: String(error),
          metadata: mergedMetadata(localClaim.record, {
            acceptance,
            acceptanceReceiptHash,
            kchAuthority: this.authorityMetadata(committed),
            kchReceiptUncertainAtUnix: Date.now() / 1000,
          }),
        });
        return toStatus(uncertain);
      }

      const updated = await this.store.setStatus(params.idempotencyKey, "RUNNING", {
        runId,
        sessionKey,
        error: undefined,
        metadata: mergedMetadata(localClaim.record, {
          acceptance,
          acceptanceReceiptHash,
          kchAuthority: this.authorityMetadata(receipted),
        }),
      });
      return toStatus(updated);
    } catch (error) {
      let indoubt: KchAuthorityClaim | undefined;
      try {
        indoubt = await this.authorityBroker.indoubt({
          claimId: committed.claimId as string,
          envelopeHash: verified.envelopeHash,
          reason: "Gateway dispatch returned no reliable acceptance: " + String(error),
        });
      } catch {
        // Local state still becomes IN_DOUBT; KCH authority was already consumed.
      }
      const uncertain = await this.store.setStatus(params.idempotencyKey, "IN_DOUBT", {
        error: String(error),
        metadata: mergedMetadata(localClaim.record, {
          uncertaintyRecordedAtUnix: Date.now() / 1000,
          kchAuthority: this.authorityMetadata(indoubt ?? committed),
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
        { timeoutMs: this.config.waitTimeoutMs + 5_000, scopes: ["operator.write"] },
      );
      const status = terminalStatus(payload);
      const terminal = ["SUCCEEDED", "FAILED", "TIMEOUT"].includes(status);
      const output = status === "SUCCEEDED" ? payload : undefined;

      if (record.status === "IN_DOUBT" && this.authorityBroker) {
        const kch = metadataObject(record, "kchAuthority");
        const claimId = typeof kch?.claimId === "string" ? kch.claimId : undefined;
        const acceptanceReceiptHash =
          typeof record.metadata?.acceptanceReceiptHash === "string"
            ? record.metadata.acceptanceReceiptHash
            : undefined;
        if (claimId && acceptanceReceiptHash) {
          try {
            await this.authorityBroker.receipt({
              claimId,
              envelopeHash: record.envelopeHash,
              runId: record.runId,
              receiptHash: acceptanceReceiptHash,
            });
          } catch {
            return toStatus(
              await this.store.setStatus(idempotencyKey, "IN_DOUBT", {
                error: "Remote run is observable but KCH receipt binding remains unresolved.",
                metadata: mergedMetadata(record, { terminalEvidence: payload }),
              }),
            );
          }
        }
      }

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
    if (!this.authorityBroker) {
      throw new ConstitutionalError(
        "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
        "KCH authority broker is required for reconciliation.",
        { retryable: true },
      );
    }
    const kch = metadataObject(current, "kchAuthority");
    const claimId = typeof kch?.claimId === "string" ? kch.claimId : undefined;
    if (!claimId) {
      throw new ConstitutionalError(
        "CONSTITUTION_LIVE_AUTHORITY_DENIED",
        "No KCH claim is bound to this uncertain execution.",
      );
    }
    await this.authorityBroker.receipt({
      claimId,
      envelopeHash: current.envelopeHash,
      runId: params.runId,
      receiptHash: params.receiptHash,
    });
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
          acceptanceReceiptHash: params.receiptHash,
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
    const transition = await this.store.transitionStatus(
      params.idempotencyKey,
      ["SHADOW_ACCEPTED", "ACCEPTED", "DISPATCHING", "RUNNING", "IN_DOUBT"],
      "CANCEL_REQUESTED",
      {
        error: "Cancellation requested but not dispatched: " + params.reason,
        metadata: mergedMetadata(record, {
          cancellationRequestedAtUnix: Date.now() / 1000,
        }),
      },
    );
    throw new ConstitutionalError(
      "CONSTITUTION_CANCEL_UNAVAILABLE",
      transition.transitioned
        ? "Cancellation is recorded but fail-closed until the exact Gateway abort mapping is audited."
        : "Cancellation cannot supersede an existing terminal or prior cancellation state.",
      { details: { status: toStatus(transition.record) } },
    );
  }
}
