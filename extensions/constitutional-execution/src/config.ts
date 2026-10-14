import { homedir } from "node:os";
import { resolve } from "node:path";
import { ConstitutionalError } from "./errors.js";
import type { ConstitutionalPluginConfig } from "./types.js";

const SHA256_HEX = /^[a-f0-9]{64}$/;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return [];
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function expandHome(path: string): string {
  return path.startsWith("~/") ? resolve(homedir(), path.slice(2)) : resolve(path);
}

export function resolveConstitutionalConfig(raw: unknown): ConstitutionalPluginConfig {
  const config = asRecord(raw);
  const mode = config.mode === "enforce" ? "enforce" : "shadow";
  const enabled = config.enabled === true;
  const hostId = typeof config.hostId === "string" ? config.hostId.trim() : "";
  const activePolicyHash =
    typeof config.activePolicyHash === "string"
      ? config.activePolicyHash.trim().toLowerCase()
      : "";
  const storePath =
    typeof config.storePath === "string" && config.storePath.trim()
      ? expandHome(config.storePath.trim())
      : resolve(homedir(), ".openclaw/constitutional-execution");

  const allowedKeys = Array.isArray(config.allowedKeys)
    ? config.allowedKeys
        .map((item) => asRecord(item))
        .filter((item) => item.enabled !== false)
        .map((item) => ({
          keyId: typeof item.keyId === "string" ? item.keyId.trim() : "",
          publicKeyPem:
            typeof item.publicKeyPem === "string" ? item.publicKeyPem.trim() : "",
          enabled: item.enabled !== false,
        }))
        .filter((item) => item.keyId && item.publicKeyPem)
    : [];

  const maxBudgetRaw = asRecord(config.maxBudget);
  const maxBudget: Record<string, number> = {};
  for (const [key, value] of Object.entries(maxBudgetRaw)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new ConstitutionalError(
        "CONSTITUTION_INVALID",
        `Invalid maxBudget value for ${key}.`,
      );
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
    clockSkewMs:
      typeof config.clockSkewMs === "number" && config.clockSkewMs >= 0
        ? config.clockSkewMs
        : 30_000,
    waitTimeoutMs:
      typeof config.waitTimeoutMs === "number" && config.waitTimeoutMs >= 0
        ? config.waitTimeoutMs
        : 1_000,
    allowedKeys,
    allowedExecutors: asStringArray(config.allowedExecutors),
    allowedCapabilities: asStringArray(config.allowedCapabilities),
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
    if (resolved.allowedExecutors.length === 0 || resolved.allowedCapabilities.length === 0) {
      throw new ConstitutionalError(
        "CONSTITUTION_INVALID",
        "Executor and capability allowlists are required when enabled.",
      );
    }
  }
  return resolved;
}
