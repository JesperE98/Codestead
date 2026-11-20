// The updates of an app installed as a native Linux package (.deb, .rpm, Arch .pkg.tar.zst: /opt/<id>/, owned by the
// system's package manager), where Velopack cannot update it (VelopackUpdate.ts). The app downloads the package of the
// new version for this system from the version's release in the releases repository, checks it against the release's
// SHA256SUMS.txt and installs it with the system's package manager through pkexec (the system asks for the password
// once; as root, without pkexec), then starts again as the new version. Node only, for the apps' main processes.
//
// Security: the files come only over HTTPS from GitHub (the fixed releases repository; the downloads' redirects may only
// go to GitHub's download hosts), the package must have the SHA-256 the release's checksums file gives it (no sum, or
// another one: nothing is installed), the package manager and pkexec are taken from the system's own folders (not the
// PATH) and get the file as an argument (no shell), and the files are in a new private temporary folder that is removed
// again. There is no way to give the app another address for its updates.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { accessSync, constants, existsSync } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { SelfUpdate } from "../SelfUpdate.js";

/** The kind of native package the app is installed as. */
export type NativePackageKind = "deb" | "rpm" | "arch";

/** An installation by the system's package manager: its kind and the installed version. */
export interface NativeInstall {
  readonly kind: NativePackageKind;
  readonly version: string;
}

/** A command's end. `missing`: the program is not there (ENOENT). */
export interface CommandResult {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly missing?: boolean;
}

/** Runs a program with arguments (no shell) and never throws: the result says how it ended. */
export type RunCommand = (file: string, args: readonly string[], options?: { readonly timeoutMs?: number }) => Promise<CommandResult>;

/**
 * One HTTP GET that does not follow redirects: a redirect comes back as its 3xx response with its Location, and the
 * updates follow it themselves once they have checked where it goes (Electron's net.fetch can neither report where its
 * redirects went nor stop at them: {@link electronGet} is made of net.request; elsewhere {@link fetchGet}).
 */
export type HttpGet = (url: string) => Promise<Response>;

/** An {@link HttpGet} over fetch() (Node's: redirect "manual" gives the redirect itself). */
export function fetchGet(fetchFn: (url: string, init: { redirect: "manual" }) => Promise<Response>): HttpGet {
  return (url) => fetchFn(url, { redirect: "manual" });
}

/** The response of Electron's net.request: a stream of the body. */
interface ElectronResponseLike extends AsyncIterable<Uint8Array> {
  readonly statusCode: number;
  readonly statusMessage: string;
  readonly headers: Record<string, string | string[]>;
}

/** The part of Electron's net (its ClientRequest's events are overloads: given loosely here). */
export interface ElectronNetLike {
  request(options: { url: string; redirect: "manual" }): {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(event: any, listener: (...args: any[]) => void): unknown;
    abort(): void;
    end(): void;
  };
}

/**
 * An {@link HttpGet} of Electron's net.request in the main process (the system's proxy settings, like net.fetch): a
 * redirect is not followed but returned.
 */
export function electronGet(net: ElectronNetLike): HttpGet {
  return (url) =>
    new Promise<Response>((resolve, reject) => {
      const request = net.request({ url, redirect: "manual" });
      request.on("redirect", (statusCode: number, _method: string, redirectUrl: string) => {
        resolve(new Response(null, { status: statusCode, headers: { location: redirectUrl } }));
        request.abort();
      });
      request.on("response", (response: ElectronResponseLike) => {
        const headers = new Headers();
        for (const [name, value] of Object.entries(response.headers)) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
        const body = Readable.toWeb(Readable.from(response)) as ReadableStream<Uint8Array>;
        resolve(new Response(body, { status: response.statusCode, statusText: response.statusMessage, headers }));
      });
      request.on("error", reject);
      request.end();
    });
}

