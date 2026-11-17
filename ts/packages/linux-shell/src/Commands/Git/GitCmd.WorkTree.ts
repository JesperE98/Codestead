// Port of Commands/Git/GitCmd.WorkTree.cs – the work tree: .gitignore, scanning and writing files, switching trees
// and pathspecs.

import { NetRegex } from "../../Js.js";
import { FsError } from "../../Vfs/FsError.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import { gpath, join, needWork, pruneDirs, readText, relPath, removeFile, writeText, type Repo } from "./GitCmd.Files.js";
import { readIndex, writeIndex, type Index, type Unmerged } from "./GitCmd.Index.js";
import { JsMap, NetS, sortedOrdinal, union } from "./GitCmd.Json.js";
import { readBlob } from "./GitCmd.Objects.js";
import { blobHash, fail, fatal } from "./GitCmd.js";

interface IgnoreRule {
  base: string;
  re: RegExp;
  neg: boolean;
  dirOnly: boolean;
  anchored: boolean;
}

const globEscapeRe = /[.+^${}()|\]\\/]/g;
const asciiLetterOrDigitRe = /^[A-Za-z0-9]$/;
const netWordCharRe = new RegExp(`^${NetRegex.w}$`, "u");

/** A regex that never matches (C# new Regex("(?!)")). */
const never = /(?!)/;

/**
 * Translates a glob to a regular expression source with .NET's meaning, which the C# kept close to the
 * TypeScript: . is [^\n], an escaped ASCII letter or digit is the character itself, an escaped other word
 * character is an error in .NET (the rule then never matches), and inside [...] a leading ] is literal.
 * Throws SyntaxError where .NET would throw.
 */
function globToRegex(glob: string, slashStar: boolean): string {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]!;
    if (ch === "*") {
      if ((glob[i + 1] ?? "") === "*") {
        i++;
        if ((glob[i + 1] ?? "") === "/") {
          i++;
          re += "(?:[^\\n]*/)?";
        } else re += "[^\\n]*";
      } else re += slashStar ? "[^\\n]*" : "[^/]*";
    } else if (ch === "?") re += "[^/]";
    else if (ch === "[") {
      const end = i + 2 <= glob.length ? glob.indexOf("]", i + 2) : -1;
      if (end < 0) re += "\\[";
      else {
        let cls = glob.slice(i + 1, end);
        if (cls.startsWith("!")) cls = "^" + cls.slice(1);
        // .NET reads a leading ] as a literal (JavaScript would see an empty class) and "-[" as subtraction.
        re += "[" + cls.replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]") + "]";
        i = end;
      }
    } else if (ch === "\\" && i + 1 < glob.length) {
      const n = glob[++i]!;
      if (asciiLetterOrDigitRe.test(n)) re += n;
      else if (netWordCharRe.test(n)) throw new SyntaxError(`Unrecognized escape sequence \\${n}`);
      else re += "\\" + n;
    } else re += ch.replace(globEscapeRe, "\\$&");
  }
  return re;
}

/** new RegExp(source), or a regex that never matches if the pattern is invalid. */
function regexOrNever(source: string): RegExp {
  try {
    return new RegExp(source);
  } catch (e) {
    if (!(e instanceof SyntaxError)) throw e;
    return never;
  }
}

const trailingWsRe = new RegExp(`(?<!\\\\)[${NetS}]+$`);

function parseIgnore(text: string, base: string): IgnoreRule[] {
  const rules: IgnoreRule[] = [];
  for (const raw of text.split("\n")) {
    let line = raw.replace(trailingWsRe, "");
    if (line === "" || line.startsWith("#")) continue;
    let neg = false;
    if (line.startsWith("!")) {
      neg = true;
      line = line.slice(1);
    } else if (line.startsWith("\\!") || line.startsWith("\\#")) line = line.slice(1);
    let dirOnly = false;
    if (line.endsWith("/")) {
      dirOnly = true;
      line = line.replace(/\/+$/, "");
    }
    if (line === "") continue;
    const anchored = line.includes("/");
    if (line.startsWith("/")) line = line.slice(1);
    let re: RegExp;
    try {
      re = regexOrNever(`^${globToRegex(line, false)}$`);
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
      re = never;
    }
    rules.push({ base, re, neg, dirOnly, anchored });
  }
  return rules;
}

