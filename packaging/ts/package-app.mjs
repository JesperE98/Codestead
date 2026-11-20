#!/usr/bin/env node
// Makes the unpacked app folder of one TypeScript/Electron app (ts/apps/<name>): the folder packaging/build-linux.sh and
// build-windows.ps1 turn into the portable archive, the native packages, the AppImage and the Windows installer (both
// run this script first).
//
// Usage: node packaging/ts/package-app.mjs --app ts/apps/linux --id codestead-linux --name "Codestead Linux"
//          --exe Codestead.Linux --version 0.6.0 --platform linux|win32 --out <folder> [--no-build]
//
// 1. Builds the app (`npm run build` in its folder) with the release's version (VITE_CODESTEAD_VERSION; without it the
//    app is major.minor.0 from packaging/products.json), unless --no-build.
// 2. Stages Electron's app folder (resources/app) with the repository's layout, so that the app finds everything
//    by the same relative paths as in the repository:
//      package.json                     main: ts/apps/<name>/dist-electron/main.cjs
//      ts/apps/<name>/dist, dist-electron
//      node_modules/velopack, @neon-rs/load   (updates; only this platform's native module)
//      <files the app reads from the repository at run time>   (dist-electron/ and dist/repo-files.json, written by
//                                        the app's builds: Codestead GP's course worker reads the course's binary files
//                                        by path, and its page loads the same files instead of copies in dist/assets)
// 3. Lets electron-builder make the unpacked app (`--dir`: Electron renamed to the executable, the Windows icon and
//    version information, only the Chromium locales of the apps' languages), then puts the staged folder in it as it is
//    (resources/app, no asar: the GP course worker – a Node worker thread – and the native update module are plain
//    files; electron-builder's own copy would leave out files by its default patterns).
// 4. Linux: the executable (<exe>, as the C# app's) is a small launcher script next to Electron (<exe>.bin), because
//    Chromium's sandbox needs user namespaces or a setuid helper, and where neither is there (as root, in containers,
//    Ubuntu 24.04's AppArmor rule, a FUSE-mounted AppImage) Electron must be started with --no-sandbox
//    (packaging/ts/launcher.sh).
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { makeGlibcNeedOptionalInFile } from "./velopack-glibc.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const tsRoot = join(root, "ts");
const requireTs = createRequire(join(tsRoot, "package.json"));

function parseArgs(argv) {
  const opts = { build: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-build") opts.build = false;
    else if (a.startsWith("--") && i + 1 < argv.length) opts[a.slice(2)] = argv[++i];
    else throw new Error(`Unknown argument: ${a}`);
  }
  for (const k of ["app", "id", "name", "exe", "version", "platform", "out"]) if (!opts[k]) throw new Error(`Missing --${k}`);
  if (opts.platform !== "linux" && opts.platform !== "win32") throw new Error("--platform must be linux or win32");
  return opts;
}

