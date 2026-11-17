import { defineConfig } from "vitest/config";

// One test run for every package and app of the workspace.
export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
  },
});
