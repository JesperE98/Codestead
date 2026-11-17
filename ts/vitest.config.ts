import { defineConfig } from "vitest/config";

// One test run for every package and app of the workspace.
export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.{ts,tsx}", "apps/*/test/**/*.test.{ts,tsx}"],
  },
});
