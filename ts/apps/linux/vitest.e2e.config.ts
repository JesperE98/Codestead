import { defineConfig } from "vitest/config";

// The end-to-end tests: build the app and drive the real Electron window with Playwright (npm run test:e2e).
// They are not part of the workspace's default `vitest run`.
export default defineConfig({
  test: {
    root: ".",
    include: ["e2e/**/*.test.ts"],
    testTimeout: 180_000,
    hookTimeout: 300_000,
    fileParallelism: false,
  },
});
