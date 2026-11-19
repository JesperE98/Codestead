import { builtinEnvironments } from "vitest/runtime";

/**
 * A jsdom document in a test that runs in the node environment. The hub's window reads files of the repository outside
 * ts/ (its texts, icons and changelog), which Vite's "client" environment (`@vitest-environment jsdom`) refuses to serve,
 * since server.fs.allow is the workspace; the node environment reads them. Import @testing-library/react only after
 * this (dynamically): it looks for the document when it is loaded.
 */
export async function setUpDocument(): Promise<() => void> {
  const env = await builtinEnvironments.jsdom.setup(globalThis, { jsdom: {} } as never);
  return () => void env.teardown(globalThis);
}
