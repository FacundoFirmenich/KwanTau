import { createPublicKey, verify } from "node:crypto";
import { canonicalJson, sha256Hex } from "./canonical-json.js";
import { ConstitutionalError } from "./errors.js";
import type {
  ConstitutionalAuthorityProof,
  ConstitutionalCancelParams,
  ConstitutionalCommandEnvelope,
  ConstitutionalExecuteParams,
  ConstitutionalPluginConfig,
} from "./types.js";

const SHA256_HEX = /^[a-f0-9]{64}$/;

function requireNonEmpty(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new ConstitutionalError("CONSTITUTION_INVALID", `${name} is required.`);
  }
}

function validateHash(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || !SHA256_HEX.test(value)) {
    throw new ConstitutionalError(
      "CONSTITUTION_INVALID",
      `${name} must be lowercase SHA-256 hexadecimal.`,
    );
  }
}

function requireEnvelopeShape(envelope: ConstitutionalCommandEnvelope): void {
  for (const key of [
    "command_id",
    "reservation_id",
    "intent_id",
    "lease_id",
    "decision_id",
    "candidate_id",
    "permission_id",
    "support_certificate_id",
    "assurance_id",
    "idempotency_key",
    "executor_id",
    "capability",
    "host_id",
    "session_id",
  ] as const) {
    requireNonEmpty(envelope[key], key);
  }
  for (const key of [
    "payload_hash",
    "schema_hash",
    "code_hash",
    "environment_hash",
    "policy_hash",
    "contract_hash",
  ] as const) {
    validateHash(envelope[key], key);
  }
  if (!envelope.payload || typeof envelope.payload !== "object" || Array.isArray(envelope.payload)) {
    throw new ConstitutionalError("CONSTITUTION_INVALID", "payload must be an object.");
  }
  if (!envelope.scope || typeof envelope.scope !== "object" || Array.isArray(envelope.scope)) {
    throw new ConstitutionalError("CONSTITUTION_INVALID", "scope must be an object.");
  }
  if (!envelope.budget || typeof envelope.budget !== "object" || Array.isArray(envelope.budget)) {
    throw new ConstitutionalError("CONSTITUTION_INVALID", "budget must be an object.");
  }
  if (!Number.isInteger(envelope.epoch) || envelope.epoch < 0) {
    throw new ConstitutionalError("CONSTITUTION_INVALID", "epoch must be non-negative integer.");
  }
}

function validateProof(
  envelope: ConstitutionalCommandEnvelope,
  proof: ConstitutionalAuthorityProof,
  config: ConstitutionalPluginConfig,
): string {
  if (proof.algorithm !== "Ed25519") {
    throw new ConstitutionalError(
      "CONSTITUTION_SIGNATURE_INVALID",
      "Only Ed25519 authority proofs are accepted.",
    );
  }
  validateHash(proof.signedHash, "authorityProof.signedHash");
  requireNonEmpty(proof.keyId, "authorityProof.keyId");
  requireNonEmpty(proof.signatureBase64, "authorityProof.signatureBase64");

  const envelopeHash = sha256Hex(envelope);
  if (proof.signedHash !== envelopeHash) {
    throw new ConstitutionalError(
      "CONSTITUTION_SIGNATURE_INVALID",
      "Signed hash does not match canonical envelope hash.",
    );
  }
  const key = config.allowedKeys.find((candidate) => candidate.keyId === proof.keyId);
  if (!key?.enabled) {
    throw new ConstitutionalError(
      "CONSTITUTION_SIGNATURE_INVALID",
      "Authority key is unknown or disabled.",
    );
  }
  const valid = verify(
    null,
    Buffer.from(envelopeHash, "hex"),
    createPublicKey(key.publicKeyPem),
    Buffer.from(proof.signatureBase64, "base64"),
  );
  if (!valid) {
    throw new ConstitutionalError(
      "CONSTITUTION_SIGNATURE_INVALID",
      "Ed25519 authority proof verification failed.",
    );
  }
  return envelopeHash;
}

