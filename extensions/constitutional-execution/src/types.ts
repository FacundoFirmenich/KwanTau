export type ConstitutionalMode = "shadow" | "enforce";

export type ConstitutionalAuthorityProof = {
  algorithm: "Ed25519";
  keyId: string;
  signedHash: string;
  signatureBase64: string;
};

export type ConstitutionalCommandEnvelope = {
  command_id: string;
  reservation_id: string;
  intent_id: string;
  lease_id: string;
  decision_id: string;
  candidate_id: string;
  permission_id: string;
  support_certificate_id: string;
  assurance_id: string;
  idempotency_key: string;
  executor_id: string;
  capability: string;
  payload: Record<string, unknown>;
  payload_hash: string;
  schema_hash: string;
  code_hash: string;
  environment_hash: string;
  policy_hash: string;
  contract_hash: string;
  host_id: string;
  session_id: string;
  scope: Record<string, unknown>;
  budget: Record<string, number>;
  epoch: number;
  created_at_unix: number;
  expires_at_unix: number;
  metadata?: Record<string, unknown>;
};

export type ConstitutionalExecuteParams = {
  idempotencyKey: string;
  envelope: ConstitutionalCommandEnvelope;
  authorityProof: ConstitutionalAuthorityProof;
};

export type ConstitutionalCancelParams = {
  idempotencyKey: string;
  reason: string;
  authorityProof: ConstitutionalAuthorityProof;
};

export type ConstitutionalReconcileParams = {
  idempotencyKey: string;
  runId: string;
  sessionKey?: string;
  reason: string;
  authorityProof: ConstitutionalAuthorityProof;
};

export type ConstitutionalStatusValue =
  | "UNKNOWN"
  | "SHADOW_ACCEPTED"
  | "ACCEPTED"
  | "DISPATCHING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "TIMEOUT"
  | "IN_DOUBT"
  | "CANCEL_REQUESTED";

export type ConstitutionalStatus = {
  idempotencyKey: string;
  status: ConstitutionalStatusValue;
  mode: ConstitutionalMode;
  envelopeHash?: string;
  payloadHash?: string;
  runId?: string;
  sessionKey?: string;
  output?: unknown;
  outputHash?: string;
  error?: string;
  createdAtUnix?: number;
  updatedAtUnix?: number;
  completedAtUnix?: number;
  metadata?: Record<string, unknown>;
};

export type ConstitutionalPluginConfig = {
  enabled: boolean;
  mode: ConstitutionalMode;
  storePath: string;
  hostId: string;
  activePolicyHash: string;
  maxIntentAgeMs: number;
  maxLeaseDurationMs: number;
  maxLiveAuthorityAgeMs: number;
  liveAuthorityVerifierMethod?: string;
  kchAuthorityBrokerCommand?: string;
  kchAuthorityDatabase?: string;
  kchAuthorityBrokerTimeoutMs: number;
  kchClaimTtlSeconds: number;
  clockSkewMs: number;
  minimumEpoch: number;
  revokedLeaseIds: string[];
  waitTimeoutMs: number;
  allowedKeys: Array<{
    keyId: string;
    publicKeyPem: string;
    enabled: boolean;
  }>;
  allowedExecutors: string[];
  allowedCapabilities: string[];
  allowedContractHashes: string[];
  allowedSessionPrefixes: string[];
  maxBudget: Record<string, number>;
};

export type ConstitutionalRecord = {
  idempotencyKey: string;
  envelopeHash: string;
  payloadHash: string;
  status: ConstitutionalStatusValue;
  mode: ConstitutionalMode;
  runId?: string;
  sessionKey?: string;
  output?: unknown;
  outputHash?: string;
  error?: string;
  createdAtUnix: number;
  updatedAtUnix: number;
  completedAtUnix?: number;
  metadata?: Record<string, unknown>;
};

type GatewayScope =
  | "operator.read"
  | "operator.write"
  | "operator.admin"
  | "operator.approvals"
  | "operator.pairing"
  | "operator.talk"
  | "operator.talk.secrets";

export type ConstitutionalLiveAuthorityResult = {
  active: boolean;
  leaseId: string;
  reservationId: string;
  decisionId: string;
  intentId: string;
  policyHash: string;
  epoch: number;
  generation: string;
  verifiedAtUnix: number;
  reason?: string;
};

export type GatewayRequest = <T = unknown>(
  method: string,
  params?: Record<string, unknown>,
  options?: { timeoutMs?: number; scopes?: GatewayScope[] },
) => Promise<T>;
