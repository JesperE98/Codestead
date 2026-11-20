// Port of Checks.cs – the helpers the chapters' task checks and solutions use: the student's world, cached regexes,
// file and command checks. (In C# they are private members of the partial class ChaptersLib; here they are the
// exports of this module, used by the chapter files in Chapters/ and not re-exported by the package.)

import { ExtrarepoLib, type FsNode, FsError, type World } from "@codestead/linux-shell";
import { ArchiveCmd, CronCmd, SshCmd, TextCmd } from "./ShellCommands.js";
import type { CheckContext } from "./Types/CheckContext.js";
import type { PerDistro } from "./Types/PerDistro.js";

/** The file that `add-apt-repository ppa:lunatool/moonphase` creates. (Computed on use.) */
export function ppaFile(): string {
  return ExtrarepoLib.ppaSourcesPath(ExtrarepoLib.parsePpa("ppa:lunatool/moonphase")!);
}

// ---------- The student's world ----------
// Names of the exercise files, the user and so on depend on the language (see Shell/World.cs). Texts,
// solutions and checks write them as {{placeholders}}: "~/{{documents}}/{{fruits}}".

export function w(c: CheckContext): World {
  return c.sh.world;
}

/** The student's home directory, e.g. /home/student. */
export function home(c: CheckContext): string {
  return c.sh.world.home;
}

/** The practice project in the git chapter. */
export function web(c: CheckContext): string {
  return `${home(c)}/${c.sh.world.get("webProject")}`;
}

/** A text with the world's placeholders filled in. */
export function x(c: CheckContext, text: string): string {
  return c.sh.world.expand(text);
}

// ---------- Regexes ----------
// The checks use many one-off regexes; they are compiled once and cached here. The patterns come from the
// TypeScript original, so they are plain JavaScript regexes (C#: RegexOptions.ECMAScript, or IgnoreCase with "i").

const regexCache = new Map<string, RegExp>();
const placeholderRe = /\{\{([A-Za-z0-9_]+)\}\}/g;

function cached(pattern: string, flags: string): RegExp {
  const key = `${flags}/${pattern}`;
  let r = regexCache.get(key);
  if (r === undefined) regexCache.set(key, (r = new RegExp(pattern, flags)));
  return r;
}

