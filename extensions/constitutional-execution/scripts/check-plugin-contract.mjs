import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const extensionRoot = resolve(import.meta.dirname, "..");
const root = resolve(extensionRoot, "../..");
const pluginEntryPath = resolve(root, "src/plugin-sdk/plugin-entry.ts");
const pluginApiPath = resolve(root, "src/plugins/plugin-api.types.ts");
const runtimeTypesPath = resolve(root, "src/plugins/runtime/types.ts");
const abiPath = resolve(extensionRoot, "types/plugin-entry.d.ts");
const extensionEntryPath = resolve(extensionRoot, "index.ts");

const [pluginEntry, pluginApi, runtimeTypes, abi, extensionEntry] = await Promise.all([
  readFile(pluginEntryPath, "utf8"),
  readFile(pluginApiPath, "utf8"),
  readFile(runtimeTypesPath, "utf8"),
  readFile(abiPath, "utf8"),
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
    name: "local-abi",
    source: abi,
    required: [
      "export type OpenClawPluginApi = {",
      "pluginConfig?: Record<string, unknown>;",
      "registerGatewayMethod: (",
      "registerService: (service: OpenClawPluginService) => void;",
      "export declare function definePluginEntry(",
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

if (/\bdeclare\s+module\b/.test(abi)) {
  throw new Error("Local ABI must be an imported module, never an ambient module declaration.");
}
if (!extensionEntry.includes('from "openclaw/plugin-sdk/plugin-entry"')) {
  throw new Error("Extension runtime must import the canonical openclaw/plugin-sdk ABI.");
}

const abiSha256 = createHash("sha256").update(abi).digest("hex");
const sourceContractSha256 = createHash("sha256")
  .update(consumedProjection.sort().join("\n"))
  .digest("hex");

console.log(
  JSON.stringify({
    status: "PASS",
    pluginEntryPath,
    pluginApiPath,
    runtimeTypesPath,
    abiPath,
    abiSha256,
    sourceContractSha256,
    consumedFragments: consumedProjection.length,
  }),
);
