import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import { ConstitutionalError } from "./errors.js";

export type KchAuthorityPrepareParams = {
  envelopeHash: string;
  leaseId: string;
  reservationId: string;
  decisionId: string;
  intentId: string;
  policyHash: string;
  epoch: number;
  sessionId: string;
  toolName: string;
  argsSha256: string;
  ttlSeconds: number;
};

export type KchAuthorityClaim = {
  active: boolean;
  claimId: string | null;
  proposalId: string | null;
  status: string;
  envelopeHash: string;
  leaseId: string;
  reservationId: string;
  decisionId: string;
  intentId: string;
  policyHash: string;
  epoch: number;
  sessionId: string;
  toolName: string;
  argsSha256: string;
  generation: string;
  verifiedAtUnix: number;
  attestationLevel: string;
  reason?: string;
};

export type KchAuthorityBroker = {
  verify(params: KchAuthorityPrepareParams): Promise<KchAuthorityClaim>;
  prepare(params: KchAuthorityPrepareParams): Promise<KchAuthorityClaim>;
  commit(params: {
    claimId: string;
    envelopeHash: string;
    runId: string;
    receiptHash: string;
  }): Promise<KchAuthorityClaim>;
  abort(params: {
    claimId: string;
    envelopeHash: string;
    reason: string;
  }): Promise<KchAuthorityClaim>;
  indoubt(params: {
    claimId: string;
    envelopeHash: string;
    reason: string;
  }): Promise<KchAuthorityClaim>;
  status(params: { claimId: string }): Promise<KchAuthorityClaim>;
};

type BrokerWireResponse = {
  id?: unknown;
  ok?: unknown;
  result?: unknown;
  error?: {
    code?: unknown;
    message?: unknown;
    retryable?: unknown;
  };
};

function parseClaim(value: unknown): KchAuthorityClaim {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ConstitutionalError(
      "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
      "KCH authority broker returned a malformed result.",
      { retryable: true },
    );
  }
  const item = value as Record<string, unknown>;
  const requiredStrings = [
    "status",
    "envelopeHash",
    "leaseId",
    "reservationId",
    "decisionId",
    "intentId",
    "policyHash",
    "sessionId",
    "toolName",
    "argsSha256",
    "generation",
    "attestationLevel",
  ] as const;
  for (const key of requiredStrings) {
    if (typeof item[key] !== "string") {
      throw new ConstitutionalError(
        "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
        "KCH authority broker result is missing " + key + ".",
        { retryable: true },
      );
    }
  }
  if (
    typeof item.active !== "boolean" ||
    typeof item.epoch !== "number" ||
    typeof item.verifiedAtUnix !== "number"
  ) {
    throw new ConstitutionalError(
      "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
      "KCH authority broker result has invalid scalar fields.",
      { retryable: true },
    );
  }
  if (item.claimId !== null && typeof item.claimId !== "string") {
    throw new ConstitutionalError(
      "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
      "KCH authority broker claimId is malformed.",
      { retryable: true },
    );
  }
  if (item.proposalId !== null && typeof item.proposalId !== "string") {
    throw new ConstitutionalError(
      "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
      "KCH authority broker proposalId is malformed.",
      { retryable: true },
    );
  }
  return item as unknown as KchAuthorityClaim;
}

export class StdioKchAuthorityBroker implements KchAuthorityBroker {
  constructor(
    private readonly command: string,
    private readonly database: string,
    private readonly timeoutMs: number,
  ) {
    if (!isAbsolute(command) || !isAbsolute(database)) {
      throw new ConstitutionalError(
        "CONSTITUTION_INVALID",
        "KCH broker executable and database paths must be absolute.",
      );
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 30_000) {
      throw new ConstitutionalError(
        "CONSTITUTION_INVALID",
        "KCH broker timeout must be between 100 and 30000 ms.",
      );
    }
  }

