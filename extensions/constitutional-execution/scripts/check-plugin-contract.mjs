import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const pluginApiPath = resolve(root, "src/plugins/plugin-api.types.ts");
const runtimeTypesPath = resolve(root, "src/plugins/runtime/types.ts");
const pluginApi = await readFile(pluginApiPath, "utf8");
const runtimeTypes = await readFile(runtimeTypesPath, "utf8");

const requiredPluginFragments = [
  "registerGatewayMethod: (",
  "handler: GatewayRequestHandler",
  "opts?: { scope?: OperatorScope }",
];
const requiredRuntimeFragments = [
  "gateway: {",
  "request: <T = unknown>(",
  "params?: Record<string, unknown>",
  "options?: RuntimeGatewayRequestOptions",
  ") => Promise<T>",
];

for (const fragment of requiredPluginFragments) {
  if (!pluginApi.includes(fragment)) {
    throw new Error(`Plugin API contract drift: missing ${JSON.stringify(fragment)}`);
  }
}
for (const fragment of requiredRuntimeFragments) {
  if (!runtimeTypes.includes(fragment)) {
    throw new Error(`Plugin runtime contract drift: missing ${JSON.stringify(fragment)}`);
  }
}

const digest = createHash("sha256")
  .update(pluginApi)
  .update("\0")
  .update(runtimeTypes)
  .digest("hex");
console.log(JSON.stringify({
  status: "PASS",
  pluginApiPath,
  runtimeTypesPath,
  sourceContractSha256: digest,
}));