function run(cmd, args, options) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...options });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (${r.status ?? r.signal})`);
}

/**
 * Chromium's locale files for the languages the apps offer (build/languages.json: a parked language is not in their
 * menus, and comes back here with its "offered"); the rest is left out (≈ 40 MB). Chromium falls back to en-US.
 */
function chromiumLocales() {
  const names = { en: ["en-US", "en-GB"], zh: ["zh-CN", "zh-TW"], pt: ["pt-BR", "pt-PT"], es: ["es", "es-419"] };
  const { languages } = JSON.parse(readFileSync(join(root, "build", "languages.json"), "utf8"));
  return [...new Set(["en-US", ...languages.filter((l) => l.offered).flatMap((l) => names[l.code] ?? [l.code])])];
}

/** The native module of velopack for the target platform (lib/load.js picks it at run time). */
const velopackNative = { linux: "velopack_nodeffi_linux_x64_gnu.node", win32: "velopack_nodeffi_win_x64_msvc.node" };

/** The update library and its one dependency into the app's node_modules, with only this platform's native module. */
function addNodeModules(opts, appFolder) {
  for (const mod of ["velopack", "@neon-rs/load"]) {
    const from = dirname(requireTs.resolve(`${mod}/package.json`));
    cpSync(from, join(appFolder, "node_modules", mod), {
      recursive: true,
      filter: (src) => !src.endsWith(".node") || src.endsWith(velopackNative[opts.platform]),
    });
  }
  if (opts.platform === "linux") {
    // Loads on glibc older than the one it was built against (packaging/ts/velopack-glibc.mjs); fails the build when
    // a new velopack is not as expected.
    const native = join(appFolder, "node_modules", "velopack", "lib", "native", velopackNative.linux);
    const { version, symbols } = makeGlibcNeedOptionalInFile(native);
    console.log(`${velopackNative.linux}: ${version} optional (only the weak ${symbols.join(", ")} need it)`);
  }
}

function stage(opts, appDir, stageDir) {
  const rel = relative(root, appDir).replaceAll("\\", "/");
  rmSync(stageDir, { recursive: true, force: true });
  mkdirSync(stageDir, { recursive: true });
  for (const part of ["dist", "dist-electron"]) {
    if (!existsSync(join(appDir, part))) throw new Error(`${rel}/${part} is missing: build the app first.`);
    cpSync(join(appDir, part), join(stageDir, rel, part), { recursive: true });
  }
  // Files the app reads from the repository at run time, listed by its builds (each file once, for both).
  const files = new Set();
  for (const part of ["dist-electron", "dist"]) {
    const listFile = join(appDir, part, "repo-files.json");
    if (!existsSync(listFile)) continue;
    for (const f of JSON.parse(readFileSync(listFile, "utf8"))) files.add(f);
    rmSync(join(stageDir, rel, part, "repo-files.json"));
  }
  for (const f of files) {
    if (f.startsWith("/") || f.includes("..")) throw new Error(`repo-files.json: not a repository path: ${f}`);
    mkdirSync(dirname(join(stageDir, f)), { recursive: true });
    copyFileSync(join(root, f), join(stageDir, f));
  }
  if (files.size > 0) console.log(`${files.size} files of the repository (repo-files.json)`);
  writeFileSync(
    join(stageDir, "package.json"),
    JSON.stringify(
      {
        name: opts.id,
        productName: opts.name,
        version: opts.version,
        description: opts.name,
        author: "JesperE98",
        license: "UNLICENSED",
        private: true,
        main: `${rel}/dist-electron/main.cjs`,
        // Electron's window class (X11 WM_CLASS, Wayland app id) comes from desktopName: the C# app's was its
        // executable's name, which the desktop entry's StartupWMClass names (packaging/linux/app.desktop).
        desktopName: `${opts.exe}.desktop`,
      },
      null,
      2,
    ) + "\n",
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const appDir = resolve(root, opts.app);
  const out = resolve(opts.out);
  const work = join(root, "obj", "ts-packaging", `${opts.id}-${opts.platform}`);

  if (opts.build) {
    const env = { ...process.env, VITE_CODESTEAD_VERSION: opts.version, VITE_CODESTEAD_HUB_VERSION: opts.version };
    run("npm", ["run", "build"], { cwd: appDir, env });
  }

  const stageDir = join(work, "app");
  stage(opts, appDir, stageDir);

  const { Arch, build, Platform } = requireTs("electron-builder");
  const electronVersion = requireTs("electron/package.json").version;
  const platform = opts.platform === "linux" ? Platform.LINUX : Platform.WINDOWS;
  const outDir = join(work, "out");
  rmSync(outDir, { recursive: true, force: true });
  await build({
    targets: platform.createTarget("dir", Arch.x64),
    projectDir: stageDir,
    config: {
      appId: `io.github.jespere98.${opts.id}`,
      productName: opts.name,
      executableName: opts.exe,
      copyright: "Copyright © 2026 JesperE98. All rights reserved.",
      electronVersion,
      directories: { output: outDir },
      files: ["**/*"],
      asar: false,
      // Updates come from Velopack (packaging/build-*.sh/.ps1), not electron-updater: no app-update.yml.
      publish: null,
      npmRebuild: false,
      nodeGypRebuild: false,
      electronLanguages: chromiumLocales(),
      linux: { target: "dir", executableName: opts.exe, icon: join(root, "build", "icons", `${opts.id}.png`) },
      // The icon and version information go into the .exe with rcedit, which needs Windows (a cross-build on Linux,
      // only for looking at the folder, keeps Electron's).
      win: { target: "dir", icon: join(root, "build", "icons", `${opts.id}.ico`), signAndEditExecutable: process.platform === "win32" },
    },
  });

  const unpacked = join(outDir, opts.platform === "linux" ? "linux-unpacked" : "win-unpacked");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(dirname(out), { recursive: true });
  try {
    renameSync(unpacked, out);
  } catch {
    cpSync(unpacked, out, { recursive: true, verbatimSymlinks: true });
  }
  // The app folder as staged: electron-builder's copy leaves out files by its own default patterns (e.g. *.obj, which
  // Codestead GP's projects have).
  const appFolder = join(out, "resources", "app");
  rmSync(appFolder, { recursive: true, force: true });
  cpSync(stageDir, appFolder, { recursive: true });
  addNodeModules(opts, appFolder);

  if (opts.platform === "linux") {
    renameSync(join(out, opts.exe), join(out, `${opts.exe}.bin`));
    const launcher = readFileSync(join(root, "packaging", "ts", "launcher.sh"), "utf8")
      .replaceAll("${PKG_DISPLAY_NAME}", opts.name)
      .replaceAll("${PKG_EXECUTABLE}", opts.exe);
    writeFileSync(join(out, opts.exe), launcher);
    chmodSync(join(out, opts.exe), 0o755);
  }
  rmSync(work, { recursive: true, force: true });
  console.log(`${opts.name} ${opts.version} (${opts.platform}): ${out}`);
  for (const f of readdirSync(out)) console.log(`  ${f}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