/** Regex.Escape: the text as a literal in a pattern (the characters that are special in a JavaScript regex). */
function escape(text: string): string {
  return text.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

/** A cached regex. With a {@link CheckContext} first, the world's {{placeholders}} are filled in (as literal text). */
export function re(pattern: string, flags?: string): RegExp;
export function re(c: CheckContext, pattern: string, flags?: string): RegExp;
export function re(a: string | CheckContext, b?: string, f?: string): RegExp {
  if (typeof a === "string") return cached(a, b ?? "");
  const c = a;
  const pattern = b!.replace(placeholderRe, (m, key: string) =>
    c.sh.world.names.has(key) || c.sh.world.words.has(key) ? escape(c.sh.world.get(key)) : m,
  );
  return cached(pattern, f ?? "");
}

// ---------- Helpers for the checks ----------

/** The path without "~" and {{placeholders}}. */
export function abs(c: CheckContext, p: string): string {
  p = x(c, p);
  return p.startsWith("~") ? home(c) + p.slice(1) : p;
}

/** A file by path; "~" and {{placeholders}} are filled in. */
export function node(c: CheckContext, p: string): FsNode | null {
  return c.sh.vfs.tryLookup(abs(c, p), c.sh.rootUser());
}

export function isFile(c: CheckContext, p: string): boolean {
  return node(c, p)?.type === "file";
}

export function isDir(c: CheckContext, p: string): boolean {
  return node(c, p)?.type === "dir";
}

export function exists(c: CheckContext, p: string): boolean {
  return node(c, p) !== null;
}

export function content(c: CheckContext, p: string): string {
  return node(c, p)?.content ?? "";
}

/** The line matches and the command succeeded. */
export function ran(c: CheckContext, r: RegExp): boolean {
  return c.exitCode === 0 && r.test(c.line);
}

/** The non-empty lines of a text, in the order `sort` prints them in this terminal. */
export function sortedLines(c: CheckContext, text: string): string[] {
  return TextCmd.sortLines(
    c.sh,
    text.split("\n").filter((l) => l.trim() !== ""),
  );
}

export function outLines(c: CheckContext): string[] {
  return c.output.split("\n").filter((l) => l.trim() !== "");
}

/** The line without a leading "sudo". */
export function unsudo(line: string): string {
  return line.replace(re("^sudo\\s+(-\\S+\\s+)*"), "");
}

export function mode(c: CheckContext, p: string): number {
  return node(c, p)?.mode ?? 0;
}

export function flag(c: CheckContext, name: string): boolean {
  return c.sh.flags.get(name) === true;
}

export function installed(c: CheckContext, pkg: string): boolean {
  return c.sh.installed.has(pkg);
}

/** A shell variable, exported or not; the name may be a {{placeholder}}. */
export function env(c: CheckContext, name: string): string | null {
  return c.sh.env.get(x(c, name)) ?? null;
}

/** An environment variable (exported with export or fish's set -x); null when it is unset or only a shell variable. */
export function exported(c: CheckContext, name: string): string | null {
  return c.sh.envVar(x(c, name));
}

/** A path itself, also when it is a symbolic link (like lstat); "~" and {{placeholders}} are filled in. */
export function linkNode(c: CheckContext, p: string): FsNode | null {
  return c.sh.vfs.tryLookupLink(abs(c, p), c.sh.rootUser());
}

/** The real path (symbolic links followed), or null. */
export function realPath(c: CheckContext, p: string): string | null {
  try {
    return c.sh.vfs.realPath(abs(c, p), c.sh.rootUser());
  } catch (e) {
    if (e instanceof FsError) return null;
    throw e;
  }
}

/** A file on the server (server.lan), with "~" meaning the home directory there. */
export function serverNode(c: CheckContext, p: string): FsNode | null {
  const server = SshCmd.serverFor(c.sh);
  p = x(c, p);
  return server.vfs.tryLookup(p.startsWith("~") ? server.world.home + p.slice(1) : p, server.rootUser());
}

/** The jobs in the student's crontab. */
export function cronJobs(c: CheckContext): CronCmd.Job[] {
  const n = c.sh.vfs.tryLookup(`${CronCmd.spoolDir(c.sh)}/${w(c).user}`, c.sh.rootUser());
  return n?.type === "file" ? CronCmd.parse(n.content ?? "", w(c).user).jobs : [];
}

export function every(set: ReadonlySet<number>, min: number, max: number): boolean {
  for (let i = min; i <= max; i++) if (!set.has(i)) return false;
  return true;
}

/** HashSet.SetEquals: the set holds exactly these values. */
export function setEquals(set: ReadonlySet<number>, values: readonly number[]): boolean {
  const other = new Set(values);
  return set.size === other.size && [...set].every((v) => other.has(v));
}

/** The file names rsync -v listed (between "sending incremental file list" and the empty line). */
export function rsyncFiles(c: CheckContext): string[] {
  const lines = c.output.split("\n");
  let i = lines.findIndex((l) => l.startsWith("sending incremental file list"));
  if (i < 0) return [];
  const files: string[] = [];
  for (i++; i < lines.length && lines[i]!.trim() !== ""; i++) {
    const l = lines[i]!;
    if (!l.endsWith("/") && !l.startsWith("created directory")) files.push(l);
  }
  return files;
}

export function byFamily<T>(debian: T, arch: T, redhat: T): PerDistro<T> {
  return (d) => {
    switch (d.family) {
      case "debian":
        return debian;
      case "arch":
        return arch;
      case "redhat":
        return redhat;
      default:
        return undefined as T;
    }
  };
}

/** Solution commands. They may contain the world's {{placeholders}} (see {@link ChapterTask.solutionFor}). */
export function cmds(...lines: string[]): string[] {
  return lines;
}

/** True if the file is an archive (tar, tar.gz or zip) of the right kind containing a file whose path ends with `suffix`. */
export function archiveHas(c: CheckContext, p: string, format: string, suffix: string): boolean {
  const a = ArchiveCmd.readArchive(content(c, p));
  suffix = x(c, suffix);
  return a?.format === format && a.entries.some((e) => e.path === suffix || e.path.endsWith("/" + suffix));
}

const tarLongOps = new Map<string, string>([
  ["--create", "c"],
  ["--extract", "x"],
  ["--get", "x"],
  ["--list", "t"],
]);

/** Which tar operations (c, x, t) the command line contains, e.g. "x" for `cd ~ && tar -xzf a.tgz`. */
export function tarOps(line: string): string {
  return line
    .split(re("&&|\\|\\||[;|]"))
    .map((part) => unsudo(part.trim()).split(re("\\s+")))
    .filter((words) => words[0] === "tar")
    .flatMap((words) =>
      words.slice(1).map((wd, i) => {
        if (wd.startsWith("--")) return tarLongOps.get(wd) ?? "";
        return wd.startsWith("-") || i === 0 ? wd.replace(re("[^cxt]", "g"), "") : "";
      }),
    )
    .join("");
}

/** List.At(i) (Js.At): the item, from the end when negative, or null when there is none. */
export function at<T>(list: readonly T[], i: number): T | null {
  return list.at(i) ?? null;
}

/** list[i] in C#: throws when the index is out of range (a check that throws counts as "not done"). */
export function item<T>(list: readonly T[], i: number): T {
  if (i < 0 || i >= list.length) throw new RangeError("Index was out of range.");
  return list[i]!;
}

/** Enumerable.SequenceEqual: the same items in the same order. */
export function sequenceEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
