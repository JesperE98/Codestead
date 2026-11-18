#!/usr/bin/env node
// Makes the unpacked app folder of one TypeScript/Electron app (ts/apps/<name>) – what `dotnet publish` makes for the
// C# app: the folder packaging/build-linux.sh and build-windows.ps1 turn into the portable archive, the native packages,
// the AppImage and the Windows installer (`--ts <app>` there runs this script).
//
// Usage: node packaging/ts/package-app.mjs --app ts/apps/linux --id codestead-linux --name "Codestead Linux"
//          --exe Codestead.Linux --version 0.6.0 --platform linux|win32 --out <folder> [--no-build]
//
// 1. Builds the app (`npm run build` in its folder) with the release's version (VITE_CODESTEAD_VERSION, as C#'s
//    -p:Version), unless --no-build.
// 2. Stages Electron's app folder (resources/app) with the repository's layout, so that the app finds everything
//    by the same relative paths as in the repository:
//      package.json                     main: ts/apps/<name>/dist-electron/main.cjs
//      ts/apps/<name>/dist, dist-electron
//      node_modules/velopack, @neon-rs/load   (updates; only this platform's native module)
//      <files the app reads from the repository at run time>   (dist-electron/repo-files.json, written by the app's
//                                        build: Codestead GP's course worker reads the course's binary files by path)
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

/** Chromium's locale files for the apps' languages (build/languages.json); the rest is left out (≈ 40 MB). */
function chromiumLocales() {
  const names = { en: ["en-US", "en-GB"], zh: ["zh-CN", "zh-TW"], pt: ["pt-BR", "pt-PT"], es: ["es", "es-419"] };
  const { languages } = JSON.parse(readFileSync(join(root, "build", "languages.json"), "utf8"));
  return [...new Set(["en-US", ...languages.flatMap((l) => names[l.code] ?? [l.code])])];
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
    const native = join(appFolder, "node_modules", "velopack", "lib", "native", velopackNative.linux);
    const weakened = weakenOptionalGlibcVersions(native);
    if (weakened.length > 0) console.log(`${velopackNative.linux}: optional ${weakened.join(", ")}`);
  }
}

/**
 * velopack's Linux module is built against glibc 2.39, but its only 2.39 functions (pidfd_spawnp, pidfd_getpid, which
 * Rust's standard library uses when they exist) are weak symbols: it works with older glibc, yet the dynamic loader
 * refuses to load it there ("GLIBC_2.39 not found": Ubuntu 22.04, Debian 12), because the version is required. This
 * marks each glibc version that only weak symbols need, and that is newer than the newest one it really needs (2.34), as
 * weak (VER_FLG_WEAK in .gnu.version_r), so the loader accepts its absence and the weak symbols stay null – as Rust
 * expects. Returns the versions it marked.
 */
function weakenOptionalGlibcVersions(file) {
  const b = readFileSync(file);
  if (b.readUInt32BE(0) !== 0x7f454c46 || b[4] !== 2 || b[5] !== 1) throw new Error(`${file}: not a 64-bit little-endian ELF file`);
  const shoff = Number(b.readBigUInt64LE(0x28));
  const shentsize = b.readUInt16LE(0x3a);
  const shnum = b.readUInt16LE(0x3c);
  const sections = Array.from({ length: shnum }, (_, i) => {
    const o = shoff + i * shentsize;
    return { type: b.readUInt32LE(o + 4), offset: Number(b.readBigUInt64LE(o + 0x18)), size: Number(b.readBigUInt64LE(o + 0x20)), link: b.readUInt32LE(o + 0x28), entsize: Number(b.readBigUInt64LE(o + 0x38)) };
  });
  const SHT_DYNSYM = 11, SHT_GNU_VERSYM = 0x6fffffff, SHT_GNU_VERNEED = 0x6ffffffe, VER_FLG_WEAK = 2, STB_WEAK = 2;
  const dynsym = sections.find((s) => s.type === SHT_DYNSYM);
  const versym = sections.find((s) => s.type === SHT_GNU_VERSYM);
  const verneed = sections.find((s) => s.type === SHT_GNU_VERNEED);
  if (!dynsym || !versym || !verneed) return [];
  const strtab = sections[verneed.link];
  const str = (off) => b.toString("latin1", strtab.offset + off, b.indexOf(0, strtab.offset + off));
  // For each version index: are all the symbols that need it weak?
  const onlyWeak = new Map();
  for (let i = 1; i < dynsym.size / dynsym.entsize; i++) {
    const sym = dynsym.offset + i * dynsym.entsize;
    if (b.readUInt16LE(sym + 6) !== 0) continue; // defined here, not needed from a library
    const index = b.readUInt16LE(versym.offset + i * 2) & 0x7fff;
    const weak = b[sym + 4] >> 4 === STB_WEAK;
    onlyWeak.set(index, (onlyWeak.get(index) ?? true) && weak);
  }
  // libc's versions: [offset of the Vernaux entry, "GLIBC_x.y", needed only by weak symbols].
  const needed = [];
  for (let vn = verneed.offset; ; ) {
    const library = str(b.readUInt32LE(vn + 4));
    for (let aux = vn + b.readUInt32LE(vn + 8); ; ) {
      if (library.startsWith("libc.so")) needed.push([aux, str(b.readUInt32LE(aux + 8)), onlyWeak.get(b.readUInt16LE(aux + 6)) === true]);
      const next = b.readUInt32LE(aux + 12);
      if (next === 0) break;
      aux += next;
    }
    const next = b.readUInt32LE(vn + 12);
    if (next === 0) break;
    vn += next;
  }
  // Only the versions newer than the newest one it really needs (2.34) change anything.
  const number = (v) => (v.match(/\d+/g) ?? []).map(Number).reduce((a, n, i) => a + n / 1000 ** i, 0);
  const required = Math.max(0, ...needed.filter(([, , weak]) => !weak).map(([, v]) => number(v)));
  const weakened = [];
  for (const [aux, name, weak] of needed) {
    if (!weak || number(name) <= required) continue;
    b.writeUInt16LE(b.readUInt16LE(aux + 4) | VER_FLG_WEAK, aux + 4);
    weakened.push(name);
  }
  if (weakened.length > 0) writeFileSync(file, b);
  return weakened;
}

function stage(opts, appDir, stageDir) {
  const rel = relative(root, appDir).replaceAll("\\", "/");
  rmSync(stageDir, { recursive: true, force: true });
  mkdirSync(stageDir, { recursive: true });
  for (const part of ["dist", "dist-electron"]) {
    if (!existsSync(join(appDir, part))) throw new Error(`${rel}/${part} is missing: build the app first.`);
    cpSync(join(appDir, part), join(stageDir, rel, part), { recursive: true });
  }
  // Files the app reads from the repository at run time, listed by its build.
  const listFile = join(appDir, "dist-electron", "repo-files.json");
  if (existsSync(listFile)) {
    const files = JSON.parse(readFileSync(listFile, "utf8"));
    for (const f of files) {
      if (f.startsWith("/") || f.includes("..")) throw new Error(`repo-files.json: not a repository path: ${f}`);
      mkdirSync(dirname(join(stageDir, f)), { recursive: true });
      copyFileSync(join(root, f), join(stageDir, f));
    }
    rmSync(join(stageDir, rel, "dist-electron", "repo-files.json"));
    console.log(`${files.length} files of the repository (${relative(root, listFile)})`);
  }
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