/** The system's own program folders: pkexec and the package managers are taken from here, never from the PATH. */
export const systemBinDirs: readonly string[] = ["/usr/bin", "/usr/sbin", "/bin", "/sbin"];

/** The hosts the downloads may come from: the releases on github.com and GitHub's download hosts it redirects to. */
export const allowedDownloadHosts: readonly string[] = ["github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com"];

/** The name of the checksums file of every release (`sha256sum` format; .github/workflows/release.yml). */
export const checksumsFileName = "SHA256SUMS.txt";

/** A package id that can be a package name and part of a path and a URL. */
function isPackageId(id: string): boolean {
  return /^[a-z0-9][a-z0-9.+-]*$/.test(id) && !id.includes("..");
}

/** major.minor.patch, the only versions the releases have. */
function parseVersion(s: string | null | undefined): [number, number, number] | null {
  if (s == null || !/^\d{1,9}\.\d{1,9}\.\d{1,9}$/.test(s)) return null;
  const [a, b, c] = s.split(".").map(Number);
  return [a!, b!, c!];
}

/** Is `candidate` a newer major.minor.patch than `current`? */
export function isNewerVersion(candidate: string, current: string): boolean {
  const c = parseVersion(candidate);
  const i = parseVersion(current);
  return c !== null && i !== null && (c[0] - i[0] || c[1] - i[1] || c[2] - i[2]) > 0;
}

/** The program in the system's folders, or null. */
export function findSystemTool(name: string, executable: (path: string) => boolean = isExecutable): string | null {
  for (const dir of systemBinDirs) {
    const path = `${dir}/${name}`;
    if (executable(path)) return path;
  }
  return null;
}

function isExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Runs a program without a shell, stdin from /dev/null, its output collected (the last 64 KB of each). */
export const runCommand: RunCommand = (file, args, options) =>
  new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    const keep = (s: string) => (s.length > 65536 ? s.slice(-65536) : s);
    let child;
    try {
      child = spawn(file, args, { stdio: ["ignore", "pipe", "pipe"], timeout: options?.timeoutMs });
    } catch (e) {
      resolve({ code: null, stdout: "", stderr: e instanceof Error ? e.message : String(e) });
      return;
    }
    child.stdout.setEncoding("utf8").on("data", (d: string) => (stdout = keep(stdout + d)));
    child.stderr.setEncoding("utf8").on("data", (d: string) => (stderr = keep(stderr + d)));
    child.once("error", (e: NodeJS.ErrnoException) => resolve({ code: null, stdout, stderr: stderr || e.message, missing: e.code === "ENOENT" }));
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });

/** What {@link detectNativeInstall} looks at (the running process by default; the tests give their own). */
export interface DetectEnvironment {
  readonly platform: string;
  /** The running executable: /opt/<id>/<exe>.bin in a native package. */
  readonly execPath: string;
  /** The AppImage's path when running from one (its runtime sets APPIMAGE). */
  readonly appImage?: string | undefined;
  readonly run: RunCommand;
  readonly findTool: (name: string) => string | null;
}

function processEnvironment(): DetectEnvironment {
  return { platform: process.platform, execPath: process.execPath, appImage: process.env.APPIMAGE, run: runCommand, findTool: (n) => findSystemTool(n) };
}

/**
 * Is the app installed as a native package? It runs from /opt/<id>/ and the system's package manager has the package
 * <id> installed (dpkg, rpm or pacman says so: the path alone is not enough). Null for everything else: an AppImage,
 * the hub's per-user copies, the portable archive, a development build, Windows.
 */
