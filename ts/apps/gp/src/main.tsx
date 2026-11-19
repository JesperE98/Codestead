// The renderer's entry (index.html): starts the app, and with --smoke-test runs its checks and reports to the main
// process.

import { startApp } from "./App.js";
import { hostApi } from "./Host.js";
import { runSmokeTest } from "./SmokeTest.js";

const api = hostApi();
const app = startApp(document.getElementById("root")!, api);
if (api.info.smokeTest) {
  // As the C# window: the checks start once the window is on screen.
  setTimeout(() => {
    runSmokeTest(app).then(
      (details) => api.smokeResult(true, details),
      (e: unknown) => api.smokeResult(false, e instanceof Error ? (e.stack ?? e.message) : String(e)),
    );
  }, 0);
}
