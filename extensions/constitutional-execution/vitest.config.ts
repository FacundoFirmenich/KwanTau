import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.mjs"],
    exclude: ["node_modules/**", "dist/**"],
    passWithNoTests: false,
  },
});
