import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConstitutionalStore } from "../src/store.js";

async function tempStoreRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "constitutional-sqlite-"));
}

const shadowReservation = {
  idempotencyKey: "idem-atomic",
  envelopeHash: "a".repeat(64),
  payloadHash: "b".repeat(64),
  mode: "shadow" as const,
};

const enforceReservation = {
  ...shadowReservation,
  mode: "enforce" as const,
};

describe("constitutional SQLite store", () => {
  it("atomically reserves one idempotency key across independent connections", async () => {
    const root = await tempStoreRoot();
    const first = new ConstitutionalStore(root);
    const second = new ConstitutionalStore(root);
    const results = await Promise.all([
      first.reserve(shadowReservation),
      second.reserve(shadowReservation),
    ]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results.filter((result) => !result.created)).toHaveLength(1);
    expect(await first.eventCount("idem-atomic")).toBe(1);
    expect(await second.integrityCheck()).toBe("ok");
    await first.close();
    await second.close();
  });

  it("rejects a conflicting envelope across independent connections", async () => {
    const root = await tempStoreRoot();
    const first = new ConstitutionalStore(root);
    const second = new ConstitutionalStore(root);
    await first.reserve(shadowReservation);
    await expect(
      second.reserve({ ...shadowReservation, envelopeHash: "c".repeat(64) }),
    ).rejects.toMatchObject({ code: "CONSTITUTION_IDEMPOTENCY_CONFLICT" });
    expect(await first.eventCount()).toBe(1);
    await first.close();
    await second.close();
  });

  it("forbids promotion of a shadow reservation into an executed outcome", async () => {
    const root = await tempStoreRoot();
    const store = new ConstitutionalStore(root);
    await store.reserve(shadowReservation);
    await expect(
      store.setStatus("idem-atomic", "SUCCEEDED", {
        runId: "forbidden-run",
        completedAtUnix: 123,
      }),
    ).rejects.toMatchObject({ code: "CONSTITUTION_INVALID" });
    expect((await store.get("idem-atomic"))?.status).toBe("SHADOW_ACCEPTED");
    await store.close();
  });

  it("persists terminal evidence and its operational event journal for enforce mode", async () => {
    const root = await tempStoreRoot();
    const first = new ConstitutionalStore(root);
    await first.reserve(enforceReservation);
    await first.setStatus("idem-atomic", "SUCCEEDED", {
      runId: "run-1",
      output: { status: "ok" },
      outputHash: "d".repeat(64),
      completedAtUnix: 123,
      metadata: { receipt: "receipt-1" },
    });
    expect(await first.eventCount("idem-atomic")).toBe(2);
    await first.close();

    const reopened = new ConstitutionalStore(root);
    const record = await reopened.get("idem-atomic");
    expect(record).toMatchObject({
      status: "SUCCEEDED",
      runId: "run-1",
      output: { status: "ok" },
      outputHash: "d".repeat(64),
      completedAtUnix: 123,
      metadata: { receipt: "receipt-1" },
    });
    expect(await reopened.integrityCheck()).toBe("ok");
    await reopened.close();
  });
});
