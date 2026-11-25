import { type ChildProcess, spawn as nodeSpawn, type SpawnOptions } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { open } from "node:fs/promises";
import { basename, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { extractTarGz, extractZip } from "./Archives.js";
import type { CatalogAsset } from "./CatalogAsset.js";
import type { CatalogTool } from "./CatalogTool.js";
import { isLocalPath } from "./CatalogTool.js";
import { ArgumentError, InvalidDataError, InvalidOperationError, messageOf } from "./Errors.js";
import type { HttpClient } from "./Http.js";
import { currentJson, executablePath, type InstalledTool, installedTool } from "./InstalledTool.js";
import { isSafeId } from "./SafeId.js";
import { SemVer } from "./SemVer.js";

/** How a tool is started (child_process.spawn; tests can pass their own). */
export type SpawnFunction = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess;

/**
 * Installs tools per user, without administrator rights:
 * `<root>/tools/<id>/<version>/…` plus `<root>/tools/<id>/current.json`.
 * A new version is downloaded, checked (size and SHA-256 from the signed catalog), unpacked next to the
 * old one and only then made current, so an interrupted update never breaks the installed tool.
 * The previous version is kept so it can be restored. The tools' own data (progress, settings) lives
 * elsewhere and is not touched by uninstalling.
 */
const CurrentFile = "current.json";

export class ToolStore {
  constructor(
    readonly root: string,
    private readonly spawn: SpawnFunction = nodeSpawn,
  ) {}

  private get toolsDir(): string {
    return join(this.root, "tools");
  }

  /** Ids become folder names: lower-case letters, digits and dashes only. */
  static isSafeId(id: string): boolean {
    return isSafeId(id);
  }

  private toolDir(id: string): string {
    if (!isSafeId(id)) throw new ArgumentError(`Invalid tool id "${id}".`, "id");
    return join(this.toolsDir, id);
  }

  /** The installed version of a tool, or null. */
  installed(id: string): InstalledTool | null {
    const file = join(this.toolDir(id), CurrentFile);
    if (!existsSync(file)) return null;
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      if (e instanceof SyntaxError) return null; // JsonException
      throw e;
    }
    const t = readInstalled(raw);
    if (t === null || t.id !== id || SemVer.parse(t.version) === null) return null;
    const dir = join(this.toolDir(id), t.version);
    return isDirectory(dir) ? { ...t, directory: dir } : null;
  }

  all(): InstalledTool[] {
    if (!isDirectory(this.toolsDir)) return [];
    return readdirSync(this.toolsDir, { withFileTypes: true })
      .filter((d) => (d.isDirectory() || (d.isSymbolicLink() && isDirectory(join(this.toolsDir, d.name)))) && isSafeId(d.name))
      .map((d) => this.installed(d.name))
      .filter((t): t is InstalledTool => t !== null);
  }

  /**
   * Downloads, checks and installs `asset` as the current version of `tool`.
   * @param progress Download progress 0..1.
   */
  async install(tool: CatalogTool, asset: CatalogAsset, http: HttpClient, progress?: (fraction: number) => void): Promise<InstalledTool> {
    const toolDir = this.toolDir(tool.id);
    mkdirSync(toolDir, { recursive: true });
    const token = randomUUID().replace(/-/g, "");
    const download = join(toolDir, `.download-${token}`);
    const staging = join(toolDir, `.staging-${token}`);
    try {
      await downloadAsset(asset, http, download, progress);

      mkdirSync(staging, { recursive: true });
      if (asset.url.toLowerCase().endsWith(".zip")) await extractZip(download, staging);
      else await extractTarGz(download, staging);
      const exe = join(staging, asset.executable);
      if (!isFile(exe)) throw new InvalidDataError(`The package does not contain ${asset.executable}.`);
      if (process.platform !== "win32") chmodSync(exe, statSync(exe).mode | 0o111);

      const previous = this.installed(tool.id);
      const versionDir = join(toolDir, tool.version);
      if (isDirectory(versionDir)) moveAside(versionDir);
      renameSync(staging, versionDir);

      const installed = installedTool(
        tool.id,
        tool.version,
        asset.executable,
        previous !== null && previous.version !== tool.version ? previous.version : (previous?.previous ?? null),
      );
      writeCurrent(toolDir, installed);
      cleanup(toolDir, installed);
      return { ...installed, directory: versionDir };
    } finally {
      tryDelete(download);
      tryDelete(staging);
    }
  }

  /** Makes the previous version current again (after a bad update). */
  rollBack(id: string): InstalledTool | null {
    const current = this.installed(id);
    if (current?.previous == null) return null;
    const dir = join(this.toolDir(id), current.previous);
    if (!isDirectory(dir)) return null;
    const rolled = installedTool(id, current.previous, current.executable, null);
    writeCurrent(this.toolDir(id), rolled);
    return { ...rolled, directory: dir };
  }

  /**
   * How long an uninstall keeps trying (about 15 s): an Electron tool's helper processes (GPU, utility) run the tool's own
   * executable and can hold it on Windows for several seconds after the tool's main process has exited.
   */
  private static readonly UninstallAttempts = 30;
  private static readonly UninstallRetryDelayMs = 500;

  /** Removes a tool and all of its versions. Throws if it is running (Windows) and stays locked. */
  async uninstall(id: string): Promise<void> {
    const dir = this.toolDir(id);
    if (!isDirectory(dir)) return;
    // Removing current.json first means a half-finished uninstall leaves the tool "not installed".
    rmSync(join(dir, CurrentFile), { force: true });
    // Right after the tool has exited, Windows (or a virus scanner) may still hold its files for a moment.
    for (let attempt = 1; ; attempt++) {
      try {
        rmSync(dir, { recursive: true, force: true });
        return;
      } catch (e) {
        if (attempt >= ToolStore.UninstallAttempts) throw e;
        await new Promise((r) => setTimeout(r, ToolStore.UninstallRetryDelayMs));
      }
    }
  }

  /**
   * Starts the installed tool (with `captureOutput`: standard output can be read, for tests). Resolves once the
   * process has started (Process.Start); a program that cannot be started rejects.
   */
  launch(id: string, args: readonly string[], captureOutput = false): Promise<ChildProcess> {
    const t = this.installed(id);
    if (t === null) return Promise.reject(new InvalidOperationError(`${id} is not installed.`));
    const exe = executablePath(t, sep);
    return new Promise((resolve, reject) => {
      let child: ChildProcess;
      try {
        child = this.spawn(exe, args, { cwd: t.directory, stdio: ["ignore", captureOutput ? "pipe" : "inherit", "inherit"] });
      } catch (e) {
        reject(new InvalidOperationError(`Could not start ${exe}: ${messageOf(e)}`));
        return;
      }
      child.once("spawn", () => resolve(child));
      child.once("error", (e) => reject(e));
    });
  }
}

