#!/usr/bin/env node
import { createPrivateKey } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import {
  buildShadowCases,
  canonicalJson,
  sha256Hex,
} from "./run-live-shadow-campaign.mjs";

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

export function parseJsonOutput(text) {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    for (const line of trimmed.split(/\r?\n/).reverse()) {
      try {
        return JSON.parse(line);
      } catch {
        // Continue until a machine-readable line is found.
      }
    }
  }
  return undefined;
}

export function findString(value, propertyName) {
  if (!value || typeof value !== "object") return undefined;
  if (typeof value[propertyName] === "string") return value[propertyName];
  for (const child of Object.values(value)) {
    const found = findString(child, propertyName);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function findConstitutionalErrorCode(value) {
  if (!value || typeof value !== "object") return undefined;
  for (const [key, child] of Object.entries(value)) {
    if (
      (key === "code" || key === "constitutionalCode") &&
      typeof child === "string" &&
      child.startsWith("CONSTITUTION_")
    ) {
      return child;
    }
  }
  for (const child of Object.values(value)) {
    const found = findConstitutionalErrorCode(child);
    if (found !== undefined) return found;
  }
  return undefined;
}

export function callGateway(method, params, options) {
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
  return {
    ok: result.status === 0,
    exitCode: result.status,
    parsed: parseJsonOutput(result.stdout) ?? parseJsonOutput(result.stderr),
    stderrBytes: Buffer.byteLength(result.stderr ?? ""),
  };
}

export async function runGateB(options) {
  const cases = buildShadowCases(options);
  const observations = [];
  for (const item of cases) {
    const started = performance.now();
    const result = callGateway("constitutional.execute", item.params, options);
    const status = findString(result.parsed, "status");
    const runId = findString(result.parsed, "runId");
    const observedErrorCode = findConstitutionalErrorCode(result.parsed);
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
      cliExitCode: result.exitCode,
      stderrBytes: result.stderrBytes,
    });
  }

  const validKey = cases[0].params.idempotencyKey;
  const statusResult = callGateway(
    "constitutional.status",
    { idempotencyKey: validKey },
    options,
  );
  const persistedStatus = findString(statusResult.parsed, "status");
  const persistedRunId = findString(statusResult.parsed, "runId");
  const summary = {
    schemaVersion: "CFL_KCH_GATE_B_LIVE_V2",
    campaignId: options.campaignId,
    cases: observations.length,
    matched: observations.filter((item) => item.matched).length,
    mismatched: observations.filter((item) => !item.matched).length,
    unexpectedRunIds: observations.filter((item) => item.runIdPresent).length,
    persistedStatus,
    persistedRunIdPresent: persistedRunId !== undefined,
    statusCheckOk:
      statusResult.ok &&
      persistedStatus === "SHADOW_ACCEPTED" &&
      persistedRunId === undefined,
  };
  const report = {
    ...summary,
    observations,
    reportHash: sha256Hex({ ...summary, observations }),
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
  const options = {
    campaignId,
    nowUnix: Date.now() / 1000,
    privateKey: createPrivateKey(
      Buffer.from(
        requiredEnvironment("KCH_ED25519_PRIVATE_KEY_PEM_B64"),
        "base64",
      ).toString("utf8"),
    ),
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
      process.env.CONSTITUTIONAL_OUTPUT_DIR?.trim() ||
        `artifacts/constitutional-shadow/${campaignId}`,
    ),
  };
  const report = await runGateB(options);
  process.stdout.write(`${canonicalJson(report)}\n`);
  if (report.mismatched !== 0 || report.unexpectedRunIds !== 0 || !report.statusCheckOk) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
