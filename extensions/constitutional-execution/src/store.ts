import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { canonicalJson } from "./canonical-json.js";
import { ConstitutionalError } from "./errors.js";
import type {
  ConstitutionalMode,
  ConstitutionalRecord,
  ConstitutionalStatusValue,
} from "./types.js";

type RecordRow = {
  idempotency_key: string;
  envelope_hash: string;
  payload_hash: string;
  status: ConstitutionalStatusValue;
  mode: ConstitutionalMode;
  run_id: string | null;
  session_key: string | null;
  output_json: string | null;
  output_hash: string | null;
  error: string | null;
  created_at_unix: number;
  updated_at_unix: number;
  completed_at_unix: number | null;
  metadata_json: string | null;
};

function parseJson(value: string | null): unknown {
  return value === null ? undefined : JSON.parse(value);
}

function toRecord(row: RecordRow): ConstitutionalRecord {
  return {
    idempotencyKey: row.idempotency_key,
    envelopeHash: row.envelope_hash,
    payloadHash: row.payload_hash,
    status: row.status,
    mode: row.mode,
    runId: row.run_id ?? undefined,
    sessionKey: row.session_key ?? undefined,
    output: parseJson(row.output_json),
    outputHash: row.output_hash ?? undefined,
    error: row.error ?? undefined,
    createdAtUnix: row.created_at_unix,
    updatedAtUnix: row.updated_at_unix,
    completedAtUnix: row.completed_at_unix ?? undefined,
    metadata: parseJson(row.metadata_json) as Record<string, unknown> | undefined,
  };
}

function jsonOrNull(value: unknown): string | null {
  return value === undefined ? null : canonicalJson(value);
}

function definedPatch<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}

export class ConstitutionalStore {
  private readonly databasePath: string;
  private databasePromise?: Promise<DatabaseSync>;

  constructor(private readonly root: string) {
    this.databasePath = join(root, "constitutional-execution.sqlite");
  }

  private async database(): Promise<DatabaseSync> {
    if (!this.databasePromise) {
      this.databasePromise = (async () => {
        await mkdir(this.root, { recursive: true, mode: 0o700 });
        const database = new DatabaseSync(this.databasePath);
        database.exec(`
          PRAGMA journal_mode = WAL;
          PRAGMA synchronous = FULL;
          PRAGMA foreign_keys = ON;
          PRAGMA busy_timeout = 5000;
          CREATE TABLE IF NOT EXISTS constitutional_records (
            idempotency_key TEXT PRIMARY KEY,
            envelope_hash TEXT NOT NULL,
            payload_hash TEXT NOT NULL,
            status TEXT NOT NULL,
            mode TEXT NOT NULL,
            run_id TEXT,
            session_key TEXT,
            output_json TEXT,
            output_hash TEXT,
            error TEXT,
            created_at_unix REAL NOT NULL,
            updated_at_unix REAL NOT NULL,
            completed_at_unix REAL,
            metadata_json TEXT
          );
          CREATE TABLE IF NOT EXISTS constitutional_events (
            event_id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            idempotency_key TEXT NOT NULL,
            envelope_hash TEXT NOT NULL,
            payload_hash TEXT NOT NULL,
            status TEXT NOT NULL,
            mode TEXT NOT NULL,
            run_id TEXT,
            event_json TEXT NOT NULL,
            at_unix REAL NOT NULL,
            FOREIGN KEY (idempotency_key)
              REFERENCES constitutional_records(idempotency_key)
          );
          CREATE INDEX IF NOT EXISTS constitutional_events_key_idx
            ON constitutional_events(idempotency_key, event_id);
        `);
        return database;
      })();
    }
    return this.databasePromise;
  }

  private selectRecord(database: DatabaseSync, idempotencyKey: string): ConstitutionalRecord | undefined {
    const row = database
      .prepare("SELECT * FROM constitutional_records WHERE idempotency_key = ?")
      .get(idempotencyKey) as RecordRow | undefined;
    return row ? toRecord(row) : undefined;
  }

