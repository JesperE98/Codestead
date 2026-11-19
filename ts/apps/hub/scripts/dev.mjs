// npm run dev: the window from Vite's dev server (hot reload), the main process built once, in Electron.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const app = fileURLToPath(new URL("..", import.meta.url));
const server = await createServer({ configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)) });
await server.listen();
const url = server.resolvedUrls?.local[0];
const electron = createRequire(import.meta.url)("electron");
const extra = process.getuid?.() === 0 ? ["--no-sandbox"] : [];
const child = spawn(electron, [app, ...extra, ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, VITE_DEV_SERVER_URL: url } });
child.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
