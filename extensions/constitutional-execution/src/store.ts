import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { canonicalJson } from "./canonical-json.js";
import { ConstitutionalError } from "./errors.js";
import type {
  ConstitutionalMode,
  ConstitutionalRecord,
  ConstitutionalStatusValue,
  ConstitutionalStoreSnapshot,
} from "./types.js";

function emptySnapshot(): ConstitutionalStoreSnapshot {
  return { version: 1, records: {} };
}

export class ConstitutionalStore {
  private readonly snapshotPath: string;
  private readonly eventsPath: string;
  private queue: Promise<void> = Promise.resolve();
  private loaded = false;
  private snapshot: ConstitutionalStoreSnapshot = emptySnapshot();

  constructor(private readonly root: string) {
    this.snapshotPath = join(root, "records.json");
    this.eventsPath = join(root, "events.jsonl");
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    try {
      const raw = await readFile(this.snapshotPath, "utf8");
      const parsed = JSON.parse(raw) as ConstitutionalStoreSnapshot;
      if (parsed.version !== 1 || !parsed.records || typeof parsed.records !== "object") {
        throw new Error("invalid snapshot");
      }
      this.snapshot = parsed;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
      await this.persist();
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    const temporary = `${this.snapshotPath}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(temporary, canonicalJson(this.snapshot) + "\n", {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporary, this.snapshotPath);
  }

  private async appendEvent(type: string, record: ConstitutionalRecord): Promise<void> {
    const event = {
      index: Object.keys(this.snapshot.records).length,
      type,
      idempotencyKey: record.idempotencyKey,
      envelopeHash: record.envelopeHash,
      payloadHash: record.payloadHash,
      status: record.status,
      mode: record.mode,
      runId: record.runId,
      atUnix: Date.now() / 1000,
    };
    await appendFile(this.eventsPath, canonicalJson(event) + "\n", {
      encoding: "utf8",
      mode: 0o600,
    });
  }

  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async reserve(input: {
    idempotencyKey: string;
    envelopeHash: string;
    payloadHash: string;
    mode: ConstitutionalMode;
  }): Promise<{ record: ConstitutionalRecord; created: boolean }> {
    return this.serialized(async () => {
      await this.ensureLoaded();
      const existing = this.snapshot.records[input.idempotencyKey];
      if (existing) {
        if (existing.envelopeHash !== input.envelopeHash) {
          throw new ConstitutionalError(
            "CONSTITUTION_IDEMPOTENCY_CONFLICT",
            "Idempotency key is already bound to a different constitutional envelope.",
          );
        }
        return { record: structuredClone(existing), created: false };
      }
      const now = Date.now() / 1000;
      const record: ConstitutionalRecord = {
        idempotencyKey: input.idempotencyKey,
        envelopeHash: input.envelopeHash,
        payloadHash: input.payloadHash,
        status: input.mode === "shadow" ? "SHADOW_ACCEPTED" : "ACCEPTED",
        mode: input.mode,
        createdAtUnix: now,
        updatedAtUnix: now,
      };
      this.snapshot.records[input.idempotencyKey] = record;
      await this.persist();
      await this.appendEvent("RESERVED", record);
      return { record: structuredClone(record), created: true };
    });
  }

  async get(idempotencyKey: string): Promise<ConstitutionalRecord | undefined> {
    await this.ensureLoaded();
    const record = this.snapshot.records[idempotencyKey];
    return record ? structuredClone(record) : undefined;
  }

  async update(
    idempotencyKey: string,
    patch: Partial<Omit<ConstitutionalRecord, "idempotencyKey" | "envelopeHash" | "payloadHash">>,
    eventType: string,
  ): Promise<ConstitutionalRecord> {
    return this.serialized(async () => {
      await this.ensureLoaded();
      const current = this.snapshot.records[idempotencyKey];
      if (!current) {
        throw new ConstitutionalError(
          "CONSTITUTION_UNKNOWN",
          "Unknown constitutional execution.",
        );
      }
      const updated: ConstitutionalRecord = {
        ...current,
        ...patch,
        updatedAtUnix: Date.now() / 1000,
      };
      this.snapshot.records[idempotencyKey] = updated;
      await this.persist();
      await this.appendEvent(eventType, updated);
      return structuredClone(updated);
    });
  }

  async setStatus(
    idempotencyKey: string,
    status: ConstitutionalStatusValue,
    patch: Partial<Omit<ConstitutionalRecord, "idempotencyKey" | "envelopeHash" | "payloadHash" | "status">> = {},
  ): Promise<ConstitutionalRecord> {
    return this.update(idempotencyKey, { ...patch, status }, `STATUS_${status}`);
  }
}
