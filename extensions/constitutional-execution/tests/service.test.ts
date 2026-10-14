import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { sha256Hex } from "../src/canonical-json.js";
import { ConstitutionalExecutionService } from "../src/service.js";
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

function config(storePath: string, mode: "shadow" | "enforce" = "enforce"): ConstitutionalPluginConfig {
  return {
    enabled: true,
    mode,
    storePath,
    hostId,
    activePolicyHash: policyHash,
    maxIntentAgeMs: 300_000,
    clockSkewMs: 30_000,
    waitTimeoutMs: 10,
    allowedKeys: [{ keyId: "test-key", publicKeyPem, enabled: true }],
    allowedExecutors: ["openclaw.agent"],
    allowedCapabilities: ["agent.run"],
    allowedSessionPrefixes: ["agent:test:"],
    maxBudget: { tokens: 4096, seconds: 120 },
  };
}

function envelope(overrides: Partial<ConstitutionalCommandEnvelope> = {}): ConstitutionalCommandEnvelope {
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
  });

  it("replays the same envelope without creating a second remote run", async () => {
    const gateway = gatewayMock();
    const service = new ConstitutionalExecutionService(config(await tempStore()), gateway.request);
    const params = executeParams();
    await service.execute(params);
    await service.execute(params);
    expect(gateway.calls.filter((call) => call.method === "agent")).toHaveLength(1);
  });

  it("rejects an idempotency-key conflict", async () => {
    const gateway = gatewayMock();
    const service = new ConstitutionalExecutionService(config(await tempStore()), gateway.request);
    await service.execute(executeParams());
    await expect(
      service.execute(executeParams(envelope({ command_id: "different" }))),
    ).rejects.toMatchObject({ code: "CONSTITUTION_IDEMPOTENCY_CONFLICT" });
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
  });

  it("refreshes terminal state through agent.wait", async () => {
    const gateway = gatewayMock();
    const service = new ConstitutionalExecutionService(config(await tempStore()), gateway.request);
    await service.execute(executeParams());
    const result = await service.status("idem-1");
    expect(result.status).toBe("SUCCEEDED");
    expect(result.outputHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("records signed cancellation but refuses an unaudited remote abort", async () => {
    const gateway = gatewayMock();
    const service = new ConstitutionalExecutionService(config(await tempStore()), gateway.request);
    await service.execute(executeParams());
    await expect(service.cancel(cancelParams("idem-1", "operator request"))).rejects.toMatchObject({
      code: "CONSTITUTION_CANCEL_UNAVAILABLE",
    });
    expect((await service.store.get("idem-1"))?.status).toBe("CANCEL_REQUESTED");
  });
});
