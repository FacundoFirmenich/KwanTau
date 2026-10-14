import { randomUUID } from "node:crypto";
import { chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  openNodeSqliteDatabase,
  runSqliteImmediateTransactionSync,
} from "@openclaw/plugin-sdk/sqlite-runtime";
import { canonicalJson, sha256Hex } from "./canonical-json.js";
import { ConstitutionalError } from "./errors.js";
import type {
  ConstitutionalExecuteParams,
  ConstitutionalMode,
  ConstitutionalRecord,
  ConstitutionalStatusValue,
} from "./types.js";

type SqliteDatabase = ReturnType<typeof openNodeSqliteDatabase>;

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

type OutboxState =
  | "SHADOW"
  | "PENDING"
  | "CLAIMED"
  | "ACKED"
  | "IN_DOUBT"
  | "TERMINAL";

type OutboxRow = {
  idempotency_key: string;
  envelope_hash: string;
  request_hash: string;
  request_json: string;
  state: OutboxState;
  attempt_count: number;
  claim_token: string | null;
  claim_expires_unix: number | null;
  last_error: string | null;
  created_at_unix: number;
  updated_at_unix: number;
};

type ChainEventRow = {
  sequence: number;
  event_id: string;
  previous_hash: string;
  event_hash: string;
  event_json: string;
};

export type DispatchClaim = {
  claimed: boolean;
  record: ConstitutionalRecord;
  params?: ConstitutionalExecuteParams;
  claimToken?: string;
  attemptCount?: number;
};

const GENESIS_HASH = "0".repeat(64);
const TERMINAL_STATUSES = new Set<ConstitutionalStatusValue>([
  "SUCCEEDED",
  "FAILED",
  "TIMEOUT",
  "CANCEL_REQUESTED",
]);

const ALLOWED_TRANSITIONS: Record<ConstitutionalStatusValue, ReadonlySet<ConstitutionalStatusValue>> = {
  UNKNOWN: new Set(),
  SHADOW_ACCEPTED: new Set(["SHADOW_ACCEPTED"]),
  ACCEPTED: new Set(["ACCEPTED", "RUNNING", "IN_DOUBT", "FAILED", "CANCEL_REQUESTED"]),
  RUNNING: new Set(["RUNNING", "SUCCEEDED", "FAILED", "TIMEOUT", "IN_DOUBT", "CANCEL_REQUESTED"]),
  SUCCEEDED: new Set(["SUCCEEDED"]),
  FAILED: new Set(["FAILED"]),
  TIMEOUT: new Set(["TIMEOUT"]),
  IN_DOUBT: new Set(["IN_DOUBT", "RUNNING", "SUCCEEDED", "FAILED", "TIMEOUT", "CANCEL_REQUESTED"]),
  CANCEL_REQUESTED: new Set(["CANCEL_REQUESTED"]),
};

function assertStatusTransition(
  current: ConstitutionalStatusValue,
  next: ConstitutionalStatusValue,
): void {
  if (!ALLOWED_TRANSITIONS[current]?.has(next)) {
    throw new ConstitutionalError(
      "CONSTITUTION_INVALID",
      `Illegal constitutional status transition: ${current} -> ${next}.`,
    );
  }
}

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

function parseExecuteParams(value: string): ConstitutionalExecuteParams {
  const parsed = JSON.parse(value) as ConstitutionalExecuteParams;
  if (!parsed || typeof parsed !== "object" || typeof parsed.idempotencyKey !== "string") {
    throw new ConstitutionalError(
      "CONSTITUTION_INVALID",
      "Durable outbox contains an invalid constitutional request.",
    );
  }
  return parsed;
}

export class ConstitutionalStore {
  private readonly databasePath: string;
  private databasePromise?: Promise<SqliteDatabase>;

  constructor(private readonly root: string) {
    this.databasePath = join(root, "constitutional-execution.sqlite");
  }

