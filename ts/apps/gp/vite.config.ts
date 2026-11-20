import { relative } from "node:path";
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

/** Where the built page's scripts are (Vite puts every chunk, the workers' too, in dist/assets). */
const assetsDir = fileURLToPath(new URL("./dist/assets/", import.meta.url));

/**
 * The course's binary files (src/GP/content: the chapters' pictures, the projects' textures, models and fonts) are not
 * copied into dist/assets: the built page loads them from where they are in the repository, by their URL relative to its
 * scripts. The course worker reads the same files there (vite.electron.config.ts), so the packaged app has them once, at
 * the same place relative to the app (≈ 30 MB less): they are listed in dist/repo-files.json for
 * packaging/ts/package-app.mjs. (The dev server serves them from the repository as before.)
 */
function courseFilesInPlace(): Plugin {
  const files = new Set<string>();
  return {
    name: "codestead-course-files-in-place",
    apply: "build",
    enforce: "pre",
    load(id) {
      if (!id.endsWith("?url")) return null;
      const file = id.slice(0, -"?url".length);
      const rel = relative(repoRoot, file).replaceAll("\\", "/");
      if (!rel.startsWith("src/GP/")) return null;
      files.add(rel);
      // Not new URL("…", import.meta.url) with the string itself: Vite would copy the file into dist/assets again.
      const url = JSON.stringify(relative(assetsDir, file).replaceAll("\\", "/"));
      return `const path = ${url};\nexport default new URL(path, import.meta.url).href;\n`;
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "repo-files.json", source: JSON.stringify([...files].sort(), null, 1) });
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [react(), contentSecurityPolicy, courseFilesInPlace()],
  server: { fs: { allow: [repoRoot] } },
  build: { outDir: "dist", emptyOutDir: true, chunkSizeWarningLimit: 20_000 },
});
