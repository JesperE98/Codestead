import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// The main process and the preload script, each bundled into one CommonJS file in dist-electron/:
//   vite build -c vite.electron.config.ts --mode main      → dist-electron/main.cjs
//   vite build -c vite.electron.config.ts --mode preload   → dist-electron/preload.cjs
// Two builds, so the sandboxed preload never needs a shared chunk (it can only require "electron").
export default defineConfig(({ mode }) => {
  const entry = mode === "preload" ? "electron/preload.ts" : "electron/main.ts";
  return {
    root: fileURLToPath(new URL(".", import.meta.url)),
    publicDir: false,
    build: {
      outDir: "dist-electron",
      emptyOutDir: mode !== "preload",
      target: "node22",
      minify: false,
      sourcemap: false,
      ssr: entry,
      rollupOptions: {
        external: ["electron", ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
        output: { format: "cjs", entryFileNames: `${mode === "preload" ? "preload" : "main"}.cjs`, codeSplitting: false },
      },
    },
    // Bundle the workspace packages (TypeScript sources) into the files.
    ssr: { noExternal: true, target: "node" },
  };
});
