import { configDefaults, defineConfig } from "vitest/config";

// Codestead GP's TaskTests (every task and exercise of every chapter in every API through the simulated GPU) take about
// an hour on one core: they run only when CODESTEAD_GP_PARTS or CODESTEAD_GP_CHAPTERS chooses what to test (CI runs
// them in parallel jobs by course part, see the gp-tasks jobs in .github/workflows/ci.yml and release.yml).
const gpTasks = Boolean(process.env.CODESTEAD_GP_PARTS || process.env.CODESTEAD_GP_CHAPTERS);

// One test run for every package and app of the workspace.
export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.{ts,tsx}", "apps/*/test/**/*.test.{ts,tsx}"],
    exclude: gpTasks ? configDefaults.exclude : [...configDefaults.exclude, "packages/gp-course/test/TaskTests.test.ts"],
  },
});
