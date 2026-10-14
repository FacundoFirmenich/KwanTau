import { DatabaseSync, type DatabaseSyncOptions } from "node:sqlite";

const transactionDepthByDatabase = new WeakMap<DatabaseSync, number>();
let nextSavepointId = 0;
let validatedSqliteVersion: string | undefined;

export type SqliteTransactionOptions = {
  busyTimeoutMs?: number;
  databaseLabel?: string;
  logger?: { warn: (message: string, metadata?: Record<string, unknown>) => void };
  operationLabel?: string;
  slowTransactionHoldMs?: number;
};

function parseVersion(value: string): [number, number, number] {
  const parts = value.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`Unable to parse loaded SQLite version: ${value}`);
  }
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function isWalResetSafeVersion(value: string): boolean {
  const [major, minor, patch] = parseVersion(value);
  if (major > 3) return true;
  if (major < 3) return false;
  if (minor > 51) return true;
  if (minor === 51) return patch >= 3;
  if (minor === 50) return patch >= 7;
  if (minor === 44) return patch >= 6;
  return false;
}

function validateLoadedSqlite(): void {
  if (validatedSqliteVersion) return;
  const probe = new DatabaseSync(":memory:");
  try {
    const row = probe.prepare("SELECT sqlite_version() AS version").get() as
      | { version?: unknown }
      | undefined;
    const version = typeof row?.version === "string" ? row.version : "unknown";
    if (!isWalResetSafeVersion(version)) {
      throw new Error(
        `Constitutional SQLite state requires a WAL-reset-safe SQLite runtime; loaded ${version}.`,
      );
    }
    validatedSqliteVersion = version;
  } finally {
    probe.close();
  }
}

export function openNodeSqliteDatabase(
  location: string,
  options?: DatabaseSyncOptions,
): DatabaseSync {
  validateLoadedSqlite();
  return options === undefined
    ? new DatabaseSync(location)
    : new DatabaseSync(location, options);
}

function isPromiseLike(value: unknown): boolean {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    typeof (value as { then?: unknown }).then === "function"
  );
}

function nextSavepointName(): string {
  nextSavepointId += 1;
  return `constitutional_tx_${nextSavepointId}`;
}

function transactionDepth(database: DatabaseSync): number {
  return transactionDepthByDatabase.get(database) ?? 0;
}

function setTransactionDepth(database: DatabaseSync, depth: number): void {
  if (depth <= 0) transactionDepthByDatabase.delete(database);
  else transactionDepthByDatabase.set(database, depth);
}

export function runSqliteImmediateTransactionSync<T>(
  database: DatabaseSync,
  operation: () => T,
  options: SqliteTransactionOptions = {},
): T {
  const depth = transactionDepth(database);
  if (depth > 0) {
    const savepoint = nextSavepointName();
    database.exec(`SAVEPOINT ${savepoint}`);
    setTransactionDepth(database, depth + 1);
    try {
      const result = operation();
      if (isPromiseLike(result)) {
        throw new Error("SQLite constitutional transactions must remain synchronous.");
      }
      database.exec(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (error) {
      try {
        database.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      } finally {
        database.exec(`RELEASE SAVEPOINT ${savepoint}`);
      }
      throw error;
    } finally {
      setTransactionDepth(database, depth);
    }
  }

  const busyTimeoutMs = Math.max(0, Math.trunc(options.busyTimeoutMs ?? 0));
  if (busyTimeoutMs > 0) database.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
  database.exec("BEGIN IMMEDIATE");
  setTransactionDepth(database, 1);
  const startedAt = Date.now();
  try {
    const result = operation();
    if (isPromiseLike(result)) {
      throw new Error("SQLite constitutional transactions must remain synchronous.");
    }
    database.exec("COMMIT");
    const elapsedMs = Date.now() - startedAt;
    const threshold = options.slowTransactionHoldMs ?? 1_000;
    if (elapsedMs >= threshold) {
      options.logger?.warn("slow constitutional SQLite transaction", {
        database: options.databaseLabel,
        operation: options.operationLabel,
        elapsedMs,
        thresholdMs: threshold,
        pid: process.pid,
      });
    }
    return result;
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      try {
        database.close();
      } catch {
        // Preserve the original transaction failure.
      }
    }
    throw error;
  } finally {
    setTransactionDepth(database, 0);
  }
}
