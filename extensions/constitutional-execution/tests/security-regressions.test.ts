import { generateKeyPairSync } from "node:crypto";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJson, sha256Hex } from "../src/canonical-json.js";
import { resolveConstitutionalConfig } from "../src/config.js";

function baseConfig(publicKeyPem: string) {
  return {
    enabled: true,
    mode: "enforce",
    hostId: "host-1",
    activePolicyHash: "a".repeat(64),
    allowedExecutors: ["openclaw.agent"],
    allowedCapabilities: ["agent.run"],
    allowedContractHashes: ["b".repeat(64)],
    allowedSessionPrefixes: ["agent:test:"],
    maxBudget: { tokens: 1024 },
    liveAuthorityVerifierMethod: "kch.authority.verify",
    kchAuthorityBrokerCommand: process.execPath,
    kchAuthorityDatabase: resolve(tmpdir(), "kch-native-test.sqlite"),
    kchAuthorityBrokerTimeoutMs: 2_000,
    kchClaimTtlSeconds: 5,
    allowedKeys: [{ keyId: "key-1", publicKeyPem }],
  };
}

describe("constitutional security regressions", () => {
  it("preserves an own __proto__ member in canonical commitments", () => {
    const withProto = JSON.parse('{"__proto__":{"polluted":true},"x":1}') as Record<string, unknown>;
    const withoutProto = JSON.parse('{"x":1}') as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(withProto, "__proto__")).toBe(true);
    expect(canonicalJson(withProto)).toContain('"__proto__"');
    expect(sha256Hex(withProto)).not.toBe(sha256Hex(withoutProto));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("rejects RSA keys from the Ed25519 authority keyring", () => {
    const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
    expect(() => resolveConstitutionalConfig(baseConfig(pem))).toThrow(/must be Ed25519/);
  });

  it("accepts an actual Ed25519 public key", () => {
    const { publicKey } = generateKeyPairSync("ed25519");
    const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const resolved = resolveConstitutionalConfig(baseConfig(pem));
    expect(resolved.allowedKeys).toHaveLength(1);
    expect(resolved.liveAuthorityVerifierMethod).toBe("kch.authority.verify");
  });

  it("refuses enforce mode without the transactional KCH broker paths", () => {
    const { publicKey } = generateKeyPairSync("ed25519");
    const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const input = baseConfig(pem);
    delete (input as { kchAuthorityBrokerCommand?: string }).kchAuthorityBrokerCommand;
    expect(() => resolveConstitutionalConfig(input)).toThrow(/kchAuthorityBrokerCommand/);
  });
});
