import { builtinModules } from "node:module";
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
// repository, by their path relative to @codestead/gp-course's Resources.ts (see resourcesUrl below; TODO phase 5:
// packaging ships the content and points there).
const external = ["electron", ...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

/**
 * In Node the course never fetches its binary files by URL (Resources.readBytes reads them with node:fs), so their
 * `?url` imports (import.meta.glob in Resources.ts) become empty strings instead of being inlined as data URLs.
 */
const noAssetUrls: Plugin = {
  name: "codestead-no-asset-urls",
  enforce: "pre",
  load(id) {
    return id.endsWith("?url") && id.includes("/src/GP/") ? 'export default "";' : null;
  },
};

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
    plugins: mode === "worker" ? [noAssetUrls, resourcesUrl] : [],
    resolve: {
      // The main process only needs storageDirectory of @codestead/ui – not React and the views.
      alias: { "@codestead/ui": fileURLToPath(new URL("../../packages/ui/src/Storage.ts", import.meta.url)) },
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