export async function detectNativeInstall(packageId: string, env: DetectEnvironment = processEnvironment()): Promise<NativeInstall | null> {
  if (env.platform !== "linux" || (env.appImage ?? "") !== "" || !isPackageId(packageId)) return null;
  if (!env.execPath.startsWith(`/opt/${packageId}/`) || env.execPath.includes("/../")) return null;
  const timeoutMs = 15_000;

  const dpkgQuery = env.findTool("dpkg-query");
  if (dpkgQuery !== null) {
    const r = await env.run(dpkgQuery, ["-W", "--showformat=${Status}\\t${Version}", packageId], { timeoutMs });
    const m = r.code === 0 ? /^install ok installed\t(\S+?)(?:-\d+)?$/.exec(r.stdout.trim()) : null;
    if (m) return { kind: "deb", version: m[1]! };
  }
  const rpm = env.findTool("rpm");
  if (rpm !== null) {
    const r = await env.run(rpm, ["-q", "--qf", "%{VERSION}", packageId], { timeoutMs });
    const v = r.stdout.trim();
    if (r.code === 0 && /^\S+$/.test(v)) return { kind: "rpm", version: v };
  }
  const pacman = env.findTool("pacman");
  if (pacman !== null) {
    const r = await env.run(pacman, ["-Q", packageId], { timeoutMs });
    const m = r.code === 0 ? /^(\S+) (\S+?)(?:-\d+)?$/.exec(r.stdout.trim()) : null;
    if (m && m[1] === packageId) return { kind: "arch", version: m[2]! };
  }
  return null;
}

/**
 * The file name of a version's package of this kind for this processor in the release <id>-v<version> (packaging/
 * build-linux.sh), or null where the releases have none (only x64 is built).
 */
export function nativePackageAsset(packageId: string, version: string, kind: NativePackageKind, arch: string): string | null {
  if (arch !== "x64" || !isPackageId(packageId) || parseVersion(version) === null) return null;
  switch (kind) {
    case "deb":
      return `${packageId}_${version}_amd64.deb`;
    case "rpm":
      return `${packageId}-${version}-1.x86_64.rpm`;
    case "arch":
      return `${packageId}-${version}-1-x86_64.pkg.tar.zst`;
  }
}

/** The address of a file in a release of the releases repository. */
export function releaseAssetUrl(releasesRepo: string, tag: string, file: string): string {
  return `https://github.com/${releasesRepo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(file)}`;
}

/** The SHA-256 (lower case hex) a checksums file (`sha256sum` output) gives a file, or null if it gives none. */
export function checksumFor(checksums: string, file: string): string | null {
  for (const line of checksums.split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{64}) [ *](.+?)\s*$/.exec(line);
    if (m && m[2] === file) return m[1]!.toLowerCase();
  }
  return null;
}

/** May a download come from (or be redirected to) this address? HTTPS from GitHub only. */
export function isAllowedDownloadUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.port === "" && u.username === "" && u.password === "" && allowedDownloadHosts.includes(u.hostname);
  } catch {
    return false;
  }
}

/** Why a native update did not happen (the message says it to the user, in English). */
export type NativeUpdateFailure = "download" | "checksum" | "cancelled" | "not-authorized" | "no-agent" | "install-failed";

export class NativeUpdateError extends Error {
  constructor(
    readonly reason: NativeUpdateFailure,
    message: string,
  ) {
    super(message);
    this.name = "NativeUpdateError";
  }
}

/** How many redirects a download may take (GitHub: one, to its download host). */
const maxRedirects = 5;

