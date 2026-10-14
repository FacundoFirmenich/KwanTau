import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openNodeSqliteDatabase } from "@openclaw/plugin-sdk/sqlite-runtime";
import { describe, expect, it } from "vitest";

import { sha256Hex } from "../src/canonical-json.js";
import { ConstitutionalExecutionService } from "../src/service.js";
import { ConstitutionalStore } from "../src/store.js";
import type {
  ConstitutionalCancelParams,
  ConstitutionalCommandEnvelope,
  ConstitutionalExecuteParams,
  ConstitutionalPluginConfig,
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

function cancelParams(idempotencyKey: string, reason: string): ConstitutionalCancelParams {
  const signedHash = sha256Hex({
    operation: "constitutional.cancel",
    idempotencyKey,
    reason,
    policyHash,
    hostId,
  });
  return {
    idempotencyKey,
    reason,
    authorityProof: {
      algorithm: "Ed25519",
      keyId: "test-key",
      signedHash,
      signatureBase64: sign(null, Buffer.from(signedHash, "hex"), privateKey).toString("base64"),
    },
  };
}

function gatewayMock() {
  const calls: Array<{ method: string; params: unknown }> = [];
  const request: GatewayRequest = async <T>(method: string, params?: Record<string, unknown>) => {
    calls.push({ method, params });
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
    throw new Error(`unexpected method ${method}`);
  };
  return { request, calls };
}

describe("constitutional execution service", () => {
  it("dispatches a valid signed envelope through the standard agent path", async () => {
    const gateway = gatewayMock();
    const service = new ConstitutionalExecutionService(config(await tempStore()), gateway.request);
    const result = await service.execute(executeParams());
    expect(result.status).toBe("RUNNING");
    expect(result.runId).toBe("run-1");
    expect(gateway.calls).toHaveLength(1);
    expect(gateway.calls[0]?.method).toBe("agent");
    expect(await service.store.outboxState("idem-1")).toBe("ACKED");
    await service.close();
  });

  it("rejects payload mutation before side effects", async () => {
    const gateway = gatewayMock();
    const value = envelope();
    value.payload = { ...value.payload, message: "MUTATED" };
    const service = new ConstitutionalExecutionService(config(await tempStore()), gateway.request);
    await expect(service.execute(executeParams(value))).rejects.toMatchObject({
      code: "CONSTITUTION_INVALID",
    });
    expect(gateway.calls).toHaveLength(0);
    await service.close();
  });

  it("replays the same envelope without creating a second remote run", async () => {
    const gateway = gatewayMock();
    const service = new ConstitutionalExecutionService(config(await tempStore()), gateway.request);
    const params = executeParams();
    await service.execute(params);
    await service.execute(params);
    expect(gateway.calls.filter((call) => call.method === "agent")).toHaveLength(1);
    await service.close();
  });

  it("rejects an idempotency-key conflict", async () => {
    const gateway = gatewayMock();
    const service = new ConstitutionalExecutionService(config(await tempStore()), gateway.request);
    await service.execute(executeParams());
    await expect(
      service.execute(executeParams(envelope({ command_id: "different" }))),
    ).rejects.toMatchObject({ code: "CONSTITUTION_IDEMPOTENCY_CONFLICT" });
    await service.close();
  });

  it("keeps shadow mode free of remote side effects", async () => {
    const gateway = gatewayMock();
    const service = new ConstitutionalExecutionService(
      config(await tempStore(), "shadow"),
      gateway.request,
    );
    const result = await service.execute(executeParams());
    expect(result.status).toBe("SHADOW_ACCEPTED");
    expect(gateway.calls).toHaveLength(0);
    expect(await service.store.outboxState("idem-1")).toBe("SHADOW");
    await service.close();
  });

  it("refreshes terminal state through agent.wait", async () => {
    const gateway = gatewayMock();
    const service = new ConstitutionalExecutionService(config(await tempStore()), gateway.request);
    await service.execute(executeParams());
    const result = await service.status("idem-1");
    expect(result.status).toBe("SUCCEEDED");
    expect(result.outputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await service.store.outboxState("idem-1")).toBe("TERMINAL");
    await service.close();
  });

  it("records signed cancellation but refuses an unaudited remote abort", async () => {
    const gateway = gatewayMock();
    const service = new ConstitutionalExecutionService(config(await tempStore()), gateway.request);
    await service.execute(executeParams());
    await expect(service.cancel(cancelParams("idem-1", "operator request"))).rejects.toMatchObject({
      code: "CONSTITUTION_CANCEL_UNAVAILABLE",
    });
    expect((await service.store.get("idem-1"))?.status).toBe("CANCEL_REQUESTED");
    await service.close();
  });

  it("rejects mismatched session binding and revoked leases", async () => {
    const gateway = gatewayMock();
    const base = config(await tempStore());
    const service = new ConstitutionalExecutionService(base, gateway.request);
    await expect(
      service.execute(executeParams(envelope({ session_id: "agent:test:other" }))),
    ).rejects.toMatchObject({ code: "CONSTITUTION_SCOPE_DENIED" });
    const revokedService = new ConstitutionalExecutionService(
      { ...base, revokedLeaseIds: ["revoked-lease"] },
      gateway.request,
    );
    await expect(
      revokedService.execute(
        executeParams(envelope({ idempotency_key: "idem-revoked", lease_id: "revoked-lease" })),
      ),
    ).rejects.toMatchObject({ code: "CONSTITUTION_EXPIRED" });
    expect(gateway.calls).toHaveLength(0);
    await service.close();
    await revokedService.close();
  });

  it("atomically admits only one concurrent dispatcher across store handles", async () => {
    const storePath = await tempStore();
    const calls: string[] = [];
    const request: GatewayRequest = async <T>(method, params) => {
      calls.push(method);
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { runId: "run-concurrent", sessionKey: "agent:test:main" } as T;
    };
    const first = new ConstitutionalExecutionService(config(storePath), request);
    const second = new ConstitutionalExecutionService(config(storePath), request);
    const params = executeParams();
    await Promise.all([first.execute(params), second.execute(params)]);
    expect(calls.filter((method) => method === "agent")).toHaveLength(1);
    expect((await first.store.get("idem-1"))?.runId).toBe("run-concurrent");
    expect(await first.store.integrityCheck()).toBe("ok");
    await first.close();
    await second.close();
  });

  it("recovers an uncertain dispatch with the same signed request and idempotency key", async () => {
    const storePath = await tempStore();
    const seenKeys: string[] = [];
    let attempt = 0;
    const request: GatewayRequest = async <T>(method, params) => {
      if (method !== "agent") throw new Error("unexpected method");
      seenKeys.push(String(params?.idempotencyKey));
      attempt += 1;
      if (attempt === 1) throw new Error("connection lost after possible acceptance");
      return { runId: "run-recovered", sessionKey: "agent:test:main" } as T;
    };
    const service = new ConstitutionalExecutionService(config(storePath), request);
    const first = await service.execute(executeParams());
    expect(first.status).toBe("IN_DOUBT");
    expect(await service.store.outboxState("idem-1")).toBe("IN_DOUBT");
    const summary = await service.recoverPending();
    expect(summary.discovered).toBe(1);
    expect(summary.running).toBe(1);
    expect(seenKeys).toEqual(["idem-1", "idem-1"]);
    expect((await service.store.get("idem-1"))?.runId).toBe("run-recovered");
    await service.close();
  });

  it("fences stale dispatch claims", async () => {
    const store = new ConstitutionalStore(await tempStore());
    const params = executeParams();
    await store.reserveCommand({
      idempotencyKey: params.idempotencyKey,
      envelopeHash: params.authorityProof.signedHash,
      payloadHash: params.envelope.payload_hash,
      mode: "enforce",
      params,
    });
    const first = await store.claimDispatch("idem-1", { claimTtlMs: 0 });
    const second = await store.claimDispatch("idem-1", { claimTtlMs: 30_000 });
    expect(first.claimed).toBe(true);
    expect(second.claimed).toBe(true);
    await expect(
      store.acknowledgeDispatch({
        idempotencyKey: "idem-1",
        claimToken: String(first.claimToken),
        runId: "stale-run",
        acceptance: {},
      }),
    ).rejects.toMatchObject({ code: "CONSTITUTION_IDEMPOTENCY_CONFLICT" });
    await store.acknowledgeDispatch({
      idempotencyKey: "idem-1",
      claimToken: String(second.claimToken),
      runId: "current-run",
      acceptance: {},
    });
    await store.close();
  });

  it("verifies the event chain and detects tail tampering", async () => {
    const storePath = await tempStore();
    const service = new ConstitutionalExecutionService(config(storePath), gatewayMock().request);
    await service.execute(executeParams());
    expect(await service.store.verifyEventChain()).toMatchObject({ valid: true });
    await service.close();

    const database = openNodeSqliteDatabase(join(storePath, "constitutional-execution.sqlite"));
    database.exec("DELETE FROM constitutional_event_chain WHERE sequence = (SELECT MAX(sequence) FROM constitutional_event_chain)");
    database.close();

    const reopened = new ConstitutionalStore(storePath);
    expect(await reopened.verifyEventChain()).toMatchObject({ valid: false });
    await reopened.close();
  });

  it("rejects illegal transitions out of a terminal state", async () => {
    const store = new ConstitutionalStore(await tempStore());
    const params = executeParams();
    await store.reserveCommand({
      idempotencyKey: params.idempotencyKey,
      envelopeHash: params.authorityProof.signedHash,
      payloadHash: params.envelope.payload_hash,
      mode: "enforce",
      params,
    });
    await store.setStatus("idem-1", "FAILED", { completedAtUnix: Date.now() / 1000 });
    await expect(store.setStatus("idem-1", "RUNNING")).rejects.toMatchObject({
      code: "CONSTITUTION_INVALID",
    });
    await store.close();
  });
});
