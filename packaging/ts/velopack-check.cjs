// Checks that an installed TypeScript Codestead app's Velopack really loads (packaging/install-test.sh). The app starts
// without it – only without self-update (ts/packages/ui/src/electron/VelopackUpdate.ts) –, so its smoke test would not
// notice a native module that no longer loads: on Ubuntu 22.04 (glibc 2.35) it loads only because
// packaging/ts/velopack-glibc.mjs made its GLIBC_2.39 need optional.
// Run by the installed app's Electron as Node, as packaging/ts/update-from-feed.cjs:
//   ELECTRON_RUN_AS_NODE=1 <install>/<exe>.bin velopack-check.cjs [--installed <package id> <version>]
//   --installed: installed by Velopack (the AppImage; with APPIMAGE=<the AppImage>, as its runtime sets it): Velopack's
//   UpdateManager must find the installation – the app's self-update is available.
// Prints "VELOPACK OK …" and exits with 0, or "VELOPACK FAILED: …" and 1.
"use strict";
const path = require("node:path");

function main() {
  const args = process.argv.slice(2);
  let installed = null;
  if (args[0] === "--installed" && args.length === 3) installed = { id: args[1], version: args[2] };
  else if (args.length !== 0) throw new Error(`Unknown arguments: ${args.join(" ")}`);

  const velopack = path.join(path.dirname(process.execPath), "resources", "app", "node_modules", "velopack");
  // The native module itself: velopack's index.js loads it only when first used (@neon-rs/load), and the app catches
  // that failure.
  const nativeFile = { linux: "velopack_nodeffi_linux_x64_gnu.node", win32: "velopack_nodeffi_win_x64_msvc.node" }[process.platform];
  if (nativeFile === undefined) throw new Error(`No native module for ${process.platform}`);
  const native = require(path.join(velopack, "lib", "native", nativeFile));
  const functions = Object.keys(native).filter((k) => typeof native[k] === "function").length;
  if (functions === 0) throw new Error(`${nativeFile} has no functions`);
  let text = `native module loaded (${functions} functions)`;

  if (installed !== null) {
    const vp = require(velopack);
    // As VelopackSelfUpdate: an UpdateManager on an HTTP feed (nothing is fetched here).
    const manager = new vp.UpdateManager(new vp.HttpSource("http://127.0.0.1:9/"));
    const id = manager.getAppId();
    const version = manager.getCurrentVersion();
    if (id !== installed.id || version !== installed.version)
      throw new Error(`Velopack sees ${id} ${version}, expected ${installed.id} ${installed.version}`);
    text += `, self-update available (${id} ${version})`;
  }
  console.log(`VELOPACK OK: ${text}`);
}

try {
  main();
} catch (e) {
  console.error(`VELOPACK FAILED: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
