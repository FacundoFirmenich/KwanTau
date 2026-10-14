#!/usr/bin/env node
import { createHash, createPrivateKey, sign } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("canonical JSON rejects non-finite numbers");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    const output = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] !== undefined) output[key] = canonicalize(value[key]);
    }
    return output;
  }
  throw new TypeError(`canonical JSON rejects ${typeof value}`);
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function sha256Hex(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function flipHash(hash) {
  return `${hash[0] === "0" ? "1" : "0"}${hash.slice(1)}`;
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing required environment variable ${name}`);
  return value;
}

function integerEnvironment(name, minimum) {
  const value = Number(requiredEnvironment(name));
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}`);
  }
  return value;
}

function clone(value) {
  return structuredClone(value);
}

function signEnvelope(envelope, keyId, privateKey) {
  const signedHash = sha256Hex(envelope);
  return {
    idempotencyKey: envelope.idempotency_key,
    envelope,
    authorityProof: {
      algorithm: "Ed25519",
      keyId,
      signedHash,
      signatureBase64: sign(null, Buffer.from(signedHash, "hex"), privateKey).toString("base64"),
    },
  };
}

export function buildShadowCases(options) {
  const now = Math.floor(options.nowUnix);
  const campaignPrefix = options.campaignId.replace(/[^A-Za-z0-9_.-]/g, "-");
  const payload = {
    message: "Return exactly CONSTITUTIONAL_SHADOW_READY.",
    sessionKey: options.sessionKey,
    deliver: false,
    modelRun: true,
  };
  const baseEnvelope = {
    command_id: `${campaignPrefix}-command-valid`,
    reservation_id: `${campaignPrefix}-reservation-valid`,
    intent_id: `${campaignPrefix}-intent-valid`,
    lease_id: `${campaignPrefix}-lease-valid`,
    decision_id: `${campaignPrefix}-decision-valid`,
    candidate_id: `${campaignPrefix}-candidate-valid`,
    permission_id: `${campaignPrefix}-permission-valid`,
    support_certificate_id: `${campaignPrefix}-support-valid`,
    assurance_id: `${campaignPrefix}-assurance-valid`,
    idempotency_key: `${campaignPrefix}-idem-valid`,
    executor_id: "openclaw.agent",
    capability: "agent.run",
    payload,
    payload_hash: sha256Hex(payload),
    schema_hash: "b".repeat(64),
    code_hash: "c".repeat(64),
    environment_hash: "d".repeat(64),
    policy_hash: options.policyHash,
    contract_hash: options.contractHash,
    host_id: options.hostId,
    session_id: options.sessionKey,
    scope: { session: options.sessionKey },
    budget: { tokens: 64, seconds: 30 },
    epoch: options.minimumEpoch,
    created_at_unix: now,
    expires_at_unix: now + Math.min(120, options.maxLeaseSeconds),
    metadata: { campaignId: options.campaignId, mode: "shadow" },
  };

  const make = (caseId, family, description, expectation, mutate, expectedErrorCode) => {
    const envelope = clone(baseEnvelope);
    envelope.command_id = `${campaignPrefix}-command-${caseId}`;
    envelope.reservation_id = `${campaignPrefix}-reservation-${caseId}`;
    envelope.intent_id = `${campaignPrefix}-intent-${caseId}`;
    envelope.lease_id = `${campaignPrefix}-lease-${caseId}`;
    envelope.idempotency_key = `${campaignPrefix}-idem-${caseId}`;
    mutate?.(envelope);
    return {
      caseId,
      family,
      description,
      expectation,
      expectedErrorCode,
      params: signEnvelope(envelope, options.keyId, options.privateKey),
    };
  };

  const valid = {
    caseId: "valid",
    family: "positive",
    description: "valid signed envelope",
    expectation: "ACCEPT",
    params: signEnvelope(baseEnvelope, options.keyId, options.privateKey),
  };
  const replay = {
    caseId: "exact-replay",
    family: "idempotency",
    description: "exact replay of the valid envelope",
    expectation: "ACCEPT",
    params: clone(valid.params),
  };
  const conflictEnvelope = clone(baseEnvelope);
  conflictEnvelope.command_id = `${campaignPrefix}-command-conflict`;
  const conflict = {
    caseId: "idempotency-conflict",
    family: "idempotency",
    description: "same idempotency key with a different signed envelope",
    expectation: "REJECT",
    expectedErrorCode: "CONSTITUTION_IDEMPOTENCY_CONFLICT",
    params: signEnvelope(conflictEnvelope, options.keyId, options.privateKey),
  };

  const payloadMutation = make(
    "payload-mutation",
    "commitment",
    "payload changed after payload hash was fixed",
    "REJECT",
    (envelope) => {
      envelope.payload = { ...envelope.payload, message: "MUTATED" };
    },
    "CONSTITUTION_INVALID",
  );
  const invalidSignature = make(
    "invalid-signature",
    "signature",
    "signature bytes do not authenticate the envelope",
    "REJECT",
    undefined,
    "CONSTITUTION_SIGNATURE_INVALID",
  );
  invalidSignature.params.authorityProof.signatureBase64 = Buffer.alloc(64, 7).toString("base64");

  const unknownKey = make(
    "unknown-key",
    "signature",
    "signature names a key absent from the verifier allowlist",
    "REJECT",
    undefined,
    "CONSTITUTION_SIGNATURE_INVALID",
  );
  unknownKey.params.authorityProof.keyId = `${options.keyId}-unknown`;

  return [
    valid,
    replay,
    conflict,
    payloadMutation,
    invalidSignature,
    unknownKey,
    make("stale-policy", "policy", "policy hash is not active", "REJECT", (e) => {
      e.policy_hash = flipHash(options.policyHash);
    }, "CONSTITUTION_POLICY_MISMATCH"),
    make("bad-contract", "policy", "contract hash is not admitted", "REJECT", (e) => {
      e.contract_hash = flipHash(options.contractHash);
    }, "CONSTITUTION_POLICY_MISMATCH"),
    make("host-mismatch", "scope", "host binding differs", "REJECT", (e) => {
      e.host_id = `${options.hostId}-other`;
    }, "CONSTITUTION_SCOPE_DENIED"),
    make("payload-session-mismatch", "scope", "payload session differs from lease session", "REJECT", (e) => {
      e.payload = { ...e.payload, sessionKey: `${options.sessionKey}:other` };
      e.payload_hash = sha256Hex(e.payload);
    }, "CONSTITUTION_SCOPE_DENIED"),
    make("scope-session-mismatch", "scope", "declared scope differs from lease session", "REJECT", (e) => {
      e.scope = { session: `${options.sessionKey}:other` };
    }, "CONSTITUTION_SCOPE_DENIED"),
    make("unsupported-executor", "capability", "executor is not admitted", "REJECT", (e) => {
      e.executor_id = "openclaw.system.run";
    }, "CONSTITUTION_EXECUTOR_UNSUPPORTED"),
    make("unsupported-capability", "capability", "capability is not admitted", "REJECT", (e) => {
      e.capability = "system.run";
    }, "CONSTITUTION_EXECUTOR_UNSUPPORTED"),
    make("budget-overrun", "budget", "token budget exceeds configured ceiling", "REJECT", (e) => {
      e.budget = { tokens: options.maxTokens + 1, seconds: 30 };
    }, "CONSTITUTION_BUDGET_DENIED"),
    make("stale-epoch", "temporal", "epoch predates the active minimum", "REJECT", (e) => {
      e.epoch = options.minimumEpoch - 1;
    }, "CONSTITUTION_EXPIRED"),
    make("revoked-lease", "temporal", "lease is explicitly revoked", "REJECT", (e) => {
      e.lease_id = options.revokedLeaseId;
    }, "CONSTITUTION_EXPIRED"),
    make("expired", "temporal", "lease expired before submission", "REJECT", (e) => {
      e.created_at_unix = now - 60;
      e.expires_at_unix = now - 1;
    }, "CONSTITUTION_EXPIRED"),
    make("overlong-lease", "temporal", "lease duration exceeds policy", "REJECT", (e) => {
      e.created_at_unix = now;
      e.expires_at_unix = now + options.maxLeaseSeconds + 1;
    }, "CONSTITUTION_EXPIRED"),
  ];
}

