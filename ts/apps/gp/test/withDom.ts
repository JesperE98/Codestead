// Vitest's jsdom environment, set up from inside a test in the node environment. Import it first:
//   import "./withDom.js";
// The course packages read their texts from src/ in the repository (import.meta.glob ?raw), outside the workspace
// root ts/. A test in the jsdom environment gets its modules transformed as for a browser page, which may not read
// outside that root (the app's own Vite config allows it, the workspace's ts/vitest.config.ts does not); the node
// environment transforms them as on a server, where it may. So such a test runs in node and gets its DOM here.

import { afterAll } from "vitest";
import { builtinEnvironments } from "vitest/runtime";

const env = await builtinEnvironments.jsdom.setup(globalThis, {});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterAll(() => env.teardown(globalThis));
