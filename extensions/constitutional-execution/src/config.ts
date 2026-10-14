import { createPublicKey } from "node:crypto";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { ConstitutionalError } from "./errors.js";
import type { ConstitutionalPluginConfig } from "./types.js";

const SHA256_HEX = /^[a-f0-9]{64}$/;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return [];
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function expandHome(path: string): string {
  return path.startsWith("~/") ? resolve(homedir(), path.slice(2)) : path;
}

function absoluteConfiguredPath(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const expanded = expandHome(value.trim());
  return isAbsolute(expanded) ? expanded : undefined;
}

export function resolveConstitutionalConfig(raw: unknown): ConstitutionalPluginConfig {
  const config =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const mode = config.mode === "enforce" ? "enforce" : "shadow";
  const enabled = config.enabled === true;
  const hostId = typeof config.hostId === "string" ? config.hostId.trim() : "";
  const activePolicyHash =
    typeof config.activePolicyHash === "string" ? config.activePolicyHash.trim().toLowerCase() : "";
  const storePath =
    typeof config.storePath === "string" && config.storePath.trim()
      ? expandHome(config.storePath.trim())
      : resolve(homedir(), ".openclaw/constitutional-execution");

  const allowedKeys = Array.isArray(config.allowedKeys)
    ? config.allowedKeys
        .map((item) =>
          item && typeof item === "object" && !Array.isArray(item)
            ? (item as Record<string, unknown>)
            : {},
        )
        .filter((item) => item.enabled !== false)
        .map((item) => ({
          keyId: typeof item.keyId === "string" ? item.keyId.trim() : "",
          publicKeyPem: typeof item.publicKeyPem === "string" ? item.publicKeyPem.trim() : "",
          enabled: item.enabled !== false,
        }))
        .filter((item) => item.keyId && item.publicKeyPem)
    : [];

  const maxBudgetRaw =
    config.maxBudget && typeof config.maxBudget === "object" && !Array.isArray(config.maxBudget)
      ? (config.maxBudget as Record<string, unknown>)
      : {};
  const maxBudget: Record<string, number> = {};
  for (const [key, value] of Object.entries(maxBudgetRaw)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new ConstitutionalError("CONSTITUTION_INVALID", `Invalid maxBudget value for ${key}.`);
    }
    maxBudget[key] = value;
  }

  const resolved: ConstitutionalPluginConfig = {
    enabled,
    mode,
    storePath,
    hostId,
    activePolicyHash,
    maxIntentAgeMs:
      typeof config.maxIntentAgeMs === "number" && config.maxIntentAgeMs > 0
        ? config.maxIntentAgeMs
        : 5 * 60_000,
    maxLeaseDurationMs:
      typeof config.maxLeaseDurationMs === "number" && config.maxLeaseDurationMs > 0
        ? config.maxLeaseDurationMs
        : 5 * 60_000,
    maxLiveAuthorityAgeMs:
      typeof config.maxLiveAuthorityAgeMs === "number" && config.maxLiveAuthorityAgeMs > 0
        ? config.maxLiveAuthorityAgeMs
        : 5_000,
    liveAuthorityVerifierMethod:
      typeof config.liveAuthorityVerifierMethod === "string" &&
      config.liveAuthorityVerifierMethod.trim()
        ? config.liveAuthorityVerifierMethod.trim()
        : undefined,
    kchAuthorityBrokerCommand: absoluteConfiguredPath(config.kchAuthorityBrokerCommand),
    kchAuthorityDatabase: absoluteConfiguredPath(config.kchAuthorityDatabase),
    kchAuthorityBrokerTimeoutMs:
      typeof config.kchAuthorityBrokerTimeoutMs === "number" &&
      config.kchAuthorityBrokerTimeoutMs >= 100 &&
      config.kchAuthorityBrokerTimeoutMs <= 30_000
        ? config.kchAuthorityBrokerTimeoutMs
        : 2_000,
    kchClaimTtlSeconds:
      typeof config.kchClaimTtlSeconds === "number" &&
      Number.isInteger(config.kchClaimTtlSeconds) &&
      config.kchClaimTtlSeconds >= 1 &&
      config.kchClaimTtlSeconds <= 30
        ? config.kchClaimTtlSeconds
        : 5,
    clockSkewMs:
      typeof config.clockSkewMs === "number" && config.clockSkewMs >= 0
        ? config.clockSkewMs
        : 30_000,
    minimumEpoch:
      typeof config.minimumEpoch === "number" &&
      Number.isInteger(config.minimumEpoch) &&
      config.minimumEpoch >= 0
        ? config.minimumEpoch
        : 0,
    revokedLeaseIds: asStringArray(config.revokedLeaseIds),
    waitTimeoutMs:
      typeof config.waitTimeoutMs === "number" && config.waitTimeoutMs >= 0
        ? config.waitTimeoutMs
        : 1_000,
    allowedKeys,
    allowedExecutors: asStringArray(config.allowedExecutors),
    allowedCapabilities: asStringArray(config.allowedCapabilities),
    allowedContractHashes: asStringArray(config.allowedContractHashes).map((value) =>
      value.toLowerCase(),
    ),
    allowedSessionPrefixes: asStringArray(config.allowedSessionPrefixes),
    maxBudget,
  };

  if (enabled) {
    if (!hostId) {
      throw new ConstitutionalError("CONSTITUTION_INVALID", "hostId is required.");
    }
    if (!SHA256_HEX.test(activePolicyHash)) {
      throw new ConstitutionalError(
        "CONSTITUTION_INVALID",
        "activePolicyHash must be lowercase SHA-256 hexadecimal.",
      );
    }
    if (allowedKeys.length === 0) {
      throw new ConstitutionalError(
        "CONSTITUTION_INVALID",
        "At least one enabled Ed25519 verification key is required.",
      );
    }
    for (const key of allowedKeys) {
      let parsed;
      try {
        parsed = createPublicKey(key.publicKeyPem);
      } catch {
        throw new ConstitutionalError(
          "CONSTITUTION_INVALID",
          `Authority key ${key.keyId} is not a valid public key.`,
        );
      }
      if (parsed.asymmetricKeyType !== "ed25519") {
        throw new ConstitutionalError(
          "CONSTITUTION_INVALID",
          `Authority key ${key.keyId} must be Ed25519.`,
        );
      }
    }
    if (
      mode === "enforce" &&
      (!resolved.kchAuthorityBrokerCommand || !resolved.kchAuthorityDatabase)
    ) {
      throw new ConstitutionalError(
        "CONSTITUTION_INVALID",
        "Enforce mode requires absolute kchAuthorityBrokerCommand and kchAuthorityDatabase paths.",
      );
    }
    if (resolved.allowedExecutors.length === 0 || resolved.allowedCapabilities.length === 0) {
      throw new ConstitutionalError(
        "CONSTITUTION_INVALID",
        "Executor and capability allowlists are required when enabled.",
      );
    }
    if (
      resolved.allowedContractHashes.length === 0 ||
      resolved.allowedContractHashes.some((value) => !SHA256_HEX.test(value))
    ) {
      throw new ConstitutionalError(
        "CONSTITUTION_INVALID",
        "At least one valid allowedContractHash is required when enabled.",
      );
    }
  }
  return resolved;
}
