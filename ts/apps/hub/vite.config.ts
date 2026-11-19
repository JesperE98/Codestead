import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The window (renderer): React, built to dist/ and loaded from file:// by electron/main.ts.
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [react()],
  // The hub reads the repository's files by path (texts, icons, changelog, packaging/products.json).
  server: { fs: { allow: [repoRoot] } },
  build: { outDir: "dist", emptyOutDir: true, target: "chrome140", assetsInlineLimit: 0 },
});
