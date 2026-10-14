import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const extensionRoot = resolve(import.meta.dirname, "..");
const root = resolve(extensionRoot, "../..");
const pluginEntryPath = resolve(root, "src/plugin-sdk/plugin-entry.ts");
const pluginApiPath = resolve(root, "src/plugins/plugin-api.types.ts");
const runtimeTypesPath = resolve(root, "src/plugins/runtime/types.ts");
const sqliteRuntimePath = resolve(root, "src/plugin-sdk/sqlite-runtime.ts");
const sqliteOpenPath = resolve(root, "src/infra/node-sqlite.ts");
const sqliteTransactionPath = resolve(root, "src/infra/sqlite-transaction.ts");
const abiPath = resolve(extensionRoot, "types/plugin-entry.d.ts");
const sqliteAbiPath = resolve(extensionRoot, "types/sqlite-runtime.d.ts");
const extensionEntryPath = resolve(extensionRoot, "index.ts");

const [
  pluginEntry,
  pluginApi,
  runtimeTypes,
  sqliteRuntime,
  sqliteOpen,
  sqliteTransaction,
  abi,
  sqliteAbi,
  extensionEntry,
] = await Promise.all([
  readFile(pluginEntryPath, "utf8"),
  readFile(pluginApiPath, "utf8"),
  readFile(runtimeTypesPath, "utf8"),
  readFile(sqliteRuntimePath, "utf8"),
  readFile(sqliteOpenPath, "utf8"),
  readFile(sqliteTransactionPath, "utf8"),
  readFile(abiPath, "utf8"),
  readFile(sqliteAbiPath, "utf8"),
  readFile(extensionEntryPath, "utf8"),
]);

const projections = [
  {
    name: "plugin-entry",
    source: pluginEntry,
    required: [
      "type DefinePluginEntryOptions = {",
      "register: NonNullable<OpenClawPluginDefinition[\"register\"]>;",
      "export function definePluginEntry({",
      "}: DefinePluginEntryOptions): DefinedPluginEntry",
    ],
  },
  {
    name: "plugin-api",
    source: pluginApi,
    required: [
      "pluginConfig?: Record<string, unknown>;",
      "runtime: PluginRuntime;",
      "logger: PluginLogger;",
      "registerGatewayMethod: (",
      "handler: GatewayRequestHandler",
      "opts?: { scope?: OperatorScope }",
      "registerService: (service: OpenClawPluginService) => void;",
    ],
  },
  {
    name: "plugin-runtime",
    source: runtimeTypes,
    required: [
      "export type RuntimeGatewayRequestOptions = {",
      "gateway: {",
      "request: <T = unknown>(",
      "params?: Record<string, unknown>",
      "options?: RuntimeGatewayRequestOptions",
      ") => Promise<T>",
    ],
  },
  {
    name: "sqlite-export",
    source: sqliteRuntime,
    required: [
      "export { openNodeSqliteDatabase }",
      "export { runSqliteImmediateTransactionSync }",
    ],
  },
  {
    name: "sqlite-open",
    source: sqliteOpen,
    required: [
      "export function openNodeSqliteDatabase(",
      "): import(\"node:sqlite\").DatabaseSync",
    ],
  },
  {
    name: "sqlite-transaction",
    source: sqliteTransaction,
    required: [
      "export type SqliteTransactionOptions = {",
      "export function runSqliteImmediateTransactionSync<T>(",
      "operation: () => T,",
      "options?: SqliteTransactionOptions,",
      "): T",
    ],
  },
  {
    name: "local-plugin-abi",
    source: abi,
    required: [
      "export type OpenClawPluginApi = {",
      "registerGatewayMethod: (",
      "registerService: (service: OpenClawPluginService) => void;",
      "export declare function definePluginEntry(",
    ],
  },
  {
    name: "local-sqlite-abi",
    source: sqliteAbi,
    required: [
      "export type DatabaseSync = {",
      "export declare function openNodeSqliteDatabase(",
      "export declare function runSqliteImmediateTransactionSync<T>(",
    ],
  },
];

const consumedProjection = [];
for (const projection of projections) {
  for (const fragment of projection.required) {
    if (!projection.source.includes(fragment)) {
      throw new Error(
        `${projection.name} contract drift: missing ${JSON.stringify(fragment)}`,
      );
    }
    consumedProjection.push(`${projection.name}:${fragment}`);
  }
}

for (const [name, source] of [
  ["plugin-entry", abi],
  ["sqlite-runtime", sqliteAbi],
]) {
  if (/\bdeclare\s+module\b/.test(source)) {
    throw new Error(`${name} ABI must be imported, never ambient.`);
  }
}
if (!extensionEntry.includes('from "openclaw/plugin-sdk/plugin-entry"')) {
  throw new Error("Extension runtime must import the canonical plugin-entry ABI.");
}

const abiSha256 = createHash("sha256")
  .update(abi)
  .update("\0")
  .update(sqliteAbi)
  .digest("hex");
const sourceContractSha256 = createHash("sha256")
  .update(consumedProjection.sort().join("\n"))
  .digest("hex");

console.log(
  JSON.stringify({
    status: "PASS",
    abiSha256,
    sourceContractSha256,
    consumedFragments: consumedProjection.length,
  }),
);
