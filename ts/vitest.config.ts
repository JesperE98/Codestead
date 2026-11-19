import { configDefaults, defineConfig } from "vitest/config";

// Codestead GP's TaskTests (every task and exercise of every chapter in every API through the simulated GPU) take about
// an hour on one core: they run only when CODESTEAD_GP_PARTS or CODESTEAD_GP_CHAPTERS chooses what to test (CI runs
// them in parallel jobs by course part, see the gp-tasks jobs in .github/workflows/ci.yml and release.yml).
const gpTasks = Boolean(process.env.CODESTEAD_GP_PARTS || process.env.CODESTEAD_GP_CHAPTERS);

// One test run for every package and app of the workspace.
export default defineConfig({
  test: {
    include: [
      "packages/*/test/**/*.test.{ts,tsx}",
      "apps/*/test/**/*.test.{ts,tsx}",
      // The Render Pipeline Visualizer's own tests of the code @codestead/pipeline-viz copies from it.
      "packages/pipeline-viz/visualizer/tests/**/*.test.ts",
    ],
    exclude: gpTasks ? configDefaults.exclude : [...configDefaults.exclude, "packages/gp-course/test/TaskTests.test.ts"],
    // The simulated GPU's chapter pictures (compute shaders, tessellation) take 1-3 s each on a free core and over 5 s
    // (Vitest's default) on a two-core CI runner running every test file at once.
    testTimeout: 30_000,
  },
});