function parseJsonOutput(text) {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    const lines = trimmed.split(/\r?\n/).reverse();
    for (const line of lines) {
      try {
        return JSON.parse(line);
      } catch {
        // Continue to the next candidate line.
      }
    }
  }
  return undefined;
}

function deepFind(value, names) {
  if (!value || typeof value !== "object") return undefined;
  for (const name of names) {
    if (typeof value[name] === "string") return value[name];
  }
  for (const child of Object.values(value)) {
    const found = deepFind(child, names);
    if (found !== undefined) return found;
  }
  return undefined;
}

function callGateway(method, params, options) {
  const args = [];
  if (options.profile) args.push("--profile", options.profile);
  args.push(
    "gateway",
    "call",
    method,
    "--port",
    String(options.port),
    "--params",
    JSON.stringify(params),
    "--timeout",
    String(options.timeoutMs),
    "--json",
  );
  const result = spawnSync(process.execPath, [options.cliPath, ...args], {
    cwd: options.repoRoot,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, NO_COLOR: "1" },
  });
  const parsed = parseJsonOutput(result.stdout) ?? parseJsonOutput(result.stderr);
  return {
    ok: result.status === 0,
    status: result.status,
    parsed,
    stderrBytes: Buffer.byteLength(result.stderr ?? ""),
  };
}

