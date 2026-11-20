// Chromium's sandbox for the tools the hub installs per user (<data root>/tools/<id>/<version>/, ToolStore), on
// systems that restrict unprivileged user namespaces with AppArmor (Ubuntu 23.10 and later:
// kernel.apparmor_restrict_unprivileged_userns = 1). There only programs whose AppArmor profile has the `userns` rule
// may use them, and Chromium's sandbox needs them (or its setuid helper, which only the .deb/.rpm/Arch packages can
// install). Without either, packaging/ts/launcher.sh starts the tools with --no-sandbox.
//
// What the hub does (docs/DEVELOPMENT.md, "Chromium's sandbox på Linux"):
// - Installed as a package, the hub runs under its package's profile (/etc/apparmor.d/codestead-hub), and the tools it
//   starts keep that profile (an exec without a profile of its own stays in an unconfined profile): nothing to do.
// - Otherwise (AppImage, portable archive) it offers to install a profile for the user's own tools,
//   /etc/apparmor.d/codestead-user-<uid>, that attaches only to Codestead's Electron binaries in this user's hub folder
//   (<data root>/tools/codestead-linux/<version>/Codestead.Linux.bin …). pkexec runs a fixed script as root (no shell
//   text is built from user data: the folder and the tools are its arguments, and it checks them itself), which writes
//   the profile it generates and loads it with apparmor_parser.
//
// Security: the folder belongs to the user, so any program running as this user can put a program at such a path, and
// so use user namespaces – for this user the profile lifts the restriction. That is no more than every userns profile
// for a dynamically linked program gives already (LD_PRELOAD into the profiled program, or a program it starts, which
// keeps the profile: Ubuntu's own profiles for Chrome, VS Code or Slack, and the packages' profile, give it to every
// user who can start the program), and Ubuntu treats the restriction as hardening, with such profiles as its way to
// let apps that need user namespaces have them. The script refuses folders other users could write to (outside the
// user's home, or a folder on the way not owned by the user or writable by others), so the profile never gives other
// users anything. Installing the hub as a package needs no such profile and is the safer choice; the hub's own
// sandbox as an AppImage is not restored at all (it runs from a /tmp/.mount_* path any user could create).

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { posix } from "node:path";
import { type CommandResult, findSystemTool, type RunCommand, runCommand } from "@codestead/ui/electron-main";
import { Products } from "@codestead/common";

/** An Electron tool the hub installs: its id (the folder under tools/) and its executable (<exe>.bin is Electron). */
export interface SandboxTool {
  readonly id: string;
  readonly exe: string;
}

/**
 * Whether Chromium's sandbox works for the tools the hub starts.
 * - `not-needed`: not Linux, running as root (the tools run without the sandbox anyway), or user namespaces are not
 *   restricted;
 * - `inherited`: the hub runs under a Codestead profile (its package's), which the tools it starts keep;
 * - `on`: this user's profile is installed (as the hub would write it now);
 * - `off`: it can be turned on (pkexec, AppArmor 4's parser, a suitable folder);
 * - `unavailable`: restricted, but it cannot be turned on here.
 */
export type SandboxState = "not-needed" | "inherited" | "on" | "off" | "unavailable";

export interface SandboxStatus {
  readonly state: SandboxState;
  /** The profile's file (`on`, `off`). */
  readonly profile?: string;
}

/** What the sandbox functions look at (the running process by default; the tests give their own). */
export interface SandboxEnvironment {
  readonly platform: string;
  readonly uid: number;
  /** The user's home folder. */
  readonly home: string;
  /** A file's text, or null. */
  readFile(path: string): string | null;
  /** The path with symbolic links resolved, or null when it does not exist. */
  realpath(path: string): string | null;
  /** A program in the system's own folders (never the PATH), or null. */
  findTool(name: string): string | null;
  exists(path: string): boolean;
}

export function processSandboxEnvironment(): SandboxEnvironment {
  return {
    platform: process.platform,
    uid: process.getuid?.() ?? -1,
    home: homedir(),
    readFile: (path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return null;
      }
    },
    realpath: (path) => {
      try {
        return realpathSync(path);
      } catch {
        return null;
      }
    },
    findTool: (name) => findSystemTool(name),
    exists: existsSync,
  };
}