/** A GET of a GitHub download, its redirects followed only while they stay on GitHub's hosts. */
async function get(httpGet: HttpGet, url: string): Promise<Response> {
  if (!isAllowedDownloadUrl(url)) throw new NativeUpdateError("download", `Not a download from GitHub: ${url}`);
  for (let current = url, redirects = 0; ; redirects++) {
    let response: Response;
    try {
      response = await httpGet(current);
    } catch (e) {
      const cause = e instanceof Error && e.cause !== undefined ? e.cause : e;
      throw new NativeUpdateError("download", `The download failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel().catch(() => {});
      const location = response.headers.get("location");
      let next: string | null = null;
      try {
        next = location === null ? null : new URL(location, current).href;
      } catch {
        next = null;
      }
      if (next === null || redirects >= maxRedirects) throw new NativeUpdateError("download", `The download failed: ${url}: a broken redirect.`);
      if (!isAllowedDownloadUrl(next)) throw new NativeUpdateError("download", `The download was redirected away from GitHub: ${next}`);
      current = next;
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new NativeUpdateError("download", `The download failed: ${url}: ${response.status} ${response.statusText}`.trim());
    }
    return response;
  }
}

/** A small text file (at most `maxBytes`). */
export async function downloadText(httpGet: HttpGet, url: string, maxBytes = 1 << 20): Promise<string> {
  const response = await get(httpGet, url);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > maxBytes) throw new NativeUpdateError("download", `${url} is too large.`);
  return new TextDecoder().decode(bytes);
}

/**
 * Downloads to a new file (it must not exist) and returns its SHA-256 (lower case hex). Progress 0-100 as it arrives,
 * when the size is known.
 */
export async function downloadFile(httpGet: HttpGet, url: string, file: string, progress: (percent: number) => void, maxBytes = 2 * 1024 ** 3): Promise<string> {
  const response = await get(httpGet, url);
  const total = Number(response.headers.get("content-length") ?? NaN);
  const hash = createHash("sha256");
  const handle = await open(file, "wx", 0o600);
  let received = 0;
  let shown = -1;
  try {
    const reader = response.body?.getReader();
    for (;;) {
      if (!reader) break;
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (e) {
        throw new NativeUpdateError("download", `The download failed: ${e instanceof Error ? e.message : String(e)}`);
      }
      if (chunk.done) break;
      received += chunk.value.length;
      if (received > maxBytes) throw new NativeUpdateError("download", `${url} is too large.`);
      hash.update(chunk.value);
      await handle.write(chunk.value);
      if (total > 0) {
        const percent = Math.min(100, Math.floor((received * 100) / total));
        if (percent !== shown) progress((shown = percent));
      }
    }
  } finally {
    await handle.close();
  }
  if (total > 0 && received !== total) throw new NativeUpdateError("download", `The download of ${url} ended early.`);
  return hash.digest("hex");
}

/** The latest version in a product's Velopack feed (releases.linux.json of <id>-latest, which the AppImage updates from). */
export async function latestFromVelopackFeed(httpGet: HttpGet, feedUrl: string, packageId: string): Promise<string | null> {
  const json = JSON.parse(await downloadText(httpGet, `${feedUrl}releases.linux.json`)) as { Assets?: unknown };
  let best: string | null = null;
  for (const a of Array.isArray(json.Assets) ? (json.Assets as Record<string, unknown>[]) : []) {
    const v = a?.Version;
    if (a?.PackageId !== packageId || a?.Type !== "Full" || typeof v !== "string" || parseVersion(v) === null) continue;
    if (best === null || isNewerVersion(v, best)) best = v;
  }
  return best;
}

/** A program with its arguments. */
export interface Command {
  readonly file: string;
  readonly args: readonly string[];
}

/**
 * The package manager's command that installs the package file (the new version of an installed package), or null when
 * the system has none it can use: apt-get (.deb); dnf, zypper or rpm (.rpm); pacman (Arch). Not as root: through
 * pkexec, which asks for the password (null without pkexec).
 */
export function installCommand(kind: NativePackageKind, file: string, isRoot: boolean, findTool: (name: string) => string | null): Command | null {
  let command: Command | null = null;
  const tool = (name: string, args: (path: string) => string[]) => {
    if (command !== null) return;
    const path = findTool(name);
    if (path !== null) command = { file: path, args: args(path) };
  };
  switch (kind) {
    case "deb":
      // apt-get, not dpkg -i: it installs the new version's dependencies too, and changes nothing if it cannot.
      tool("apt-get", () => ["install", "-y", file]);
      break;
    case "rpm":
      tool("dnf", () => ["install", "-y", file]);
      tool("zypper", () => ["--non-interactive", "install", "--allow-unsigned-rpm", file]);
      tool("rpm", () => ["-U", file]);
      break;
    case "arch":
      tool("pacman", () => ["-U", "--noconfirm", file]);
      break;
  }
  if (command === null) return null;
  const c: Command = command;
  if (isRoot) return c;
  const pkexec = findTool("pkexec");
  return pkexec === null ? null : { file: pkexec, args: [c.file, ...c.args] };
}

/** The last lines of a program's output, for a message. */
function tail(text: string, lines = 6): string {
  return text.trim().split(/\r?\n/).slice(-lines).join("\n");
}

/** How an install command ended, as an error for the user, or null when it worked. */
export function installFailure(result: CommandResult, command: Command, viaPkexec: boolean): NativeUpdateError | null {
  if (result.code === 0) return null;
  const tool = (viaPkexec ? command.args[0] : command.file)?.split("/").pop() ?? "the package manager";
  const output = tail(result.stderr) || tail(result.stdout);
  if (result.missing) return new NativeUpdateError("install-failed", `${command.file} could not be started.`);
  if (viaPkexec) {
    // pkexec: 126 – the user dismissed the password dialog; 127 – not authorized, or no authentication agent to ask.
    if (result.code === 126) return new NativeUpdateError("cancelled", "The password dialog was closed, so the update was not installed.");
    if (result.code === 127) {
      if (/no authentication agent/i.test(result.stderr)) {
        return new NativeUpdateError("no-agent", "No program is running that can ask for your password (a polkit authentication agent), so the update could not be installed.");
      }
      return new NativeUpdateError("not-authorized", `Installing the update was not allowed${output ? `: ${output}` : "."}`);
    }
  }
  const how = result.code === null ? "did not finish" : `ended with code ${result.code}`;
  return new NativeUpdateError("install-failed", `${tool} ${how}${output ? `: ${output}` : "."}`);
}

/** Options of {@link NativePackageSelfUpdate}. */
export interface NativeUpdateOptions {
  /** "owner/repo" of the public releases repository. */
  readonly releasesRepo: string;
  readonly packageId: string;
  /** The running app's version. */
  readonly currentVersion: string;
  readonly install: NativeInstall;
  /** The latest released version (the hub: its signed catalog; the learning apps: the Velopack feed). */
  readonly latestVersion: () => Promise<string | null>;
  /** One GET without redirects (Electron: {@link electronGet}). */
  readonly get: HttpGet;
  /** Starts the app again (the new version) once this process has ended, and ends it. */
  readonly restart: () => void;
  /** process.arch by default. */
  readonly arch?: string;
  /** Running as root: the package manager is run directly, without pkexec. */
  readonly isRoot?: boolean;
  readonly run?: RunCommand;
  readonly findTool?: (name: string) => string | null;
  /** Where the private temporary folder is made (the system's temporary folder by default). */
  readonly tempRoot?: string;
  /** Lines about what it does (the main process's log). */
  readonly log?: (line: string) => void;
}

/**
 * The {@link SelfUpdate} of an app installed as a native package: the package of the new version, checked against its
 * release's checksums, installed by the system's package manager (pkexec asks for the password), then a restart.
 * Progress: 0-100 while downloading, then -1 while the package manager installs it.
 */
export class NativePackageSelfUpdate implements SelfUpdate {
  private pending: string | null = null;
  private readonly arch: string;
  private readonly isRoot: boolean;
  private readonly run: RunCommand;
  private readonly findTool: (name: string) => string | null;

  constructor(private readonly o: NativeUpdateOptions) {
    this.arch = o.arch ?? process.arch;
    this.isRoot = o.isRoot ?? process.getuid?.() === 0;
    this.run = o.run ?? runCommand;
    this.findTool = o.findTool ?? ((n) => findSystemTool(n));
  }

  /** There is a package for this system and a way to install it (as root, or with pkexec). */
  get canUpdateItself(): boolean {
    return nativePackageAsset(this.o.packageId, "0.0.0", this.o.install.kind, this.arch) !== null && installCommand(this.o.install.kind, "/x", this.isRoot, this.findTool) !== null;
  }

  /** Not as root: pkexec asks for the password. */
  get asksForPassword(): boolean {
    return !this.isRoot;
  }

  async check(): Promise<string | null> {
    if (!this.canUpdateItself) return null;
    const latest = await this.o.latestVersion();
    this.pending = latest !== null && isNewerVersion(latest, this.o.currentVersion) ? latest : null;
    return this.pending;
  }

  async downloadAndRestart(progress: (percent: number) => void): Promise<void> {
    const version = this.pending;
    if (version === null) return;
    const { kind } = this.o.install;
    const asset = nativePackageAsset(this.o.packageId, version, kind, this.arch);
    if (asset === null) throw new NativeUpdateError("download", `There is no ${kind} package for this computer (${this.arch}).`);
    const tag = `${this.o.packageId}-v${version}`;
    const log = this.o.log ?? (() => {});
    const dir = await mkdtemp(join(this.o.tempRoot ?? tmpdir(), `${this.o.packageId}-update-`));
    try {
      const sums = await downloadText(this.o.get, releaseAssetUrl(this.o.releasesRepo, tag, checksumsFileName));
      const expected = checksumFor(sums, asset);
      if (expected === null) throw new NativeUpdateError("checksum", `${checksumsFileName} of ${tag} has no checksum for ${asset}, so it is not installed.`);
      const file = join(dir, asset);
      log(`Downloading ${releaseAssetUrl(this.o.releasesRepo, tag, asset)}`);
      const actual = await downloadFile(this.o.get, releaseAssetUrl(this.o.releasesRepo, tag, asset), file, progress);
      if (actual !== expected) throw new NativeUpdateError("checksum", `${asset} does not have the checksum its release gives (${checksumsFileName}), so it is not installed.`);
      log(`SHA-256 ${actual} matches ${checksumsFileName}`);

      const command = installCommand(kind, file, this.isRoot, this.findTool);
      if (command === null) throw new NativeUpdateError("install-failed", "The system has no package manager or pkexec to install the update with.");
      progress(-1);
      log(`Installing: ${command.file} ${command.args.join(" ")}`);
      // No time limit: the user may take a while to type the password.
      const result = await this.run(command.file, command.args);
      const failure = installFailure(result, command, !this.isRoot);
      if (failure !== null) throw failure;
      log(`Installed ${this.o.packageId} ${version}`);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
    this.o.restart();
  }
}

/**
 * Starts `executable` with `args` once the process `pid` has ended (a small detached shell that waits for it, at most a
 * minute): the new version must not meet the old one still running (the hub allows one per user). The arguments are
 * the shell's own ("$@"), never part of its script.
 */
export function relaunchAfterExit(executable: string, args: readonly string[], pid: number = process.pid, inheritOutput = false): void {
  const script = 'i=0; while kill -0 "$1" 2>/dev/null && [ "$i" -lt 600 ]; do sleep 0.1; i=$((i+1)); done; shift; exec "$@"';
  const child = spawn("/bin/sh", ["-c", script, "codestead-restart", String(pid), executable, ...args], {
    detached: true,
    stdio: inheritOutput ? ["ignore", "inherit", "inherit"] : "ignore",
  });
  child.unref();
}

/** The packaged app's executable on Linux is a launcher script next to Electron (`<exe>` for `<exe>.bin`). */
export function launcherOf(execPath: string): string {
  const launcher = execPath.endsWith(".bin") ? execPath.slice(0, -".bin".length) : null;
  return launcher !== null && existsSync(launcher) ? launcher : execPath;
}
