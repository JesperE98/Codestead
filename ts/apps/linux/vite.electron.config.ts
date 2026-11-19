import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The Electron main process and the preload script (electron/<mode>.ts → dist-electron/<mode>.cjs), one build each
// (`vite build -c vite.electron.config.ts --mode main`, then `--mode preload`), so that each is a single file: a
// sandboxed preload can neither be an ES module nor require files of its own. Electron and Node's modules stay
// outside the bundle; the workspace packages are bundled. The icon is inlined as a data URL (library mode).
// velopack (updates) has a native module: it stays a require() of node_modules/velopack (the packaged app has it there,
// see packaging/ts/package-app.mjs).
const external = ["electron", "velopack", ...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

export default defineConfig(({ mode }) => {
  if (mode !== "main" && mode !== "preload") throw new Error("Build with --mode main or --mode preload.");
  return {
    root: fileURLToPath(new URL(".", import.meta.url)),
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
      rollupOptions: { external },
    },
  };
});
