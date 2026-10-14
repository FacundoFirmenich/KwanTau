import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { ConstitutionalStore } from "../src/store.js";

const execFileAsync = promisify(execFile);

async function reserveFromChild(root: string): Promise<{ created: boolean }> {
  const moduleUrl = pathToFileURL(resolve(import.meta.dirname, "../src/store.ts")).href;
  const program = `
    import { ConstitutionalStore } from ${JSON.stringify(moduleUrl)};
    const store = new ConstitutionalStore(${JSON.stringify(root)});
    const result = await store.reserve({
      idempotencyKey: "idem-multiprocess",
      envelopeHash: "a".repeat(64),
      payloadHash: "b".repeat(64),
      mode: "enforce",
    });
    process.stdout.write(JSON.stringify({ created: result.created }));
    await store.close();
  `;
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "--eval", program],
    {
      cwd: resolve(import.meta.dirname, ".."),
      encoding: "utf8",
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
    },
  );
  return JSON.parse(stdout) as { created: boolean };
}

describe("constitutional SQLite multiprocess ownership", () => {
  it("admits exactly one reservation across two OS processes", async () => {
    const root = await mkdtemp(joinPath(tmpdir(), "constitutional-process-"));
    const results = await Promise.all([reserveFromChild(root), reserveFromChild(root)]);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(results.filter((result) => !result.created)).toHaveLength(1);

    const store = new ConstitutionalStore(root);
    expect(await store.eventCount("idem-multiprocess")).toBe(1);
    expect(await store.integrityCheck()).toBe("ok");
    await store.close();
  });
});

function joinPath(parent: string, child: string): string {
  return resolve(parent, child);
}
