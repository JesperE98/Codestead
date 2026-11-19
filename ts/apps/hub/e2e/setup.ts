import { type ChildProcess, spawn } from "node:child_process";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

// A world for the hub without any network: a catalog signed with a throw-away key (like packaging/hub-e2e.sh), whose
// tools are small packages on disk (file:// addresses), a data folder where Codestead Linux 0.6.3 is already installed
// (with a profile), and the options that make the hub use them (CODESTEAD_HUB_E2E=1 --catalog … --public-key …).

export const appDir = fileURLToPath(new URL("..", import.meta.url));
export const electronPath: string = createRequire(import.meta.url)("electron") as unknown as string;

/** A gzipped ustar archive with these files (mode 0755). */
function tarGz(files: Record<string, string>): Buffer {
  const blocks: Buffer[] = [];
  const octal = (v: number, n: number) => v.toString(8).padStart(n - 1, "0") + "\0";
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text);
    const h = Buffer.alloc(512);
    h.write(name, 0);
    h.write(octal(0o755, 8), 100);
    h.write(octal(0, 8), 108);
    h.write(octal(0, 8), 116);
    h.write(octal(data.length, 12), 124);
    h.write(octal(0, 12), 136);
    h.write("        ", 148);
    h.write("0", 156);
    h.write("ustar\0", 257, "latin1");
    h.write("00", 263);
    let sum = 0;
    for (const b of h) sum += b;
    h.write(octal(sum, 7) + " ", 148);
    blocks.push(h, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

const changes = (versions: string[], what: string) =>
  versions.map((v, i) => ({ version: v, date: `2026-11-1${i}`, changes: { en: [`${what} ${v}: something new`], sv: [`${what} ${v}: något nytt`] } }));

export interface World {
  dir: string;
  hubDir: string;
  dataDir: string;
  catalog: string;
  publicKey: string;
  env: Record<string, string>;
  /** The arguments that point the hub at the world's catalog. */
  args: string[];
}

export function createWorld(): World {
  const dir = mkdtempSync(join(tmpdir(), "codestead-hub-e2e-"));
  const hubDir = join(dir, "hub-data");
  const dataDir = join(dir, "settings");
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const publicPem = join(dir, "pub.pem");
  writeFileSync(publicPem, publicKey.export({ type: "spki", format: "pem" }));

  const rid = process.platform === "win32" ? "win-x64" : "linux-x64";
  const asset = (id: string, version: string, exe: string) => {
    const file = join(dir, `${id}-${version}-${rid}.tar.gz`);
    // A tool that answers --smoke-test like the real ones.
    writeFileSync(file, tarGz({ [exe]: `#!/bin/sh\necho "SMOKE OK ${id} ${version} (e2e)"\n` }));
    const bytes = readFileSync(file);
    return { url: pathToFileURL(file).href, sha256: createHash("sha256").update(bytes).digest("hex"), size: bytes.length, executable: exe };
  };
  const catalog = {
    schema: 1,
    generated: "2026-11-17T12:00:00Z",
    tools: [
      {
        id: "codestead-gp",
        name: "Codestead GP",
        description: { en: "Learn graphics programming by doing.", sv: "Lär dig grafikprogrammering genom att göra." },
        version: "0.2.5",
        changes: changes(["0.2.5", "0.2.4"], "GP"),
        assets: { [rid]: asset("codestead-gp", "0.2.5", "Codestead.GP") },
      },
      {
        id: "codestead-hub",
        name: "Codestead",
        description: { en: "Installs and updates the Codestead tools." },
        version: "0.2.0",
        assets: {},
      },
      {
        id: "codestead-linux",
        name: "Codestead Linux",
        description: { en: "Learn the Linux shell by doing.", sv: "Lär dig Linux-skalet genom att göra." },
        version: "0.6.5",
        changes: changes(["0.6.5", "0.6.4", "0.6.3"], "Linux"),
        assets: { [rid]: asset("codestead-linux", "0.6.5", "Codestead.Linux") },
      },
    ],
  };
  const catalogFile = join(dir, "catalog.json");
  const bytes = Buffer.from(JSON.stringify(catalog, null, 2));
  writeFileSync(catalogFile, bytes);
  writeFileSync(catalogFile + ".sig", sign("sha256", bytes, { key: privateKey, dsaEncoding: "der" }).toString("base64"));

  // Codestead Linux 0.6.3, installed earlier (by the C# hub or this one: the same current.json).
  const linux = join(hubDir, "tools", "codestead-linux");
  mkdirSync(join(linux, "0.6.3"), { recursive: true });
  writeFileSync(join(linux, "0.6.3", "Codestead.Linux"), "#!/bin/sh\nsleep 1\n", { mode: 0o755 });
  writeFileSync(
    join(linux, "current.json"),
    JSON.stringify({ id: "codestead-linux", version: "0.6.3", executable: "Codestead.Linux", directory: "", executablePath: "Codestead.Linux" }, null, 2),
  );
  // Its progress, written by the tool (profile.json).
  mkdirSync(join(dataDir, "codestead-linux"), { recursive: true });
  writeFileSync(
    join(dataDir, "codestead-linux", "profile.json"),
    JSON.stringify({
      schema: 1,
      xp: 520,
      level: 4,
      maxLevel: 10,
      levelStart: 400,
      nextLevelAt: 700,
      levelTitle: { en: "Pipe fitter", sv: "Rörläggare" },
      streak: 0,
      bestStreak: 3,
      categories: [{ id: "basics", title: { en: "Basics" } }],
      achievements: [
        { id: "first", icon: "🚀", category: "basics", unlockedAt: "2026-11-03T10:00", title: { en: "First steps" }, description: { en: "Solve a task." } },
        { id: "ten", icon: "🔟", category: "basics", current: 4, target: 10, title: { en: "Ten tasks" }, description: { en: "Solve ten tasks." } },
      ],
    }),
  );

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    CODESTEAD_HUB_DIR: hubDir,
    CODESTEAD_DATA_DIR: dataDir,
    CODESTEAD_HUB_E2E: "1",
    // The test machine's tray (if any) is not the hub's business.
    DBUS_SESSION_BUS_ADDRESS: "disabled:",
  };
  delete env.NODE_OPTIONS;
  return { dir, hubDir, dataDir, catalog: catalogFile, publicKey: publicPem, env, args: ["--catalog", catalogFile, "--public-key", publicPem] };
}

/** Chromium refuses to run as root without it (containers, CI). */
export const sandboxArgs: string[] = process.getuid?.() === 0 || process.env.CI ? ["--no-sandbox"] : [];

/** On Linux without a display: an Xvfb of our own (DISPLAY for the app). */
export async function ensureDisplay(): Promise<{ display: string | undefined; stop: () => void }> {
  if (process.platform !== "linux" || process.env.DISPLAY) return { display: process.env.DISPLAY, stop: () => {} };
  const number = 90 + Math.floor(Math.random() * 400);
  const xvfb: ChildProcess = spawn("Xvfb", [`:${number}`, "-screen", "0", "1280x900x24", "-nolisten", "tcp"], { stdio: "ignore" });
  for (let i = 0; i < 50 && !existsSync(`/tmp/.X11-unix/X${number}`); i++) await new Promise((r) => setTimeout(r, 100));
  return { display: `:${number}`, stop: () => xvfb.kill() };
}
