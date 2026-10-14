import { describe, expect, it } from "vitest";
import { ShadowCampaignRunner } from "../src/shadow-campaign.js";
import type { ConstitutionalExecuteParams, GatewayRequest } from "../src/types.js";

function params(id: string): ConstitutionalExecuteParams {
  return {
    idempotencyKey: id,
    envelope: {
      command_id: `command-${id}`,
      reservation_id: `reservation-${id}`,
      intent_id: `intent-${id}`,
      lease_id: `lease-${id}`,
      decision_id: `decision-${id}`,
      candidate_id: `candidate-${id}`,
      permission_id: `permission-${id}`,
      support_certificate_id: `support-${id}`,
      assurance_id: `assurance-${id}`,
      idempotency_key: id,
      executor_id: "openclaw.agent",
      capability: "agent.run",
      payload: { message: "READY", sessionKey: "agent:test:main" },
      payload_hash: "a".repeat(64),
      schema_hash: "b".repeat(64),
      code_hash: "c".repeat(64),
      environment_hash: "d".repeat(64),
      policy_hash: "e".repeat(64),
      contract_hash: "f".repeat(64),
      host_id: "host",
      session_id: "agent:test:main",
      scope: { session: "agent:test:main" },
      budget: { tokens: 1 },
      epoch: 1,
      created_at_unix: 1,
      expires_at_unix: 2,
    },
    authorityProof: {
      algorithm: "Ed25519",
      keyId: "key",
      signedHash: "0".repeat(64),
      signatureBase64: "AA==",
    },
  };
}

describe("shadow campaign", () => {
  it("classifies accepted and rejected constitutional cases", async () => {
    const request: GatewayRequest = async <T>(method: string, input?: Record<string, unknown>) => {
      expect(method).toBe("constitutional.execute");
      const key = String(input?.idempotencyKey);
      if (key === "reject") {
        const error = new Error("rejected") as Error & { details: { code: string } };
        error.details = { code: "CONSTITUTION_POLICY_MISMATCH" };
        throw error;
      }
      return {
        idempotencyKey: key,
        status: "SHADOW_ACCEPTED",
        mode: "shadow",
      } as T;
    };
    const runner = new ShadowCampaignRunner(request);
    const report = await runner.run("campaign-1", [
      {
        caseId: "valid",
        family: "control",
        description: "valid envelope",
        expectation: "ACCEPT",
        params: params("accept"),
      },
      {
        caseId: "policy-mismatch",
        family: "policy",
        description: "stale policy",
        expectation: "REJECT",
        expectedErrorCode: "CONSTITUTION_POLICY_MISMATCH",
        params: params("reject"),
      },
    ]);
    expect(report.summary.cases).toBe(2);
    expect(report.summary.matched).toBe(2);
    expect(report.summary.mismatched).toBe(0);
    expect(report.summary.reportHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("marks an unexpected acceptance as mismatch", async () => {
    const request: GatewayRequest = async <T>() =>
      ({ idempotencyKey: "x", status: "SHADOW_ACCEPTED", mode: "shadow" }) as T;
    const report = await new ShadowCampaignRunner(request).run("campaign-2", [
      {
        caseId: "must-reject",
        family: "negative-control",
        description: "negative control",
        expectation: "REJECT",
        params: params("x"),
      },
    ]);
    expect(report.summary.mismatched).toBe(1);
  });
});