/** The sysctl Ubuntu restricts unprivileged user namespaces with (1: restricted). */
export const restrictionSysctl = "/proc/sys/kernel/apparmor_restrict_unprivileged_userns";
/** Where AppArmor's profiles are. */
export const profileDir = "/etc/apparmor.d";

/** The name (and file name) of a user's profile: codestead-user-<uid>. */
export function userProfileName(uid: number): string {
  return `codestead-user-${uid}`;
}

/** The Electron tools of packaging/products.json (every product but the hub), whose binaries the profile covers. */
export function sandboxTools(): SandboxTool[] {
  return Products.all.filter((p) => p.key !== "hub").map((p) => ({ id: p.id, exe: p.exe }));
}

/** A tool the profile may name: codestead-<…> and Codestead.<…> only (the script checks the same). */
export function isSandboxTool(t: SandboxTool): boolean {
  return /^codestead-[a-z0-9-]+$/.test(t.id) && /^Codestead\.[A-Za-z0-9]+$/.test(t.exe);
}

/**
 * A folder the profile can name as it is: absolute and plain (no `.` or `..` part, no `//`, no trailing slash), with
 * only letters, digits and `._-/` – nothing AppArmor would read as a pattern, a variable or a quote.
 */
export function isProfilePath(path: string): boolean {
  if (!/^\/[A-Za-z0-9._/-]+$/.test(path) || path.endsWith("/")) return false;
  return path
    .slice(1)
    .split("/")
    .every((part) => part !== "" && part !== "." && part !== "..");
}

/** The tools' Electron binaries under <root>/tools/: `codestead-linux/[0-9]*\/Codestead.Linux.bin`, in braces when more. */
export function attachPattern(tools: readonly SandboxTool[]): string {
  const parts = tools.map((t) => `${t.id}/[0-9]*/${t.exe}.bin`);
  return parts.length === 1 ? parts[0]! : `{${parts.join(",")}}`;
}

/**
 * The profile, with `${uid}`, `${root}` and `${attach}` to fill in: the script (a here-document) and
 * {@link userProfileText} fill them in the same way. No other `$`, backslash or backquote (the here-document would
 * read them).
 */
export const profileTemplate =
  [
    "# Chromium's sandbox for the Codestead tools the Codestead hub installs for user ${uid} in ${root}/tools.",
    "# Ubuntu 23.10 and later let only programs with a profile that allows it use unprivileged user namespaces, which",
    "# Chromium's sandbox needs. This profile allows them for the tools' Electron binaries and changes nothing else",
    "# (unconfined). The hub installed it when asked to, with an administrator's password. To remove it:",
    "#   sudo apparmor_parser -R /etc/apparmor.d/codestead-user-${uid} && sudo rm /etc/apparmor.d/codestead-user-${uid}",
    "abi <abi/4.0>,",
    "include <tunables/global>",
    "",
    "profile codestead-user-${uid} ${root}/tools/${attach} flags=(unconfined) {",
    "  userns,",
    "",
    "  # Site-specific additions and overrides. See local/README for details.",
    "  include if exists <local/codestead-user-${uid}>",
    "}",
  ].join("\n") + "\n";

/** The profile for this user's tools in `root` (a real path: symbolic links resolved). */
export function userProfileText(uid: number, root: string, tools: readonly SandboxTool[]): string {
  return profileTemplate.replaceAll("${uid}", String(uid)).replaceAll("${root}", root).replaceAll("${attach}", attachPattern(tools));
}

/** Where the script writes, and which parsers it tries (the tests give their own). */
export interface ScriptOptions {
  readonly profileDir?: string;
  readonly parsers?: readonly string[];
}

/**
 * The script pkexec runs as root: `sh -c <script> codestead-sandbox <root> (<tool id> <executable>)…`. It takes the
 * user from PKEXEC_UID (set by pkexec, not by the caller), checks everything it gets (the folder: a real path in that
 * user's home, every folder from the home to it owned by the user and not writable by others; the tools: Codestead's
 * names only), generates the profile itself, checks it with apparmor_parser and only then installs and loads it.
 * Exit codes 2-6 (pkexec's own are 126 and 127).
 */
