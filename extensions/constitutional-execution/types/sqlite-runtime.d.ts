export type StatementResultingChanges = {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
};

export type StatementSync = {
  run: (...parameters: unknown[]) => StatementResultingChanges;
  get: (...parameters: unknown[]) => unknown;
  all: (...parameters: unknown[]) => unknown[];
};

export type DatabaseSync = {
  exec: (sql: string) => void;
  prepare: (sql: string) => StatementSync;
  close: () => void;
};

export type SqliteTransactionOptions = {
  busyTimeoutMs?: number;
  databaseLabel?: string;
  logger?: { warn: (message: string, metadata?: Record<string, unknown>) => void };
  operationLabel?: string;
  slowTransactionHoldMs?: number;
};

export declare function openNodeSqliteDatabase(
  location: string,
  options?: unknown,
): DatabaseSync;

export declare function runSqliteImmediateTransactionSync<T>(
  database: DatabaseSync,
  operation: () => T,
  options?: SqliteTransactionOptions,
): T;
