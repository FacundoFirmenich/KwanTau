import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ConstitutionalStore } from "../src/store.js";

async function tempStoreRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "constitutional-sqlite-"));
}

const reservation = {
  idempotencyKey: "idem-atomic",
  envelopeHash: "a".repeat(64),
  payloadHash: "b".repeat(64),
  mode: "shadow" as const,
};

describe("constitutional SQLite store", () => {
  it("atomically reserves one idempotency key across independent connections", async () => {
    const root = await tempStoreRoot();
    const first = new ConstitutionalStore(root);
    const second = new ConstitutionalStore(root);
    const results = await Promise.all([
      first.reserve(reservation),
      second.reserve(reservation),
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
    await first.reserve(reservation);
    await expect(
      second.reserve({ ...reservation, envelopeHash: "c".repeat(64) }),
    ).rejects.toMatchObject({ code: "CONSTITUTION_IDEMPOTENCY_CONFLICT" });
    expect(await first.eventCount()).toBe(1);
    await first.close();
    await second.close();
  });

  it("persists terminal evidence and its operational event journal", async () => {
    const root = await tempStoreRoot();
    const first = new ConstitutionalStore(root);
    await first.reserve(reservation);
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