  private appendEvent(
    database: DatabaseSync,
    eventType: string,
    record: ConstitutionalRecord,
  ): void {
    const atUnix = Date.now() / 1000;
    const event = {
      eventType,
      idempotencyKey: record.idempotencyKey,
      envelopeHash: record.envelopeHash,
      payloadHash: record.payloadHash,
      status: record.status,
      mode: record.mode,
      runId: record.runId,
      atUnix,
    };
    database
      .prepare(`
        INSERT INTO constitutional_events (
          event_type, idempotency_key, envelope_hash, payload_hash,
          status, mode, run_id, event_json, at_unix
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        eventType,
        record.idempotencyKey,
        record.envelopeHash,
        record.payloadHash,
        record.status,
        record.mode,
        record.runId ?? null,
        canonicalJson(event),
        atUnix,
      );
  }

  private transaction<T>(database: DatabaseSync, operation: () => T): T {
    database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      database.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // Preserve the original failure. SQLite already rolled back on some fatal errors.
      }
      throw error;
    }
  }

  private writeRecord(database: DatabaseSync, record: ConstitutionalRecord): void {
    database
      .prepare(`
        UPDATE constitutional_records SET
          status = ?, mode = ?, run_id = ?, session_key = ?, output_json = ?,
          output_hash = ?, error = ?, updated_at_unix = ?, completed_at_unix = ?,
          metadata_json = ?
        WHERE idempotency_key = ?
      `)
      .run(
        record.status,
        record.mode,
        record.runId ?? null,
        record.sessionKey ?? null,
        jsonOrNull(record.output),
        record.outputHash ?? null,
        record.error ?? null,
        record.updatedAtUnix,
        record.completedAtUnix ?? null,
        jsonOrNull(record.metadata),
        record.idempotencyKey,
      );
  }

  async reserve(input: {
    idempotencyKey: string;
    envelopeHash: string;
    payloadHash: string;
    mode: ConstitutionalMode;
  }): Promise<{ record: ConstitutionalRecord; created: boolean }> {
    const database = await this.database();
    return this.transaction(database, () => {
      const existing = this.selectRecord(database, input.idempotencyKey);
      if (existing) {
        if (
          existing.envelopeHash !== input.envelopeHash ||
          existing.payloadHash !== input.payloadHash
        ) {
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
      database
        .prepare(`
          INSERT INTO constitutional_records (
            idempotency_key, envelope_hash, payload_hash, status, mode,
            created_at_unix, updated_at_unix
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          record.idempotencyKey,
          record.envelopeHash,
          record.payloadHash,
          record.status,
          record.mode,
          record.createdAtUnix,
          record.updatedAtUnix,
        );
      this.appendEvent(database, "RESERVED", record);
      return { record: structuredClone(record), created: true };
    });
  }

  async get(idempotencyKey: string): Promise<ConstitutionalRecord | undefined> {
    return this.selectRecord(await this.database(), idempotencyKey);
  }

  async update(
    idempotencyKey: string,
    patch: Partial<Omit<ConstitutionalRecord, "idempotencyKey" | "envelopeHash" | "payloadHash">>,
    eventType: string,
  ): Promise<ConstitutionalRecord> {
    const database = await this.database();
    return this.transaction(database, () => {
      const current = this.selectRecord(database, idempotencyKey);
      if (!current) {
        throw new ConstitutionalError(
          "CONSTITUTION_UNKNOWN",
          "Unknown constitutional execution.",
        );
      }
      const updated: ConstitutionalRecord = {
        ...current,
        ...definedPatch(patch),
        updatedAtUnix: Date.now() / 1000,
      };
      this.writeRecord(database, updated);
      this.appendEvent(database, eventType, updated);
      return structuredClone(updated);
    });
  }

  async transitionStatus(
    idempotencyKey: string,
    fromStatuses: readonly ConstitutionalStatusValue[],
    status: ConstitutionalStatusValue,
    patch: Partial<
      Omit<ConstitutionalRecord, "idempotencyKey" | "envelopeHash" | "payloadHash" | "status">
    > = {},
  ): Promise<{ record: ConstitutionalRecord; transitioned: boolean }> {
    const database = await this.database();
    return this.transaction(database, () => {
      const current = this.selectRecord(database, idempotencyKey);
      if (!current) {
        throw new ConstitutionalError(
          "CONSTITUTION_UNKNOWN",
          "Unknown constitutional execution.",
        );
      }
      if (!fromStatuses.includes(current.status)) {
        return { record: structuredClone(current), transitioned: false };
      }
      const updated: ConstitutionalRecord = {
        ...current,
        ...definedPatch(patch),
        status,
        updatedAtUnix: Date.now() / 1000,
      };
      this.writeRecord(database, updated);
      this.appendEvent(database, `STATUS_${status}`, updated);
      return { record: structuredClone(updated), transitioned: true };
    });
  }

  async setStatus(
    idempotencyKey: string,
    status: ConstitutionalStatusValue,
    patch: Partial<
      Omit<ConstitutionalRecord, "idempotencyKey" | "envelopeHash" | "payloadHash" | "status">
    > = {},
  ): Promise<ConstitutionalRecord> {
    return this.update(idempotencyKey, { ...patch, status }, `STATUS_${status}`);
  }

  async integrityCheck(): Promise<string> {
    const row = (await this.database())
      .prepare("PRAGMA integrity_check")
      .get() as Record<string, unknown>;
    return String(Object.values(row)[0]);
  }

  async eventCount(idempotencyKey?: string): Promise<number> {
    const database = await this.database();
    const row = idempotencyKey
      ? (database
          .prepare("SELECT COUNT(*) AS count FROM constitutional_events WHERE idempotency_key = ?")
          .get(idempotencyKey) as { count: number })
      : (database.prepare("SELECT COUNT(*) AS count FROM constitutional_events").get() as {
          count: number;
        });
    return Number(row.count);
  }

  async close(): Promise<void> {
    if (!this.databasePromise) return;
    const database = await this.databasePromise;
    database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    database.close();
    this.databasePromise = undefined;
  }
}
