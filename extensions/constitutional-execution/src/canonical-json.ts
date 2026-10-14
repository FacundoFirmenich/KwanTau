import { createHash } from "node:crypto";

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Canonical JSON rejects non-finite numbers.");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }
  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const output = Object.create(null) as Record<string, unknown>;
    for (const key of Object.keys(input).sort()) {
      const item = input[key];
      if (item === undefined) {
        continue;
      }
      Object.defineProperty(output, key, {
        value: canonicalize(item),
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    return output;
  }
  throw new TypeError(`Canonical JSON rejects value of type ${typeof value}.`);
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Hex(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}
