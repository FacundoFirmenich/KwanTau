import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { canonicalJson, sha256Hex } from "./canonical-json.js";
import type { ConstitutionalExecuteParams, ConstitutionalStatus, GatewayRequest } from "./types.js";

export type ShadowExpectation = "ACCEPT" | "REJECT";

export type ShadowCampaignCase = {
  caseId: string;
  family: string;
  description: string;
  expectation: ShadowExpectation;
  params: ConstitutionalExecuteParams;
  expectedErrorCode?: string;
};

export type ShadowCampaignObservation = {
  caseId: string;
  family: string;
  description: string;
  expectation: ShadowExpectation;
  observed: ShadowExpectation;
  matched: boolean;
  expectedErrorCode?: string;
  observedErrorCode?: string;
  status?: ConstitutionalStatus["status"];
  envelopeHash: string;
  payloadHash: string;
  responseHash?: string;
  durationMs: number;
  recordedAtUnix: number;
};

export type ShadowCampaignSummary = {
  campaignId: string;
  cases: number;
  matched: number;
  mismatched: number;
  acceptedExpected: number;
  acceptedObserved: number;
  rejectedExpected: number;
  rejectedObserved: number;
  errorCodeMatches: number;
  reportHash: string;
};

export type ShadowCampaignReport = {
  schemaVersion: "CFL_KCH_SHADOW_CAMPAIGN_V1";
  campaignId: string;
  startedAtUnix: number;
  completedAtUnix: number;
  observations: ShadowCampaignObservation[];
  summary: ShadowCampaignSummary;
};

type GatewayErrorLike = Error & {
  code?: string;
  details?: { code?: string } & Record<string, unknown>;
  error?: { code?: string; details?: { code?: string } };
};

function readConstitutionalErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as GatewayErrorLike;
  return (
    candidate.details?.code ??
    candidate.error?.details?.code ??
    candidate.error?.code ??
    candidate.code
  );
}

function acceptedStatus(status: ConstitutionalStatus["status"]): boolean {
  return ["SHADOW_ACCEPTED", "ACCEPTED", "RUNNING", "SUCCEEDED"].includes(status);
}

function finalizeSummary(
  campaignId: string,
  observations: ShadowCampaignObservation[],
): ShadowCampaignSummary {
  const withoutHash = {
    campaignId,
    cases: observations.length,
    matched: observations.filter((item) => item.matched).length,
    mismatched: observations.filter((item) => !item.matched).length,
    acceptedExpected: observations.filter((item) => item.expectation === "ACCEPT").length,
    acceptedObserved: observations.filter((item) => item.observed === "ACCEPT").length,
    rejectedExpected: observations.filter((item) => item.expectation === "REJECT").length,
    rejectedObserved: observations.filter((item) => item.observed === "REJECT").length,
    errorCodeMatches: observations.filter(
      (item) =>
        item.expectedErrorCode === undefined || item.expectedErrorCode === item.observedErrorCode,
    ).length,
  };
  return { ...withoutHash, reportHash: sha256Hex({ ...withoutHash, observations }) };
}

export class ShadowCampaignRunner {
  constructor(private readonly gatewayRequest: GatewayRequest) {}

  async run(campaignId: string, cases: ShadowCampaignCase[]): Promise<ShadowCampaignReport> {
    if (!campaignId.trim()) throw new TypeError("campaignId is required.");
    if (cases.length === 0) throw new TypeError("At least one campaign case is required.");
    const ids = new Set<string>();
    for (const item of cases) {
      if (!item.caseId.trim()) throw new TypeError("Every campaign case requires caseId.");
      if (ids.has(item.caseId)) throw new TypeError(`Duplicate campaign caseId: ${item.caseId}`);
      ids.add(item.caseId);
    }

    const startedAtUnix = Date.now() / 1000;
    const observations: ShadowCampaignObservation[] = [];
    for (const item of cases) {
      const started = performance.now();
      const envelopeHash = sha256Hex(item.params.envelope);
      const payloadHash = sha256Hex(item.params.envelope.payload);
      try {
        const response = await this.gatewayRequest<ConstitutionalStatus>(
          "constitutional.execute",
          item.params as unknown as Record<string, unknown>,
          { scopes: ["operator.admin"] },
        );
        const observed: ShadowExpectation = acceptedStatus(response.status) ? "ACCEPT" : "REJECT";
        const matched = observed === item.expectation;
        observations.push({
          caseId: item.caseId,
          family: item.family,
          description: item.description,
          expectation: item.expectation,
          observed,
          matched,
          expectedErrorCode: item.expectedErrorCode,
          status: response.status,
          envelopeHash,
          payloadHash,
          responseHash: sha256Hex(response),
          durationMs: performance.now() - started,
          recordedAtUnix: Date.now() / 1000,
        });
      } catch (error) {
        const observedErrorCode = readConstitutionalErrorCode(error);
        const observed: ShadowExpectation = "REJECT";
        const matched =
          item.expectation === observed &&
          (item.expectedErrorCode === undefined || item.expectedErrorCode === observedErrorCode);
        observations.push({
          caseId: item.caseId,
          family: item.family,
          description: item.description,
          expectation: item.expectation,
          observed,
          matched,
          expectedErrorCode: item.expectedErrorCode,
          observedErrorCode,
          envelopeHash,
          payloadHash,
          durationMs: performance.now() - started,
          recordedAtUnix: Date.now() / 1000,
        });
      }
    }
    const completedAtUnix = Date.now() / 1000;
    return {
      schemaVersion: "CFL_KCH_SHADOW_CAMPAIGN_V1",
      campaignId,
      startedAtUnix,
      completedAtUnix,
      observations,
      summary: finalizeSummary(campaignId, observations),
    };
  }
}

export async function writeShadowCampaignReport(
  path: string,
  report: ShadowCampaignReport,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, canonicalJson(report) + "\n", { encoding: "utf8", mode: 0o600 });
  const jsonl = report.observations.map((item) => canonicalJson(item)).join("\n") + "\n";
  await writeFile(`${path}.jsonl`, jsonl, { encoding: "utf8", mode: 0o600 });
}

export async function appendShadowCampaignCheckpoint(
  path: string,
  observation: ShadowCampaignObservation,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await appendFile(path, canonicalJson(observation) + "\n", { encoding: "utf8", mode: 0o600 });
}