  private async database(): Promise<SqliteDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = (async () => {
        await mkdir(this.root, { recursive: true, mode: 0o700 });
        const database = openNodeSqliteDatabase(this.databasePath);
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
          CREATE TABLE IF NOT EXISTS constitutional_outbox (
            idempotency_key TEXT PRIMARY KEY,
            envelope_hash TEXT NOT NULL,
            request_hash TEXT NOT NULL,
            request_json TEXT NOT NULL,
            state TEXT NOT NULL,
            attempt_count INTEGER NOT NULL DEFAULT 0,
            claim_token TEXT,
            claim_expires_unix REAL,
            last_error TEXT,
            created_at_unix REAL NOT NULL,
            updated_at_unix REAL NOT NULL,
            FOREIGN KEY (idempotency_key)
              REFERENCES constitutional_records(idempotency_key)
          );
          CREATE INDEX IF NOT EXISTS constitutional_outbox_recovery_idx
            ON constitutional_outbox(state, claim_expires_unix, updated_at_unix);
          CREATE TABLE IF NOT EXISTS constitutional_event_chain (
            sequence INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL UNIQUE,
            previous_hash TEXT NOT NULL,
            event_hash TEXT NOT NULL UNIQUE,
            event_type TEXT NOT NULL,
            idempotency_key TEXT,
            record_hash TEXT,
            event_json TEXT NOT NULL,
            at_unix REAL NOT NULL
          );
          CREATE INDEX IF NOT EXISTS constitutional_event_chain_key_idx
            ON constitutional_event_chain(idempotency_key, sequence);
          CREATE TABLE IF NOT EXISTS constitutional_chain_state (
            singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
            event_count INTEGER NOT NULL,
            head_hash TEXT NOT NULL
          );
          INSERT OR IGNORE INTO constitutional_chain_state (
            singleton, event_count, head_hash
          ) VALUES (1, 0, '${GENESIS_HASH}');
          PRAGMA user_version = 2;
        `);
        await chmod(this.databasePath, 0o600).catch(() => undefined);
        return database;
      })();
    }
    return this.databasePromise;
  }

  private selectRecord(
    database: SqliteDatabase,
    idempotencyKey: string,
  ): ConstitutionalRecord | undefined {
    const row = database
      .prepare("SELECT * FROM constitutional_records WHERE idempotency_key = ?")
      .get(idempotencyKey) as RecordRow | undefined;
    return row ? toRecord(row) : undefined;
  }

  private selectOutbox(database: SqliteDatabase, idempotencyKey: string): OutboxRow | undefined {
    return database
      .prepare("SELECT * FROM constitutional_outbox WHERE idempotency_key = ?")
      .get(idempotencyKey) as OutboxRow | undefined;
  }

  private appendChainEvent(
    database: SqliteDatabase,
    eventType: string,
    record: ConstitutionalRecord | undefined,
    details: Record<string, unknown> = {},
  ): string {
    const chainState = database
      .prepare(
        "SELECT event_count, head_hash FROM constitutional_chain_state WHERE singleton = 1",
      )
      .get() as { event_count: number; head_hash: string };
    const previousHash = chainState.head_hash;
    const atUnix = Date.now() / 1000;
    const body = {
      eventId: randomUUID(),
      eventType,
      idempotencyKey: record?.idempotencyKey,
      recordHash: record ? sha256Hex(record) : undefined,
      status: record?.status,
      mode: record?.mode,
      runId: record?.runId,
      details,
      atUnix,
    };
    const eventHash = sha256Hex({ previousHash, event: body });
    database
      .prepare(`
        INSERT INTO constitutional_event_chain (
          event_id, previous_hash, event_hash, event_type,
          idempotency_key, record_hash, event_json, at_unix
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        body.eventId,
        previousHash,
        eventHash,
        eventType,
        record?.idempotencyKey ?? null,
        body.recordHash ?? null,
        canonicalJson(body),
        atUnix,
      );
    database
      .prepare(`
        UPDATE constitutional_chain_state SET
          event_count = ?, head_hash = ?
        WHERE singleton = 1
      `)
      .run(Number(chainState.event_count) + 1, eventHash);
    return eventHash;
  }

  private transaction<T>(
    database: SqliteDatabase,
    operationLabel: string,
    operation: () => T,
  ): T {
    return runSqliteImmediateTransactionSync(database, operation, {
      busyTimeoutMs: 5_000,
      databaseLabel: "constitutional-execution",
      operationLabel,
      slowTransactionHoldMs: 1_000,
    });
  }

  async reserve(input: {
    idempotencyKey: string;
    envelopeHash: string;
    payloadHash: string;
    mode: ConstitutionalMode;
  }): Promise<{ record: ConstitutionalRecord; created: boolean }> {
    const syntheticParams = {
      idempotencyKey: input.idempotencyKey,
      envelope: {
        idempotency_key: input.idempotencyKey,
      },
      authorityProof: {},
    } as unknown as ConstitutionalExecuteParams;
    return this.reserveCommand({ ...input, params: syntheticParams, createOutbox: false });
  }

  async reserveCommand(input: {
    idempotencyKey: string;
    envelopeHash: string;
    payloadHash: string;
    mode: ConstitutionalMode;
    params: ConstitutionalExecuteParams;
    createOutbox?: boolean;
  }): Promise<{ record: ConstitutionalRecord; created: boolean }> {
    const database = await this.database();
    return this.transaction(database, "reserve-command", () => {
      const existing = this.selectRecord(database, input.idempotencyKey);
      const requestJson = canonicalJson(input.params);
      const requestHash = sha256Hex(input.params);
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
        const outbox = this.selectOutbox(database, input.idempotencyKey);
        if (outbox && outbox.request_hash !== requestHash) {
          throw new ConstitutionalError(
            "CONSTITUTION_IDEMPOTENCY_CONFLICT",
            "Idempotency key is already bound to a different signed request.",
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
      if (input.createOutbox !== false) {
        database
          .prepare(`
            INSERT INTO constitutional_outbox (
              idempotency_key, envelope_hash, request_hash, request_json,
              state, attempt_count, created_at_unix, updated_at_unix
            ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)
          `)
          .run(
            record.idempotencyKey,
            record.envelopeHash,
            requestHash,
            requestJson,
            input.mode === "shadow" ? "SHADOW" : "PENDING",
            now,
            now,
          );
      }
      this.appendChainEvent(database, "RESERVED", record, {
        requestHash,
        outbox: input.createOutbox !== false,
      });
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
    return this.transaction(database, "update-record", () => {
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
      assertStatusTransition(current.status, updated.status);
      database
        .prepare(`
          UPDATE constitutional_records SET
            status = ?, mode = ?, run_id = ?, session_key = ?, output_json = ?,
            output_hash = ?, error = ?, updated_at_unix = ?, completed_at_unix = ?,
            metadata_json = ?
          WHERE idempotency_key = ?
        `)
        .run(
          updated.status,
          updated.mode,
          updated.runId ?? null,
          updated.sessionKey ?? null,
          jsonOrNull(updated.output),
          updated.outputHash ?? null,
          updated.error ?? null,
          updated.updatedAtUnix,
          updated.completedAtUnix ?? null,
          jsonOrNull(updated.metadata),
          idempotencyKey,
        );
      if (TERMINAL_STATUSES.has(updated.status)) {
        database
          .prepare(`
            UPDATE constitutional_outbox SET
              state = 'TERMINAL', claim_token = NULL, claim_expires_unix = NULL,
              updated_at_unix = ?
            WHERE idempotency_key = ?
          `)
          .run(updated.updatedAtUnix, idempotencyKey);
      }
      this.appendChainEvent(database, eventType, updated);
      return structuredClone(updated);
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

  async claimDispatch(
    idempotencyKey: string,
    options: { claimTtlMs?: number } = {},
  ): Promise<DispatchClaim> {
    const database = await this.database();
    return this.transaction(database, "claim-dispatch", () => {
      const record = this.selectRecord(database, idempotencyKey);
      if (!record) {
        throw new ConstitutionalError(
          "CONSTITUTION_UNKNOWN",
          "Unknown constitutional execution.",
        );
      }
      const outbox = this.selectOutbox(database, idempotencyKey);
      if (!outbox || outbox.state === "SHADOW" || outbox.state === "ACKED" || outbox.state === "TERMINAL") {
        return { claimed: false, record };
      }
      const now = Date.now() / 1000;
      if (
        outbox.state === "CLAIMED" &&
        outbox.claim_expires_unix !== null &&
        outbox.claim_expires_unix > now
      ) {
        return { claimed: false, record };
      }
      const claimToken = randomUUID();
      const claimExpiresUnix = now + (options.claimTtlMs ?? 30_000) / 1000;
      const attemptCount = Number(outbox.attempt_count) + 1;
      database
        .prepare(`
          UPDATE constitutional_outbox SET
            state = 'CLAIMED', attempt_count = ?, claim_token = ?,
            claim_expires_unix = ?, updated_at_unix = ?
          WHERE idempotency_key = ?
        `)
        .run(attemptCount, claimToken, claimExpiresUnix, now, idempotencyKey);
      this.appendChainEvent(database, "DISPATCH_CLAIMED", record, {
        claimToken,
        claimExpiresUnix,
        attemptCount,
      });
      return {
        claimed: true,
        record,
        params: parseExecuteParams(outbox.request_json),
        claimToken,
        attemptCount,
      };
    });
  }

  async acknowledgeDispatch(input: {
    idempotencyKey: string;
    claimToken: string;
    runId: string;
    sessionKey?: string;
    acceptance: Record<string, unknown>;
  }): Promise<ConstitutionalRecord> {
    const database = await this.database();
    return this.transaction(database, "acknowledge-dispatch", () => {
      const record = this.selectRecord(database, input.idempotencyKey);
      const outbox = this.selectOutbox(database, input.idempotencyKey);
      if (!record || !outbox) {
        throw new ConstitutionalError(
          "CONSTITUTION_UNKNOWN",
          "Unknown constitutional execution.",
        );
      }
      if (outbox.state !== "CLAIMED" || outbox.claim_token !== input.claimToken) {
        throw new ConstitutionalError(
          "CONSTITUTION_IDEMPOTENCY_CONFLICT",
          "Dispatch claim is stale or owned by another worker.",
        );
      }
      const now = Date.now() / 1000;
      const updated: ConstitutionalRecord = {
        ...record,
        status: "RUNNING",
        runId: input.runId,
        sessionKey: input.sessionKey,
        metadata: { acceptance: input.acceptance },
        error: undefined,
        updatedAtUnix: now,
      };
      database
        .prepare(`
          UPDATE constitutional_records SET
            status = 'RUNNING', run_id = ?, session_key = ?, error = NULL,
            metadata_json = ?, updated_at_unix = ?
          WHERE idempotency_key = ?
        `)
        .run(
          updated.runId,
          updated.sessionKey ?? null,
          jsonOrNull(updated.metadata),
          now,
          input.idempotencyKey,
        );
      database
        .prepare(`
          UPDATE constitutional_outbox SET
            state = 'ACKED', claim_token = NULL, claim_expires_unix = NULL,
            last_error = NULL, updated_at_unix = ?
          WHERE idempotency_key = ?
        `)
        .run(now, input.idempotencyKey);
      this.appendChainEvent(database, "DISPATCH_ACKED", updated, {
        claimToken: input.claimToken,
        runId: input.runId,
      });
      return structuredClone(updated);
    });
  }

  async markDispatchInDoubt(input: {
    idempotencyKey: string;
    claimToken: string;
    error: string;
  }): Promise<ConstitutionalRecord> {
    const database = await this.database();
    return this.transaction(database, "mark-dispatch-in-doubt", () => {
      const record = this.selectRecord(database, input.idempotencyKey);
      const outbox = this.selectOutbox(database, input.idempotencyKey);
      if (!record || !outbox) {
        throw new ConstitutionalError(
          "CONSTITUTION_UNKNOWN",
          "Unknown constitutional execution.",
        );
      }
      if (outbox.state !== "CLAIMED" || outbox.claim_token !== input.claimToken) {
        throw new ConstitutionalError(
          "CONSTITUTION_IDEMPOTENCY_CONFLICT",
          "Dispatch claim is stale or owned by another worker.",
        );
      }
      const now = Date.now() / 1000;
      const updated: ConstitutionalRecord = {
        ...record,
        status: "IN_DOUBT",
        error: input.error,
        updatedAtUnix: now,
      };
      database
        .prepare(`
          UPDATE constitutional_records SET
            status = 'IN_DOUBT', error = ?, updated_at_unix = ?
          WHERE idempotency_key = ?
        `)
        .run(input.error, now, input.idempotencyKey);
      database
        .prepare(`
          UPDATE constitutional_outbox SET
            state = 'IN_DOUBT', claim_token = NULL, claim_expires_unix = NULL,
            last_error = ?, updated_at_unix = ?
          WHERE idempotency_key = ?
        `)
        .run(input.error, now, input.idempotencyKey);
      this.appendChainEvent(database, "DISPATCH_IN_DOUBT", updated, {
        claimToken: input.claimToken,
        error: input.error,
      });
      return structuredClone(updated);
    });
  }

  async listRecoverable(limit = 100): Promise<string[]> {
    const now = Date.now() / 1000;
    const rows = (await this.database())
      .prepare(`
        SELECT idempotency_key FROM constitutional_outbox
        WHERE state IN ('PENDING', 'IN_DOUBT')
           OR (state = 'CLAIMED' AND claim_expires_unix <= ?)
        ORDER BY updated_at_unix ASC
        LIMIT ?
      `)
      .all(now, Math.max(1, Math.trunc(limit))) as Array<{ idempotency_key: string }>;
    return rows.map((row) => row.idempotency_key);
  }

  async outboxState(idempotencyKey: string): Promise<OutboxState | undefined> {
    return this.selectOutbox(await this.database(), idempotencyKey)?.state;
  }

  async verifyEventChain(): Promise<{ valid: boolean; count: number; head: string }> {
    const rows = (await this.database())
      .prepare(`
        SELECT sequence, event_id, previous_hash, event_hash, event_json
        FROM constitutional_event_chain ORDER BY sequence ASC
      `)
      .all() as ChainEventRow[];
    let previousHash = GENESIS_HASH;
    for (const row of rows) {
      if (row.previous_hash !== previousHash) {
        return { valid: false, count: rows.length, head: previousHash };
      }
      const body = JSON.parse(row.event_json) as Record<string, unknown>;
      if (body.eventId !== row.event_id) {
        return { valid: false, count: rows.length, head: previousHash };
      }
      const expected = sha256Hex({ previousHash, event: body });
      if (expected !== row.event_hash) {
        return { valid: false, count: rows.length, head: previousHash };
      }
      previousHash = row.event_hash;
    }
    const chainState = (await this.database())
      .prepare(
        "SELECT event_count, head_hash FROM constitutional_chain_state WHERE singleton = 1",
      )
      .get() as { event_count: number; head_hash: string };
    const stateMatches =
      Number(chainState.event_count) === rows.length && chainState.head_hash === previousHash;
    return {
      valid: stateMatches,
      count: rows.length,
      head: previousHash,
    };
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
          .prepare(
            "SELECT COUNT(*) AS count FROM constitutional_event_chain WHERE idempotency_key = ?",
          )
          .get(idempotencyKey) as { count: number })
      : (database
          .prepare("SELECT COUNT(*) AS count FROM constitutional_event_chain")
          .get() as { count: number });
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