export class Ignores {
  constructor(private readonly rules: IgnoreRule[]) {}

  private match(path: string, isDir: boolean): boolean {
    let result = false;
    for (const rule of this.rules) {
      if (rule.dirOnly && !isDir) continue;
      if (rule.base !== "" && !path.startsWith(rule.base + "/")) continue;
      const rel = rule.base !== "" ? path.slice(rule.base.length + 1) : path;
      const subject = rule.anchored ? rel : rel.slice(rel.lastIndexOf("/") + 1);
      if (rule.re.test(subject)) result = !rule.neg;
    }
    return result;
  }

  ignored(path: string, isDir = false): boolean {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) if (this.match(parts.slice(0, i).join("/"), true)) return true;
    return this.match(path, isDir);
  }
}

export interface WorkFile {
  content: string;
  ignored: boolean;
  hash: string;
}

export class Work {
  files = new Map<string, WorkFile>();

  constructor(readonly ignores: Ignores) {}

  get(p: string): WorkFile | null {
    return this.files.get(p) ?? null;
  }
}

/** Reads every file in the work tree (except .git) and the rules in .gitignore. */
export function scanWork(r: Repo): Work {
  const root = needWork(r);
  const g = r.g;
  const found: { path: string; content: string }[] = [];
  const ignoreFiles: { rel: string; text: string }[] = [];
  const walk = (node: FsNode, rel: string): void => {
    if (!VfsLib.hasPerm(node, g.user, "r") || !VfsLib.hasPerm(node, g.user, "x")) return;
    if (!node.children) return;
    for (const name of sortedOrdinal(node.children.keys())) {
      if (name === ".git") continue;
      const child = node.children.get(name)!;
      const p = rel !== "" ? `${rel}/${name}` : name;
      if (child.type === "dir") walk(child, p);
      else if (VfsLib.hasPerm(child, g.user, "r")) {
        found.push({ path: p, content: child.content ?? "" });
        if (name === ".gitignore") ignoreFiles.push({ rel, text: child.content ?? "" });
      }
    }
  };
  walk(g.sh.vfs.lookup(root, g.user), "");
  ignoreFiles.sort((a, b) => (a.rel !== "" ? a.rel.split("/").length : 0) - (b.rel !== "" ? b.rel.split("/").length : 0));
  const rules = parseIgnore(readText(g, gpath(r, "info/exclude")) ?? "", "");
  for (const { rel, text } of ignoreFiles) rules.push(...parseIgnore(text, rel));
  const ignores = new Ignores(rules);
  const work = new Work(ignores);
  for (const { path, content } of found) {
    const hash = blobHash(content);
    r.blobs.set(hash, content);
    work.files.set(path, { content, hash, ignored: ignores.ignored(path) });
  }
  return work;
}

export function writeWorkFile(r: Repo, path: string, content: string): void {
  const abs = join(needWork(r), path);
  const node = r.g.sh.vfs.tryLookup(abs, r.g.user);
  if (node?.type === "dir") throw new FsError("EISDIR");
  writeText(r.g, abs, content);
}

export function removeWorkFile(r: Repo, path: string): void {
  const root = needWork(r);
  const abs = join(root, path);
  removeFile(r.g, abs);
  pruneDirs(r.g, VfsLib.dirname(abs), root);
}

export interface Spec {
  raw: string;
  rel: string;
  glob: RegExp | null;
}

