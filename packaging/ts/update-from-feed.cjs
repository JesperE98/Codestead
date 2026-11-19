// The update button of an installed TypeScript Codestead app, without its window (packaging/upgrade-test.sh and
// upgrade-test-windows.ps1, TS -> TS): the calls of @codestead/ui's VelopackSelfUpdate (ts/packages/ui/src/electron/
// VelopackUpdate.ts) on the installed app's own copy of Velopack's Node SDK, with a local feed instead of the release.
// Run by the installed app's Electron as Node, so that Velopack sees the installed app as the running process:
//   ELECTRON_RUN_AS_NODE=1 <install>/<exe>(.bin|.exe) update-from-feed.cjs --feed <url> [--expect <version>] [--silent]
//     [-- <arguments for the restarted app>]
//   (Linux: also APPIMAGE=<the AppImage>, as the AppImage's runtime sets it.)
//   --silent: the updater shows no progress window or dialog; without it the call is VelopackSelfUpdate's.
"use strict";
const path = require("node:path");

async function main() {
  const args = process.argv.slice(2);
  let feed = null, expect = null, silent = false, restartArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--feed") feed = args[++i];
    else if (args[i] === "--expect") expect = args[++i];
    else if (args[i] === "--silent") silent = true;
    else if (args[i] === "--") { restartArgs = args.slice(i + 1); break; }
    else throw new Error(`Unknown argument: ${args[i]}`);
  }
  if (feed === null) throw new Error("--feed <url> is missing");

  // The installed app's velopack (resources/app/node_modules, packaging/ts/package-app.mjs), next to its Electron.
  const vp = require(path.join(path.dirname(process.execPath), "resources", "app", "node_modules", "velopack"));
  // runVelopackHooks(): first in the app's main process.
  vp.VelopackApp.build().run();
  // new VelopackSelfUpdate(...): an HttpSource on the feed.
  const manager = new vp.UpdateManager(new vp.HttpSource(feed));
  // check()
  const pending = await manager.checkForUpdatesAsync();
  if (pending === null) throw new Error(`No update found in ${feed}.`);
  const target = pending.TargetFullRelease;
  console.log(`Update: ${target.PackageId} ${target.Version} (${target.FileName})`);
  if (expect !== null && target.Version !== expect) throw new Error(`Expected the update ${expect}, found ${target.Version}.`);
  // downloadAndRestart()
  let shown = -1;
  await manager.downloadUpdateAsync(pending, (percent) => {
    if (Math.floor(percent / 25) === shown) return;
    shown = Math.floor(percent / 25);
    console.log(`Downloading: ${percent}%`);
  });
  console.log(`Applying and restarting (${restartArgs.length === 0 ? "no arguments" : restartArgs.join(" ")})`);
  // The updater, and the app it restarts, inherit the environment: the restarted app must be Electron again.
  delete process.env.ELECTRON_RUN_AS_NODE;
  manager.waitExitThenApplyUpdate(target, silent, true, restartArgs);
  process.exit(0);
}

main().catch((e) => {
  console.error(`UPDATE FAILED: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
