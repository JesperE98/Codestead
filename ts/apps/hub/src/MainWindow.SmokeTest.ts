import { flushSync } from "react-dom";
import { HubStrings } from "./HubStrings.js";
import type { MainWindow } from "./MainWindow.js";

// MainWindow.SmokeTest.cs: the --smoke-test of the installation tests (also the end-to-end test with a tool), and
// Codestead.UI's SmokeTest (the main process prints "SMOKE OK name version (details)" or "SMOKE FAILED: …" and exits).

export async function runSmokeTest(w: MainWindow): Promise<void> {
  try {
    const details = await checks(w);
    w.api.smokeTestDone(true, details);
  } catch (e) {
    w.api.smokeTestDone(false, e instanceof Error ? (e.stack ?? e.message) : String(e));
  }
}

async function checks(w: MainWindow): Promise<string> {
  // Every language is drawn once (flushSync: now, not later).
  for (const l of HubStrings.languages) {
    w.state.lang = l.code;
    flushSync(() => w.render());
  }
  w.state.lang = "en";
  flushSync(() => w.render());
  let detail = "";
  if (w.info.catalog !== null) {
    await w.refresh();
    const catalog = w.catalog;
    if (catalog === null) throw new Error(w.catalogProblem ?? "no catalog");
    const id = w.info.install;
    if (id !== null) {
      const tool = catalog.find(id);
      if (tool === null) throw new Error(`${id} is not in the catalog.`);
      const asset = tool.assetFor(w.info.rid ?? "");
      if (asset === null) throw new Error(`${id} has no package for ${w.info.rid}.`);
      const installed = await w.install(tool, asset);
      if (installed === null) throw new Error(w.errors.get(id) ?? "install failed");
      const run = await w.api.smokeLaunch(id);
      if ("error" in run) throw new Error(run.error);
      if (run.value.exitCode !== 0 || !run.value.output.includes("SMOKE OK")) throw new Error(`${id} --smoke-test failed (exit ${run.value.exitCode}).`);
      const removed = await w.api.uninstall(id);
      if ("error" in removed) throw new Error(removed.error);
      if ((await w.api.installedTools()).some((t) => t.id === id)) throw new Error(`${id} is still installed after uninstalling.`);
      detail = `, installed, started and removed ${id} ${installed.version}`;
    }
  }
  return `${HubStrings.languages.length} languages${detail}`;
}