const globCharsRe = /[*?[]/;

export function toSpec(r: Repo, raw: string): Spec {
  const root = needWork(r);
  const abs = VfsLib.resolvePath(r.g.cwd, raw === "" ? "." : raw);
  let rel: string;
  if (abs === root) rel = "";
  else if (abs.startsWith(root + "/")) rel = abs.slice(root.length + 1);
  else throw fatal(`${raw}: '${raw}' is outside repository at '${root}'`);
  let glob: RegExp | null = null;
  if (globCharsRe.test(rel)) {
    try {
      glob = regexOrNever(`^${globToRegex(rel, true)}(/[^\\n]*)?$`);
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
      glob = never;
    }
  }
  return { raw, rel, glob };
}

export function specMatch(s: Spec, path: string): boolean {
  return s.rel === "" || path === s.rel || path.startsWith(s.rel + "/") || (s.glob?.test(path) ?? false);
}

/** How the path in the repository is shown, relative to the current directory. */
export function show(r: Repo, path: string): string {
  const root = needWork(r);
  const dir = path.endsWith("/");
  const p = relPath(r.g.cwd, join(root, dir ? path.slice(0, -1) : path));
  return dir ? p + "/" : p;
}

/**
 * Makes the work tree and the index equal to the tree `target` (from the HEAD tree `from`).
 * Local changes in files that are not affected are carried along. If a change would be
 * overwritten, everything is aborted with the same error as real git.
 */
export function switchTree(r: Repo, from: JsMap<string>, target: JsMap<string>, verb: string, force = false, alsoCheck: string[] | null = null): Index {
  alsoCheck ??= [];
  const work = scanWork(r);
  const idx = readIndex(r);
  const paths = sortedOrdinal(union(from.keys, target.keys).filter((p) => from.get(p) !== target.get(p)));
  const local: string[] = [];
  const untracked: string[] = [];
  if (!force) {
    for (const p of sortedOrdinal(union(paths, alsoCheck))) {
      const w = work.get(p);
      if (idx.entries.has(p) || from.has(p)) {
        const indexDirty = idx.entries.get(p) !== from.get(p) || idx.unmerged.has(p);
        const workDirty = w !== null ? w.hash !== idx.entries.get(p) : idx.entries.has(p);
        const alreadyTarget = idx.entries.get(p) === target.get(p) && (w !== null ? w.hash === target.get(p) : target.get(p) === null);
        if ((indexDirty || workDirty) && !alreadyTarget) local.push(p);
      } else if (w !== null && !w.ignored && w.hash !== target.get(p)) untracked.push(p);
    }
  }
  if (local.length > 0) {
    const what = verb === "checkout" ? "switch branches" : "merge";
    throw fail(
      `error: Your local changes to the following files would be overwritten by ${verb}:\n${local.map((p) => `\t${show(r, p)}\n`).join("")}Please commit your changes or stash them before you ${what}.\nAborting`,
    );
  }
  if (untracked.length > 0) {
    throw fail(
      `error: The following untracked working tree files would be overwritten by ${verb}:\n${untracked.map((p) => `\t${show(r, p)}\n`).join("")}Please move or remove them before you ${verb === "checkout" ? "switch branches" : "merge"}.\nAborting`,
    );
  }
  for (const p of paths) {
    const t = target.get(p);
    if (t === null) {
      removeWorkFile(r, p);
      idx.entries.delete(p);
    } else {
      writeWorkFile(r, p, readBlob(r, t));
      idx.entries.set(p, t);
    }
    idx.unmerged.delete(p);
  }
  if (force) {
    for (const p of idx.entries.keys) {
      const t = target.get(p);
      if (!target.has(p)) {
        removeWorkFile(r, p);
        idx.entries.delete(p);
      } else if (work.get(p)?.hash !== t || idx.entries.get(p) !== t) {
        writeWorkFile(r, p, readBlob(r, t!));
        idx.entries.set(p, t!);
      }
    }
    for (const p of target.keys) {
      if (!idx.entries.has(p)) {
        writeWorkFile(r, p, readBlob(r, target.get(p)!));
        idx.entries.set(p, target.get(p)!);
      }
    }
    idx.unmerged = new JsMap<Unmerged>();
  }
  writeIndex(r, idx);
  return idx;
}

