import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const extensionRoot = resolve(import.meta.dirname, "..");
const root = resolve(extensionRoot, "../..");
const pluginEntryPath = resolve(root, "src/plugin-sdk/plugin-entry.ts");
const pluginApiPath = resolve(root, "src/plugins/plugin-api.types.ts");
const runtimeTypesPath = resolve(root, "src/plugins/runtime/types.ts");
const packageSdkPath = resolve(root, "packages/plugin-sdk/package.json");
const extensionEntryPath = resolve(extensionRoot, "index.ts");

const [pluginEntry, pluginApi, runtimeTypes, packageSdkRaw, extensionEntry] = await Promise.all([
  readFile(pluginEntryPath, "utf8"),
  readFile(pluginApiPath, "utf8"),
  readFile(runtimeTypesPath, "utf8"),
  readFile(packageSdkPath, "utf8"),
  readFile(extensionEntryPath, "utf8"),
]);
const packageSdk = JSON.parse(packageSdkRaw);

const projections = [
  {
    name: "plugin-entry",
    source: pluginEntry,
    required: [
      "type DefinePluginEntryOptions = {",
      'register: NonNullable<OpenClawPluginDefinition["register"]>; ',
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
];

const consumedProjection = [];
for (const projection of projections) {
  for (const fragment of projection.required) {
    if (!projection.source.includes(fragment)) {
      throw new Error(`${projection.name} contract drift: missing ${JSON.stringify(fragment)}`);
    }
    consumedProjection.push(`${projection.name}:${fragment}`);
  }
}

const packageExport = packageSdk.exports?.["./plugin-entry"];
if (packageSdk.name !== "@openclaw/plugin-sdk") {
  throw new Error("Unexpected package SDK identity.");
}
if (packageExport?.types !== "./dist/src/plugin-sdk/plugin-entry.d.ts") {
  throw new Error("Plugin SDK must expose generated plugin-entry declarations.");
}
if (packageExport?.default !== "./src/plugin-entry.ts") {
  throw new Error("Plugin SDK must expose the canonical plugin-entry runtime.");
}
if (!extensionEntry.includes('from "@openclaw/plugin-sdk/plugin-entry"')) {
  throw new Error("Extension must import the package-owned generated Plugin SDK ABI.");
}
if (extensionEntry.includes('from "openclaw/plugin-sdk/plugin-entry"')) {
  throw new Error("Extension must not bypass the package boundary through the root package.");
}

consumedProjection.push(`package-sdk:name=${packageSdk.name}`);
consumedProjection.push(`package-sdk:types=${packageExport.types}`);
consumedProjection.push(`package-sdk:default=${packageExport.default}`);

const sourceContractSha256 = createHash("sha256")
  .update(consumedProjection.sort().join("\n"))
  .digest("hex");

console.log(
  JSON.stringify({
    status: "PASS",
    pluginEntryPath,
    pluginApiPath,
    runtimeTypesPath,
    packageSdkPath,
    sourceContractSha256,
    consumedFragments: consumedProjection.length,
  }),
);
