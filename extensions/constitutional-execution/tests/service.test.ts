import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../src/canonical-json.js";
import { ConstitutionalError } from "../src/errors.js";
import type {
  KchAuthorityBroker,
  KchAuthorityClaim,
  KchAuthorityPrepareParams,
} from "../src/kch-broker-client.js";
import { ConstitutionalExecutionService } from "../src/service.js";
import type {
  ConstitutionalCancelParams,
  ConstitutionalCommandEnvelope,
  ConstitutionalExecuteParams,
  ConstitutionalPluginConfig,
  ConstitutionalReconcileParams,
  GatewayRequest,
} from "../src/types.js";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const policyHash = "a".repeat(64);
const hostId = "kwantau-test-host";

async function tempStore() {
  return mkdtemp(join(tmpdir(), "constitutional-execution-"));
}

function config(
  storePath: string,
  mode: "shadow" | "enforce" = "enforce",
): ConstitutionalPluginConfig {
  return {
    enabled: true,
    mode,
    storePath,
    hostId,
    activePolicyHash: policyHash,
    maxIntentAgeMs: 300_000,
    maxLeaseDurationMs: 300_000,
    maxLiveAuthorityAgeMs: 5_000,
    liveAuthorityVerifierMethod: "kch.authority.verify",
    kchAuthorityBrokerCommand: "/opt/kch/bin/kch-kwantau-authority",
    kchAuthorityDatabase: "/var/lib/kch/kch_native_r21.sqlite",
    kchAuthorityBrokerTimeoutMs: 2_000,
    kchClaimTtlSeconds: 5,
    clockSkewMs: 30_000,
    minimumEpoch: 0,
    revokedLeaseIds: [],
    waitTimeoutMs: 10,
    allowedKeys: [{ keyId: "test-key", publicKeyPem, enabled: true }],
    allowedExecutors: ["openclaw.agent"],
    allowedCapabilities: ["agent.run"],
    allowedContractHashes: ["e".repeat(64)],
    allowedSessionPrefixes: ["agent:test:"],
    maxBudget: { tokens: 4096, seconds: 120 },
  };
}

function envelope(
  overrides: Partial<ConstitutionalCommandEnvelope> = {},
): ConstitutionalCommandEnvelope {
  const now = Date.now() / 1000;
  const payload = {
    message: "Return exactly READY.",
    sessionKey: "agent:test:main",
    deliver: false,
    modelRun: true,
  };
  return {
    command_id: "cmd-1",
    reservation_id: "reservation-1",
    intent_id: "intent-1",
    lease_id: "lease-1",
    decision_id: "decision-1",
    candidate_id: "candidate-1",
    permission_id: "permission-1",
    support_certificate_id: "support-1",
    assurance_id: "assurance-1",
    idempotency_key: "idem-1",
    executor_id: "openclaw.agent",
    capability: "agent.run",
    payload,
    payload_hash: sha256Hex(payload),
    schema_hash: "b".repeat(64),
    code_hash: "c".repeat(64),
    environment_hash: "d".repeat(64),
    policy_hash: policyHash,
    contract_hash: "e".repeat(64),
    host_id: hostId,
    session_id: "agent:test:main",
    scope: { session: "agent:test:main" },
    budget: { tokens: 512, seconds: 30 },
    epoch: 7,
    created_at_unix: now,
    expires_at_unix: now + 120,
    ...overrides,
  };
}

function executeParams(value = envelope()): ConstitutionalExecuteParams {
  const signedHash = sha256Hex(value);
  return {
    idempotencyKey: value.idempotency_key,
    envelope: value,
    authorityProof: {
      algorithm: "Ed25519",
      keyId: "test-key",
      signedHash,
      signatureBase64: sign(null, Buffer.from(signedHash, "hex"), privateKey).toString("base64"),
    },
  };
}

function signedOperation<T extends Record<string, unknown>>(
  intent: T,
): ConstitutionalCancelParams["authorityProof"] {
  const signedHash = sha256Hex(intent);
  return {
    algorithm: "Ed25519",
    keyId: "test-key",
    signedHash,
    signatureBase64: sign(null, Buffer.from(signedHash, "hex"), privateKey).toString("base64"),
  };
}