export function sandboxInstallScript(o: ScriptOptions = {}): string {
  const dir = o.profileDir ?? profileDir;
  const parsers = o.parsers ?? ["/usr/sbin/apparmor_parser", "/sbin/apparmor_parser"];
  for (const p of [dir, ...parsers]) if (!isProfilePath(p)) throw new Error(`Not a plain path: ${p}`);
  return `set -eu
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH
umask 022
fail() { echo "codestead-sandbox: $2" >&2; exit "$1"; }
uid=\${PKEXEC_UID:-}
case $uid in '' | *[!0-9]*) fail 2 "PKEXEC_UID is not set: start this with pkexec." ;; esac
[ $# -ge 3 ] && [ $(( ($# - 1) % 2 )) -eq 0 ] || fail 2 "usage: <data folder> (<tool id> <executable>)..."
root=$1
shift
case $root in /*) ;; *) fail 3 "not an absolute path: $root" ;; esac
case $root in *[!A-Za-z0-9._/-]* | */ | *//* | */./* | */../* | */. | */..) fail 3 "not a plain path: $root" ;; esac
[ "$(readlink -f -- "$root")" = "$root" ] || fail 3 "$root is not the folder's real path"
home=$(getent passwd "$uid" | cut -d: -f6)
[ -n "$home" ] || fail 3 "user $uid has no home folder"
home=$(readlink -f -- "$home")
case $root in "$home"/*) ;; *) fail 3 "$root is not in the home folder $home" ;; esac
d=$root
while :; do
  [ -d "$d" ] || fail 3 "$d is not a folder"
  [ "$(stat -c %u -- "$d")" = "$uid" ] || fail 3 "$d does not belong to user $uid"
  case $(stat -c %a -- "$d") in *[2367]) fail 3 "other users can write in $d" ;; esac
  [ "$d" != "$home" ] || break
  d=\${d%/*}
done
attach=
n=0
while [ $# -gt 0 ]; do
  id=$1
  exe=$2
  shift 2
  case $id in codestead-?*) ;; *) fail 2 "not a Codestead tool: $id" ;; esac
  case $id in *[!a-z0-9-]*) fail 2 "not a Codestead tool: $id" ;; esac
  case $exe in Codestead.?*) ;; *) fail 2 "not a Codestead executable: $exe" ;; esac
  case \${exe#Codestead.} in *[!A-Za-z0-9]*) fail 2 "not a Codestead executable: $exe" ;; esac
  attach="$attach\${attach:+,}$id/[0-9]*/$exe.bin"
  n=$((n + 1))
done
if [ "$n" -gt 1 ]; then attach="{$attach}"; fi
parser=
for p in ${parsers.join(" ")}; do
  if [ -x "$p" ]; then parser=$p; break; fi
done
[ -n "$parser" ] || fail 4 "apparmor_parser is not installed."
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
cat > "$tmp" <<EOF
${profileTemplate}EOF
out=$("$parser" --skip-kernel-load --skip-cache --quiet "$tmp" 2>&1) || fail 5 "AppArmor does not accept the profile (AppArmor 4 is needed): $out"
file=${dir}/codestead-user-$uid
install -m 0644 "$tmp" "$file"
"$parser" --replace --write-cache --skip-read-cache "$file" || { rm -f "$file"; fail 6 "the profile could not be loaded."; }
echo "codestead-sandbox: $file"
`;
}

/** The arguments of the script after its name: the folder, then each tool's id and executable. */
export function scriptArgs(root: string, tools: readonly SandboxTool[]): string[] {
  return [root, ...tools.flatMap((t) => [t.id, t.exe])];
}

/** The path with symbolic links resolved, also when its last folders do not exist yet. */
function resolvePath(env: SandboxEnvironment, path: string): string | null {
  const real = env.realpath(path);
  if (real !== null) return real;
  const parent = posix.dirname(path);
  if (parent === path) return null;
  const resolved = resolvePath(env, parent);
  return resolved === null ? null : posix.join(resolved, posix.basename(path));
}

/** The AppArmor label this process runs under ("codestead-hub (unconfined)"), or null. */
function ownLabel(env: SandboxEnvironment): string | null {
  return env.readFile("/proc/self/attr/apparmor/current") ?? env.readFile("/proc/self/attr/current");
}

