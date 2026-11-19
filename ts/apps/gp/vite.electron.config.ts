import { builtinModules } from "node:module";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

// The Electron main process, the preload script and the course worker (electron/<mode>.ts → dist-electron/<mode>.cjs),
// one build each (`vite build -c vite.electron.config.ts --mode main`, then `--mode preload` and `--mode worker`), so
// that each is a single file: a sandboxed preload can neither be an ES module nor require files of its own. Electron
// and Node's modules stay outside the bundle; the workspace packages are bundled. The icon is inlined as a data URL
// (library mode).
//
// The worker (a Node worker thread of the main process) runs the course: "Check my code", the expected results, saving
// files. It reads the course's binary files (textures, models, fonts) with node:fs from src/GP/content in the
// repository, by their path relative to @codestead/gp-course's Resources.ts (see resourcesUrl below); the packaged app
// has them at the same place relative to the app (noAssetUrls lists them for packaging/ts/package-app.mjs).
// velopack (updates) has a native module: it stays a require() of node_modules/velopack (the packaged app has it there,
// see packaging/ts/package-app.mjs).
const external = ["electron", "velopack", ...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

/** The repository's root (where src/GP/content is). */
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

/**
 * In Node the course never fetches its binary files by URL (Resources.readBytes reads them with node:fs), so their
 * `?url` imports (import.meta.glob in Resources.ts) become empty strings instead of being inlined as data URLs. The
 * files are listed in dist-electron/repo-files.json (paths relative to the repository): the packaged app must ship
 * them, at the same place relative to the app (packaging/ts/package-app.mjs).
 */
function noAssetUrls(): Plugin {
  const files = new Set<string>();
  return {
    name: "codestead-no-asset-urls",
    enforce: "pre",
    load(id) {
      if (!id.endsWith("?url") || !id.includes("/src/GP/")) return null;
      files.add(relative(repoRoot, id.slice(0, -"?url".length)).replaceAll("\\", "/"));
      return 'export default "";';
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "repo-files.json", source: JSON.stringify([...files].sort(), null, 1) });
    },
  };
}

/**
 * Resources.ts finds the course's files by their path relative to itself (new URL(path, import.meta.url)); a CommonJS
 * bundle has no import.meta, so its URL is given: where Resources.ts is in the repository, seen from dist-electron/.
 */
const resourcesUrl: Plugin = {
  name: "codestead-resources-url",
  transform(code, id) {
    if (!id.replaceAll("\\", "/").endsWith("/packages/gp-course/src/Resources.ts")) return null;
    const url = 'require("node:url").pathToFileURL(require("node:path").join(__dirname, "..", "..", "..", "packages", "gp-course", "src", "Resources.ts")).href';
    return { code: code.replaceAll("import.meta.url", url), map: null };
  },
};

export default defineConfig(({ mode }) => {
  if (mode !== "main" && mode !== "preload" && mode !== "worker") throw new Error("Build with --mode main, preload or worker.");
  return {
    root: fileURLToPath(new URL(".", import.meta.url)),
    plugins: mode === "worker" ? [noAssetUrls(), resourcesUrl] : [],
    resolve: {
      // The main process only needs storageDirectory of @codestead/ui – not React and the views.
      // (Only the bare name: "@codestead/ui/electron-main" and "-bridge" are the package's own small modules.)
      alias: [{ find: /^@codestead\/ui$/, replacement: fileURLToPath(new URL("../../packages/ui/src/Storage.ts", import.meta.url)) }],
    },
    build: {
      outDir: "dist-electron",
      emptyOutDir: mode === "main",
      minify: false,
      target: "node22",
      lib: { entry: { [mode]: `electron/${mode}.ts` }, formats: ["cjs"], fileName: (_format: string, name: string) => `${name}.cjs` },
      rollupOptions: { external, output: { codeSplitting: false } },
    },
  };
});