function cancelParams(idempotencyKey: string, reason: string): ConstitutionalCancelParams {
  return {
    idempotencyKey,
    reason,
    authorityProof: signedOperation({
      operation: "constitutional.cancel",
      idempotencyKey,
      reason,
      policyHash,
      hostId,
    }),
  };
}

function reconcileParams(
  idempotencyKey: string,
  runId: string,
  receiptHash: string,
  reason: string,
): ConstitutionalReconcileParams {
  const sessionKey = "agent:test:main";
  return {
    idempotencyKey,
    runId,
    receiptHash,
    sessionKey,
    reason,
    authorityProof: signedOperation({
      operation: "constitutional.reconcile",
      idempotencyKey,
      runId,
      receiptHash,
      sessionKey,
      reason,
      policyHash,
      hostId,
    }),
  };
}

function claim(
  params: KchAuthorityPrepareParams,
  status: string,
  active: boolean,
  suffix = "1",
): KchAuthorityClaim {
  return {
    active,
    claimId: "claim-" + suffix,
    proposalId: "proposal-" + suffix,
    status,
    envelopeHash: params.envelopeHash,
    leaseId: params.leaseId,
    reservationId: params.reservationId,
    decisionId: params.decisionId,
    intentId: params.intentId,
    policyHash: params.policyHash,
    epoch: params.epoch,
    sessionId: params.sessionId,
    toolName: params.toolName,
    argsSha256: params.argsSha256,
    generation: "generation-" + status.toLowerCase(),
    verifiedAtUnix: Date.now() / 1000,
    attestationLevel: "KCH_AUTHORIZATION_" + status,
  };
}

function brokerMock(order: string[] = []) {
  let preparedParams: KchAuthorityPrepareParams | undefined;
  const calls: string[] = [];
  const broker: KchAuthorityBroker = {
    async verify(params) {
      calls.push("verify");
      order.push("kch.verify");
      return claim(params, "AUTHORIZED_AVAILABLE", true);
    },
    async prepare(params) {
      calls.push("prepare");
      order.push("kch.prepare");
      preparedParams = params;
      return claim(params, "PREPARED", true);
    },
    async commit(params) {
      calls.push("commit");
      order.push("kch.commit");
      if (!preparedParams) throw new Error("prepare missing");
      expect(params.dispatchId).toBe("idem-1");
      return claim(preparedParams, "COMMITTED", false);
    },
    async receipt(params) {
      calls.push("receipt");
      order.push("kch.receipt");
      if (!preparedParams) throw new Error("prepare missing");
      expect(params.runId).toBeTruthy();
      expect(params.receiptHash).toMatch(/^[a-f0-9]{64}$/);
      return claim(preparedParams, "COMMITTED", false);
    },
    async abort() {
      calls.push("abort");
      order.push("kch.abort");
      if (!preparedParams) throw new Error("prepare missing");
      return claim(preparedParams, "ABORTED", false);
    },
    async indoubt() {
      calls.push("indoubt");
      order.push("kch.indoubt");
      if (!preparedParams) throw new Error("prepare missing");
      return claim(preparedParams, "IN_DOUBT", false);
    },
    async status() {
      calls.push("status");
      order.push("kch.status");
      if (!preparedParams) throw new Error("prepare missing");
      return claim(preparedParams, "COMMITTED", false);
    },
  };
  return { broker, calls };
}

function gatewayMock(order: string[] = []) {
  const calls: Array<{ method: string; params: unknown; options: unknown }> = [];
  const request: GatewayRequest = async <T>(
    method: string,
    params?: Record<string, unknown>,
    options?: unknown,
  ) => {
    calls.push({ method, params, options });
    order.push("gateway." + method);
    if (method === "agent") {
      return { runId: "run-1", sessionKey: "agent:test:main", status: "in_flight" } as T;
    }
    if (method === "agent.wait") {
      return {
        status: "ok",
        endedAt: Date.now(),
        terminalReceipt: { runId: "run-1", status: "ok" },
      } as T;
    }
    throw new Error("unexpected method " + method);
  };
  return { request, calls };
}