/** current.json, read as C#'s JsonSerializer.Deserialize&lt;InstalledTool&gt;: null when it is not one. */
function readInstalled(raw: unknown): InstalledTool | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const id = str(o.id);
  const version = str(o.version);
  const executable = str(o.executable);
  if (id === null || version === null || executable === null) return null;
  if (o.previous !== undefined && o.previous !== null && typeof o.previous !== "string") return null;
  return installedTool(id, version, executable, str(o.previous));
}

async function downloadAsset(asset: CatalogAsset, http: HttpClient, target: string, progress?: (fraction: number) => void): Promise<void> {
  const input: AsyncIterable<Uint8Array> = isFileUrl(asset.url) ? createReadStream(localPath(asset.url)) : await http.getStream(asset.url);
  const output = await open(target, "w");
  try {
    const sha = createHash("sha256");
    let total = 0;
    for await (const chunk of input) {
      const n = chunk.length;
      if (n === 0) continue;
      total += n;
      if (total > asset.size) throw new InvalidDataError("The download is larger than the catalog says – it is not used.");
      sha.update(chunk);
      await output.write(chunk);
      progress?.(total / asset.size);
    }
    if (total !== asset.size) throw new InvalidDataError(`The download is incomplete (${total} of ${asset.size} bytes).`);
    const hash = sha.digest("hex");
    if (hash.toLowerCase() !== asset.sha256.toLowerCase())
      throw new InvalidDataError("The download's checksum (SHA-256) is wrong – the file has been changed or damaged and is not used.");
  } finally {
    await output.close();
  }
}

function isFileUrl(url: string): boolean {
  return isLocalPath(url) || url.toLowerCase().startsWith("file:");
}

/** Uri.LocalPath of a file address. */
function localPath(url: string): string {
  return isLocalPath(url) ? url : fileURLToPath(url);
}

function writeCurrent(toolDir: string, tool: InstalledTool): void {
  const tmp = join(toolDir, CurrentFile + ".tmp");
  writeFileSync(tmp, currentJson(tool));
  renameSync(tmp, join(toolDir, CurrentFile));
}

/** Removes versions other than the current and the previous one, and leftovers of interrupted runs. */
function cleanup(toolDir: string, keep: InstalledTool): void {
  for (const entry of readdirSync(toolDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = basename(entry.name);
    if (name === keep.version || name === keep.previous) continue;
    tryDelete(join(toolDir, name));
  }
}

function moveAside(dir: string): void {
  const aside = dir + `.old-${randomUUID().replace(/-/g, "")}`;
  renameSync(dir, aside);
  tryDelete(aside);
}

function tryDelete(path: string): void {
  try {
    if (isDirectory(path)) rmSync(path, { recursive: true, force: true });
    else if (existsSync(path)) unlinkSync(path);
  } catch {
    // In use (e.g. an old version still running on Windows) – removed next time.
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