  private async request(method: string, params: Record<string, unknown>): Promise<KchAuthorityClaim> {
    const id = randomUUID();
    const request = JSON.stringify({ id, method, params }) + "\n";
    const response = await new Promise<BrokerWireResponse>((resolve, reject) => {
      const child = spawn(this.command, ["--database", this.database, "--once"], {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        shell: false,
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      const maximumBytes = 1024 * 1024;
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };
      const timer = setTimeout(() => {
        child.kill();
        settle(() =>
          reject(
            new ConstitutionalError(
              "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
              "KCH authority broker timed out.",
              { retryable: true },
            ),
          ),
        );
      }, this.timeoutMs);
      timer.unref?.();

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes > maximumBytes) {
          child.kill();
          settle(() =>
            reject(
              new ConstitutionalError(
                "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
                "KCH authority broker exceeded stdout limit.",
                { retryable: true },
              ),
            ),
          );
          return;
        }
        stdout.push(chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (stderrBytes <= maximumBytes) stderr.push(chunk);
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        settle(() =>
          reject(
            new ConstitutionalError(
              "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
              "KCH authority broker could not start: " + String(error),
              { retryable: true },
            ),
          ),
        );
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        settle(() => {
          if (code !== 0) {
            reject(
              new ConstitutionalError(
                "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
                "KCH authority broker exited " +
                  String(code) +
                  ": " +
                  Buffer.concat(stderr).toString("utf8").slice(0, 512),
                { retryable: true },
              ),
            );
            return;
          }
          const lines = Buffer.concat(stdout).toString("utf8").trim().split(/\r?\n/);
          if (lines.length !== 1 || !lines[0]) {
            reject(
              new ConstitutionalError(
                "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
                "KCH authority broker returned non-canonical stdout framing.",
                { retryable: true },
              ),
            );
            return;
          }
          try {
            resolve(JSON.parse(lines[0]) as BrokerWireResponse);
          } catch {
            reject(
              new ConstitutionalError(
                "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
                "KCH authority broker returned invalid JSON.",
                { retryable: true },
              ),
            );
          }
        });
      });
      child.stdin.end(request);
    });

    if (response.id !== id) {
      throw new ConstitutionalError(
        "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE",
        "KCH authority broker response ID mismatch.",
        { retryable: true },
      );
    }
    if (response.ok !== true) {
      const code =
        typeof response.error?.code === "string" ? response.error.code : "AUTHORITY_DENIED";
      const message =
        typeof response.error?.message === "string"
          ? response.error.message
          : "KCH authority broker denied the request.";
      const unavailable = [
        "AUTHORITY_DB_MISSING",
        "AUTHORITY_SCHEMA_MISMATCH",
        "LEDGER_CHAIN_INVALID",
        "INTERNAL_ERROR",
      ].includes(code);
      throw new ConstitutionalError(
        unavailable
          ? "CONSTITUTION_LIVE_AUTHORITY_UNAVAILABLE"
          : "CONSTITUTION_LIVE_AUTHORITY_DENIED",
        message,
        {
          retryable: unavailable || response.error?.retryable === true,
          details: { brokerCode: code },
        },
      );
    }
    return parseClaim(response.result);
  }

  verify(params: KchAuthorityPrepareParams) {
    return this.request("kch.authority.verify", params as unknown as Record<string, unknown>);
  }
  prepare(params: KchAuthorityPrepareParams) {
    return this.request("kch.authority.prepare", params as unknown as Record<string, unknown>);
  }
  commit(params: { claimId: string; envelopeHash: string; runId: string; receiptHash: string }) {
    return this.request("kch.authority.commit", params);
  }
  abort(params: { claimId: string; envelopeHash: string; reason: string }) {
    return this.request("kch.authority.abort", params);
  }
  indoubt(params: { claimId: string; envelopeHash: string; reason: string }) {
    return this.request("kch.authority.indoubt", params);
  }
  status(params: { claimId: string }) {
    return this.request("kch.authority.status", params);
  }
}