describe("transactional KCH constitutional execution", () => {
  it("orders KCH prepare and commit before agent, then binds the acceptance receipt", async () => {
    const order: string[] = [];
    const gateway = gatewayMock(order);
    const kch = brokerMock(order);
    const service = new ConstitutionalExecutionService(
      config(await tempStore()),
      gateway.request,
      kch.broker,
    );
    const result = await service.execute(executeParams());
    expect(result.status).toBe("RUNNING");
    expect(result.runId).toBe("run-1");
    expect(order).toEqual(["kch.prepare", "kch.commit", "gateway.agent", "kch.receipt"]);
  });

  it("rejects payload mutation before KCH or Gateway side effects", async () => {
    const gateway = gatewayMock();
    const kch = brokerMock();
    const value = envelope();
    value.payload = { ...value.payload, message: "MUTATED" };
    const service = new ConstitutionalExecutionService(
      config(await tempStore()),
      gateway.request,
      kch.broker,
    );
    await expect(service.execute(executeParams(value))).rejects.toMatchObject({
      code: "CONSTITUTION_INVALID",
    });
    expect(kch.calls).toHaveLength(0);
    expect(gateway.calls).toHaveLength(0);
  });

  it("replays the same envelope without consuming or dispatching twice", async () => {
    const gateway = gatewayMock();
    const kch = brokerMock();
    const service = new ConstitutionalExecutionService(
      config(await tempStore()),
      gateway.request,
      kch.broker,
    );
    const params = executeParams();
    await service.execute(params);
    await service.execute(params);
    expect(kch.calls.filter((item) => item === "prepare")).toHaveLength(1);
    expect(kch.calls.filter((item) => item === "commit")).toHaveLength(1);
    expect(gateway.calls.filter((call) => call.method === "agent")).toHaveLength(1);
  });

  it("never calls agent if KCH prepare is unavailable", async () => {
    const gateway = gatewayMock();
    const kch = brokerMock();
    kch.broker.prepare = async () => {
      throw new ConstitutionalError(
        "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
        "broker unavailable",
        { retryable: true },
      );
    };
    const service = new ConstitutionalExecutionService(
      config(await tempStore()),
      gateway.request,
      kch.broker,
    );
    await expect(service.execute(executeParams())).rejects.toMatchObject({
      code: "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
    });
    expect(gateway.calls.filter((call) => call.method === "agent")).toHaveLength(0);
    expect((await service.store.get("idem-1"))?.status).toBe("ACCEPTED");
  });

  it("never calls agent when KCH commit is uncertain", async () => {
    const gateway = gatewayMock();
    const kch = brokerMock();
    kch.broker.commit = async () => {
      throw new ConstitutionalError(
        "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
        "commit response lost",
        { retryable: true },
      );
    };
    const service = new ConstitutionalExecutionService(
      config(await tempStore()),
      gateway.request,
      kch.broker,
    );
    const result = await service.execute(executeParams());
    expect(result.status).toBe("IN_DOUBT");
    expect(gateway.calls.filter((call) => call.method === "agent")).toHaveLength(0);
  });

  it("quarantines remote acceptance when the KCH receipt cannot be bound", async () => {
    const gateway = gatewayMock();
    const kch = brokerMock();
    kch.broker.receipt = async () => {
      throw new ConstitutionalError(
        "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
        "receipt store unavailable",
        { retryable: true },
      );
    };
    const service = new ConstitutionalExecutionService(
      config(await tempStore()),
      gateway.request,
      kch.broker,
    );
    const result = await service.execute(executeParams());
    expect(result.status).toBe("IN_DOUBT");
    expect(result.runId).toBe("run-1");
    expect(gateway.calls.filter((call) => call.method === "agent")).toHaveLength(1);
  });

  it("marks consumed KCH authority IN_DOUBT when the Gateway acceptance is lost", async () => {
    const kch = brokerMock();
    const request: GatewayRequest = async () => {
      throw new Error("acceptance response lost");
    };
    const service = new ConstitutionalExecutionService(
      config(await tempStore()),
      request,
      kch.broker,
    );
    const first = await service.execute(executeParams());
    expect(first.status).toBe("IN_DOUBT");
    expect(kch.calls).toContain("indoubt");
    const second = await service.execute(executeParams());
    expect(second.status).toBe("IN_DOUBT");
    expect(kch.calls.filter((item) => item === "commit")).toHaveLength(1);
  });

  it("requires an observed signed receipt hash to reconcile an uncertain run", async () => {
    const kch = brokerMock();
    let dispatchAttempted = false;
    const remote = {
      status: "ok",
      endedAt: 123456,
      terminalReceipt: { runId: "run-recovered", status: "ok" },
    };
    const request: GatewayRequest = async <T>(method: string) => {
      if (method === "agent") {
        dispatchAttempted = true;
        throw new Error("acceptance response lost");
      }
      if (method === "agent.wait" && dispatchAttempted) return remote as T;
      throw new Error("unexpected method");
    };
    const service = new ConstitutionalExecutionService(
      config(await tempStore()),
      request,
      kch.broker,
    );
    const params = executeParams();
    expect((await service.execute(params)).status).toBe("IN_DOUBT");
    const receiptHash = sha256Hex(remote);
    const reconciled = await service.reconcile(
      reconcileParams(params.idempotencyKey, "run-recovered", receiptHash, "operator inspected Gateway"),
    );
    expect(reconciled.status).toBe("SUCCEEDED");
    expect(reconciled.runId).toBe("run-recovered");
    expect(reconciled.outputHash).toBe(receiptHash);
    expect(kch.calls).toContain("receipt");
  });

  it("keeps shadow mode side-effect free while observing KCH read-only authority", async () => {
    const gateway = gatewayMock();
    const kch = brokerMock();
    const service = new ConstitutionalExecutionService(
      config(await tempStore(), "shadow"),
      gateway.request,
      kch.broker,
    );
    const result = await service.execute(executeParams());
    expect(result.status).toBe("SHADOW_ACCEPTED");
    expect(kch.calls).toEqual(["verify"]);
    expect(gateway.calls).toHaveLength(0);
  });

  it("refreshes terminal state through agent.wait using operator.write", async () => {
    const gateway = gatewayMock();
    const kch = brokerMock();
    const service = new ConstitutionalExecutionService(
      config(await tempStore()),
      gateway.request,
      kch.broker,
    );
    await service.execute(executeParams());
    const result = await service.status("idem-1");
    expect(result.status).toBe("SUCCEEDED");
    expect(result.outputHash).toMatch(/^[a-f0-9]{64}$/);
    const waitCall = gateway.calls.find((call) => call.method === "agent.wait");
    expect(waitCall?.options).toMatchObject({ scopes: ["operator.write"] });
  });

  it("does not let late cancellation overwrite a terminal outcome", async () => {
    const gateway = gatewayMock();
    const kch = brokerMock();
    const service = new ConstitutionalExecutionService(
      config(await tempStore()),
      gateway.request,
      kch.broker,
    );
    await service.execute(executeParams());
    expect((await service.status("idem-1")).status).toBe("SUCCEEDED");
    await expect(service.cancel(cancelParams("idem-1", "too late"))).rejects.toMatchObject({
      code: "CONSTITUTION_CANCEL_UNAVAILABLE",
    });
    expect((await service.store.get("idem-1"))?.status).toBe("SUCCEEDED");
  });

  it("rejects an idempotency-key conflict before another KCH transaction", async () => {
    const gateway = gatewayMock();
    const kch = brokerMock();
    const service = new ConstitutionalExecutionService(
      config(await tempStore()),
      gateway.request,
      kch.broker,
    );
    await service.execute(executeParams());
    await expect(
      service.execute(executeParams(envelope({ command_id: "different" }))),
    ).rejects.toMatchObject({ code: "CONSTITUTION_IDEMPOTENCY_CONFLICT" });
    expect(kch.calls.filter((item) => item === "prepare")).toHaveLength(1);
  });
});
