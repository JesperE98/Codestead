import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The end-to-end tests: the built app (npm run build) in Electron, driven by Playwright. Not part of `vitest run`.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: {
    include: ["e2e/**/*.test.ts"],
    testTimeout: 180_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