/** Whether the sandbox works for the tools in `dataRoot`, and whether the hub can turn it on. */
export function sandboxStatus(env: SandboxEnvironment, dataRoot: string, tools: readonly SandboxTool[] = sandboxTools()): SandboxStatus {
  if (env.platform !== "linux" || env.uid <= 0) return { state: "not-needed" };
  if (env.readFile(restrictionSysctl)?.trim() !== "1") return { state: "not-needed" };
  if (ownLabel(env)?.startsWith("codestead-")) return { state: "inherited" };
  const profile = posix.join(profileDir, userProfileName(env.uid));
  const root = resolvePath(env, dataRoot);
  const home = env.realpath(env.home);
  if (root === null || home === null || !isProfilePath(root) || !root.startsWith(home + "/") || tools.length === 0 || !tools.every(isSandboxTool)) {
    return { state: "unavailable" };
  }
  if (env.readFile(profile) === userProfileText(env.uid, root, tools)) return { state: "on", profile };
  const ready = env.findTool("pkexec") !== null && env.findTool("apparmor_parser") !== null && env.exists(posix.join(profileDir, "abi", "4.0"));
  return ready ? { state: "off", profile } : { state: "unavailable" };
}

/** Why turning the sandbox on did not work (the message says it to the user, in English). */
export class SandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxError";
  }
}

function tail(text: string, lines = 4): string {
  return text.trim().split(/\r?\n/).slice(-lines).join("\n");
}

/** How the pkexec command ended, as an error for the user, or null when it worked. */
export function enableFailure(result: CommandResult): SandboxError | null {
  if (result.code === 0) return null;
  if (result.missing) return new SandboxError("pkexec could not be started.");
  // pkexec: 126 – the password dialog was dismissed; 127 – not authorized, or no authentication agent to ask.
  if (result.code === 126) return new SandboxError("The password dialog was closed, so nothing was changed.");
  if (result.code === 127) {
    if (/no authentication agent/i.test(result.stderr)) return new SandboxError("No program is running that can ask for your password (a polkit authentication agent), so nothing was changed.");
    return new SandboxError(`It was not allowed${tail(result.stderr) ? `: ${tail(result.stderr)}` : "."}`);
  }
  const output = tail(result.stderr) || tail(result.stdout);
  const how = result.code === null ? "did not finish" : `ended with code ${result.code}`;
  return new SandboxError(`Installing the AppArmor profile ${how}${output ? `: ${output}` : "."}`);
}

/** Options of {@link enableSandbox}. */
export interface EnableOptions {
  readonly env?: SandboxEnvironment;
  readonly run?: RunCommand;
  readonly tools?: readonly SandboxTool[];
  /** Makes the data folder (and tools/ in it) when it does not exist yet: the script checks the real folders. */
  readonly makeFolder?: (path: string) => void;
}

/**
 * Installs and loads this user's profile through pkexec (the system asks for an administrator's password), then returns
 * the new status (`on` when it worked). Throws a {@link SandboxError} when it did not.
 */
export async function enableSandbox(dataRoot: string, o: EnableOptions = {}): Promise<SandboxStatus> {
  const env = o.env ?? processSandboxEnvironment();
  const tools = o.tools ?? sandboxTools();
  const before = sandboxStatus(env, dataRoot, tools);
  if (before.state !== "off") {
    if (before.state === "on") return before;
    throw new SandboxError(`Chromium's sandbox cannot be turned on here (${before.state}).`);
  }
  o.makeFolder?.(posix.join(dataRoot, "tools"));
  const root = env.realpath(dataRoot);
  const pkexec = env.findTool("pkexec");
  if (root === null || pkexec === null) throw new SandboxError(`${dataRoot} or pkexec is missing.`);
  // No time limit: the user may take a while to type the password.
  const result = await (o.run ?? runCommand)(pkexec, ["/bin/sh", "-c", sandboxInstallScript(), "codestead-sandbox", ...scriptArgs(root, tools)]);
  const failure = enableFailure(result);
  if (failure !== null) throw failure;
  const after = sandboxStatus(env, dataRoot, tools);
  if (after.state !== "on") throw new SandboxError(`The AppArmor profile was installed, but ${after.profile ?? "it"} is not as expected.`);
  return after;
}