function validateTemporalBounds(
  envelope: ConstitutionalCommandEnvelope,
  config: ConstitutionalPluginConfig,
  nowMs: number,
): void {
  const createdMs = envelope.created_at_unix * 1000;
  const expiresMs = envelope.expires_at_unix * 1000;
  if (!Number.isFinite(createdMs) || !Number.isFinite(expiresMs)) {
    throw new ConstitutionalError("CONSTITUTION_INVALID", "Intent timestamps are invalid.");
  }
  if (createdMs > nowMs + config.clockSkewMs) {
    throw new ConstitutionalError("CONSTITUTION_INVALID", "Intent is dated in the future.");
  }
  if (nowMs - createdMs > config.maxIntentAgeMs) {
    throw new ConstitutionalError("CONSTITUTION_EXPIRED", "Intent age exceeds policy.");
  }
  if (expiresMs <= nowMs) {
    throw new ConstitutionalError("CONSTITUTION_EXPIRED", "Authority lease is expired.");
  }
  if (expiresMs <= createdMs) {
    throw new ConstitutionalError("CONSTITUTION_INVALID", "Lease expires before creation.");
  }
  if (expiresMs - createdMs > config.maxLeaseDurationMs) {
    throw new ConstitutionalError("CONSTITUTION_EXPIRED", "Lease duration exceeds policy.");
  }
}

function validateBudget(
  envelope: ConstitutionalCommandEnvelope,
  config: ConstitutionalPluginConfig,
): void {
  for (const [key, value] of Object.entries(envelope.budget)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new ConstitutionalError(
        "CONSTITUTION_BUDGET_DENIED",
        `Budget ${key} is invalid.`,
      );
    }
    const ceiling = config.maxBudget[key];
    if (ceiling === undefined || value > ceiling) {
      throw new ConstitutionalError(
        "CONSTITUTION_BUDGET_DENIED",
        `Budget ${key} exceeds or lacks a configured ceiling.`,
      );
    }
  }
}

export function validateExecuteParams(
  params: ConstitutionalExecuteParams,
  config: ConstitutionalPluginConfig,
  nowMs = Date.now(),
): { envelopeHash: string; payloadHash: string } {
  if (!config.enabled) {
    throw new ConstitutionalError("CONSTITUTION_DISABLED", "Constitutional execution is disabled.");
  }
  if (!params || typeof params !== "object") {
    throw new ConstitutionalError("CONSTITUTION_INVALID", "Request params are required.");
  }
  requireNonEmpty(params.idempotencyKey, "idempotencyKey");
  const envelope = params.envelope;
  if (!envelope || typeof envelope !== "object") {
    throw new ConstitutionalError("CONSTITUTION_INVALID", "envelope is required.");
  }
  requireEnvelopeShape(envelope);
  if (params.idempotencyKey !== envelope.idempotency_key) {
    throw new ConstitutionalError(
      "CONSTITUTION_IDEMPOTENCY_CONFLICT",
      "Outer and envelope idempotency keys differ.",
    );
  }
  const payloadHash = sha256Hex(envelope.payload);
  if (payloadHash !== envelope.payload_hash) {
    throw new ConstitutionalError(
      "CONSTITUTION_INVALID",
      "Payload commitment mismatch.",
    );
  }
  if (envelope.epoch < config.minimumEpoch) {
    throw new ConstitutionalError(
      "CONSTITUTION_EXPIRED",
      "Envelope epoch predates the active minimum epoch.",
    );
  }
  if (config.revokedLeaseIds.includes(envelope.lease_id)) {
    throw new ConstitutionalError("CONSTITUTION_EXPIRED", "Authority lease has been revoked.");
  }
  if (envelope.policy_hash !== config.activePolicyHash) {
    throw new ConstitutionalError(
      "CONSTITUTION_POLICY_MISMATCH",
      "Intent policy hash is not active.",
    );
  }
  if (!config.allowedContractHashes.includes(envelope.contract_hash)) {
    throw new ConstitutionalError(
      "CONSTITUTION_POLICY_MISMATCH",
      "Contract hash is not admitted by the active policy.",
    );
  }
  const payloadSessionKey = envelope.payload.sessionKey;
  if (typeof payloadSessionKey !== "string" || payloadSessionKey !== envelope.session_id) {
    throw new ConstitutionalError(
      "CONSTITUTION_SCOPE_DENIED",
      "Payload sessionKey must exactly match the constitutionally bound session_id.",
    );
  }
  if (envelope.scope.session !== envelope.session_id) {
    throw new ConstitutionalError(
      "CONSTITUTION_SCOPE_DENIED",
      "Scope session must exactly match session_id.",
    );
  }
  if (envelope.host_id !== config.hostId) {
    throw new ConstitutionalError(
      "CONSTITUTION_SCOPE_DENIED",
      "Intent host does not match this Gateway host.",
    );
  }
  if (!config.allowedExecutors.includes(envelope.executor_id)) {
    throw new ConstitutionalError(
      "CONSTITUTION_EXECUTOR_UNSUPPORTED",
      "Executor is not constitutionally admitted.",
    );
  }
  if (!config.allowedCapabilities.includes(envelope.capability)) {
    throw new ConstitutionalError(
      "CONSTITUTION_EXECUTOR_UNSUPPORTED",
      "Capability is not constitutionally admitted.",
    );
  }
  if (
    config.allowedSessionPrefixes.length > 0 &&
    !config.allowedSessionPrefixes.some((prefix) => envelope.session_id.startsWith(prefix))
  ) {
    throw new ConstitutionalError(
      "CONSTITUTION_SCOPE_DENIED",
      "Session is outside the permitted constitutional scope.",
    );
  }
  validateBudget(envelope, config);
  validateTemporalBounds(envelope, config, nowMs);
  const envelopeHash = validateProof(envelope, params.authorityProof, config);
  return { envelopeHash, payloadHash };
}

