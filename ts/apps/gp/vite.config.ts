import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// The renderer of Codestead GP (index.html → dist/). The packages read the course content from src/ in the
// repository by path, so Vite may serve files from the repository root; base "./" lets the built page load from
// file:// in Electron.
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

/** The built page may load only its own scripts (the dev server needs inline scripts, so only the build gets it). */
const contentSecurityPolicy: Plugin = {
  name: "codestead-csp",
  apply: "build",
  transformIndexHtml: () => [
    {
      tag: "meta",
      attrs: {
        "http-equiv": "Content-Security-Policy",
        content: "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'",
      },
      injectTo: "head-prepend",
    },
  ],
};

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [react(), contentSecurityPolicy],
  server: { fs: { allow: [repoRoot] } },
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 20_000 },
});