export async function runLiveShadowCampaign(options) {
  const cases = buildShadowCases(options);
  const observations = [];
  for (const item of cases) {
    const started = performance.now();
    const result = callGateway("constitutional.execute", item.params, options);
    const status = deepFind(result.parsed, ["status"]);
    const runId = deepFind(result.parsed, ["runId"]);
    const observedErrorCode = deepFind(result.parsed, ["CONSTITUTION_CODE_SENTINEL", "code"]);
    const observed = result.ok && status === "SHADOW_ACCEPTED" && runId === undefined
      ? "ACCEPT"
      : "REJECT";
    const matched =
      observed === item.expectation &&
      (item.expectedErrorCode === undefined || observedErrorCode === item.expectedErrorCode);
    observations.push({
      caseId: item.caseId,
      family: item.family,
      description: item.description,
      expectation: item.expectation,
      observed,
      matched,
      expectedErrorCode: item.expectedErrorCode,
      observedErrorCode,
      status,
      runIdPresent: runId !== undefined,
      envelopeHash: sha256Hex(item.params.envelope),
      payloadHash: sha256Hex(item.params.envelope.payload),
      durationMs: performance.now() - started,
      cliExitCode: result.status,
      stderrBytes: result.stderrBytes,
    });
  }

  const validKey = cases[0].params.idempotencyKey;
  const statusResult = callGateway("constitutional.status", { idempotencyKey: validKey }, options);
  const persistedStatus = deepFind(statusResult.parsed, ["status"]);
  const persistedRunId = deepFind(statusResult.parsed, ["runId"]);
  const summaryBase = {
    campaignId: options.campaignId,
    schemaVersion: "CFL_KCH_GATE_B_LIVE_V1",
    cases: observations.length,
    matched: observations.filter((item) => item.matched).length,
    mismatched: observations.filter((item) => !item.matched).length,
    unexpectedRunIds: observations.filter((item) => item.runIdPresent).length,
    persistedStatus,
    persistedRunIdPresent: persistedRunId !== undefined,
    statusCheckOk: statusResult.ok && persistedStatus === "SHADOW_ACCEPTED" && persistedRunId === undefined,
  };
  const report = {
    ...summaryBase,
    observations,
    reportHash: sha256Hex({ ...summaryBase, observations }),
  };
  await mkdir(options.outputDirectory, { recursive: true, mode: 0o700 });
  await writeFile(
    resolve(options.outputDirectory, "gate-b-shadow-report.json"),
    canonicalJson(report) + "\n",
    { encoding: "utf8", mode: 0o600 },
  );
  await writeFile(
    resolve(options.outputDirectory, "gate-b-shadow-observations.jsonl"),
    observations.map((item) => canonicalJson(item)).join("\n") + "\n",
    { encoding: "utf8", mode: 0o600 },
  );
  return report;
}

async function main() {
  const repoRoot = resolve(import.meta.dirname, "../../..");
  const campaignId = process.env.CONSTITUTIONAL_CAMPAIGN_ID?.trim() ||
    `gate-b-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const privateKey = createPrivateKey(
    Buffer.from(requiredEnvironment("KCH_ED25519_PRIVATE_KEY_PEM_B64"), "base64").toString("utf8"),
  );
  const options = {
    campaignId,
    nowUnix: Date.now() / 1000,
    privateKey,
    keyId: requiredEnvironment("CONSTITUTIONAL_KEY_ID"),
    hostId: requiredEnvironment("CONSTITUTIONAL_HOST_ID"),
    policyHash: requiredEnvironment("CONSTITUTIONAL_POLICY_HASH"),
    contractHash: requiredEnvironment("CONSTITUTIONAL_CONTRACT_HASH"),
    sessionKey: requiredEnvironment("CONSTITUTIONAL_SESSION_KEY"),
    minimumEpoch: integerEnvironment("CONSTITUTIONAL_MINIMUM_EPOCH", 1),
    maxLeaseSeconds: integerEnvironment("CONSTITUTIONAL_MAX_LEASE_SECONDS", 1),
    maxTokens: integerEnvironment("CONSTITUTIONAL_MAX_TOKENS", 1),
    revokedLeaseId: requiredEnvironment("CONSTITUTIONAL_REVOKED_LEASE_ID"),
    port: integerEnvironment("CONSTITUTIONAL_GATEWAY_PORT", 1),
    timeoutMs: integerEnvironment("CONSTITUTIONAL_GATEWAY_TIMEOUT_MS", 1000),
    profile: process.env.CONSTITUTIONAL_OPENCLAW_PROFILE?.trim() || undefined,
    repoRoot,
    cliPath: resolve(repoRoot, "openclaw.mjs"),
    outputDirectory: resolve(
      process.env.CONSTITUTIONAL_OUTPUT_DIR?.trim() || `artifacts/constitutional-shadow/${campaignId}`,
    ),
  };
  const report = await runLiveShadowCampaign(options);
  process.stdout.write(`${canonicalJson(report)}\n`);
  if (report.mismatched !== 0 || report.unexpectedRunIds !== 0 || !report.statusCheckOk) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