export function canonicalEnvelopeBytes(envelope: ConstitutionalCommandEnvelope): Buffer {
  return Buffer.from(canonicalJson(envelope), "utf8");
}

export function validateCancelParams(
  params: ConstitutionalCancelParams,
  config: ConstitutionalPluginConfig,
): string {
  if (!config.enabled) {
    throw new ConstitutionalError("CONSTITUTION_DISABLED", "Constitutional execution is disabled.");
  }
  requireNonEmpty(params.idempotencyKey, "idempotencyKey");
  requireNonEmpty(params.reason, "reason");
  const proof = params.authorityProof;
  if (!proof || proof.algorithm !== "Ed25519") {
    throw new ConstitutionalError(
      "CONSTITUTION_SIGNATURE_INVALID",
      "Cancellation requires an Ed25519 authority proof.",
    );
  }
  validateHash(proof.signedHash, "authorityProof.signedHash");
  const cancellationIntent = {
    operation: "constitutional.cancel",
    idempotencyKey: params.idempotencyKey,
    reason: params.reason,
    policyHash: config.activePolicyHash,
    hostId: config.hostId,
  };
  const expectedHash = sha256Hex(cancellationIntent);
  if (proof.signedHash !== expectedHash) {
    throw new ConstitutionalError(
      "CONSTITUTION_SIGNATURE_INVALID",
      "Cancellation proof does not bind the exact cancellation intent.",
    );
  }
  const key = config.allowedKeys.find((candidate) => candidate.keyId === proof.keyId);
  if (!key?.enabled) {
    throw new ConstitutionalError(
      "CONSTITUTION_SIGNATURE_INVALID",
      "Cancellation key is unknown or disabled.",
    );
  }
  const valid = verify(
    null,
    Buffer.from(expectedHash, "hex"),
    createPublicKey(key.publicKeyPem),
    Buffer.from(proof.signatureBase64, "base64"),
  );
  if (!valid) {
    throw new ConstitutionalError(
      "CONSTITUTION_SIGNATURE_INVALID",
      "Cancellation authority proof verification failed.",
    );
  }
  return expectedHash;
}
