// Port of Commands/Git/GitCmd.Files.cs – the file system under the repository and finding/opening the repository
// itself.

import { FsError } from "../../Vfs/FsError.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import type { Commit } from "./GitCmd.Objects.js";
import { fatal, raise, type G } from "./GitCmd.js";

export function join(a: string, b: string): string {
  return b === "" ? a : a === "/" ? `/${b}` : `${a}/${b}`;
}

export function readText(g: G, path: string): string | null {
  try {
    const node = g.sh.vfs.lookup(path, g.user);
    if (node.type !== "file") return null;
    return g.sh.vfs.readFile(path, g.user);
  } catch (e) {
    if (e instanceof FsError && (e.code === "ENOENT" || e.code === "ENOTDIR")) return null;
    throw e;
  }
}

export function mkdirp(g: G, path: string): void {
  let cur = "";
  for (const seg of VfsLib.normalizePath(path)
    .split("/")
    .filter((s) => s !== "")) {
    cur += "/" + seg;
    const node = g.sh.vfs.tryLookup(cur, g.user);
    if (node === null) g.sh.vfs.mkdir(cur, g.user);
    else if (node.type !== "dir") throw new FsError("ENOTDIR");
  }
}

export function writeText(g: G, path: string, content: string): void {
  mkdirp(g, VfsLib.dirname(path));
  g.sh.vfs.writeFile(path, content, g.user);
}

export function removeFile(g: G, path: string): void {
  if (g.sh.vfs.tryLookup(path, g.user) !== null) g.sh.vfs.remove(path, g.user);
}

/** Removes empty directories upwards from `dir` (but never `stop`). */
export function pruneDirs(g: G, dir: string, stop: string): void {
  while (dir !== stop && dir.startsWith(stop + "/")) {
    const node = g.sh.vfs.tryLookup(dir, g.user);
    if (node === null || node.type !== "dir" || (node.children?.size ?? 0) > 0) return;
    g.sh.vfs.remove(dir, g.user);
    dir = VfsLib.dirname(dir);
  }
}

export function isDirAt(g: G, p: string): boolean {
  return g.sh.vfs.tryLookup(p, g.user)?.type === "dir";
}

export function existsAt(g: G, p: string): boolean {
  return g.sh.vfs.tryLookup(p, g.user) !== null;
}

/** Path from the directory `from` to `to` (both absolute). */
export function relPath(from: string, to: string): string {
  const a = from.split("/").filter((s) => s !== "");
  const b = to.split("/").filter((s) => s !== "");
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const parts = [...a.slice(i).map(() => ".."), ...b.slice(i)];
  const s = parts.join("/");
  return s !== "" ? s : ".";
}

export interface Repo {
  g: G;
  gitDir: string;
  /** The work tree, or null for a "bare" repository (only the history, as on a server). */
  root: string | null;
  /** Content of blobs that only exist in the work tree (not saved as objects). */
  blobs: Map<string, string>;
  commitCache: Map<string, Commit>;
}

export function looksLikeGitDir(g: G, dir: string): boolean {
  return readText(g, `${dir}/HEAD`) !== null && isDirAt(g, `${dir}/objects`) && isDirAt(g, `${dir}/refs`);
}

export function openRepo(g: G, gitDir: string, root: string | null): Repo {
  return { g, gitDir, root, blobs: new Map(), commitCache: new Map() };
}

export function discover(g: G, start: string): Repo | null {
  let dir = VfsLib.normalizePath(start);
  for (;;) {
    if (isDirAt(g, join(dir, ".git")) && looksLikeGitDir(g, join(dir, ".git"))) return openRepo(g, join(dir, ".git"), dir);
    if (looksLikeGitDir(g, dir)) return openRepo(g, dir, null);
    if (dir === "/") return null;
    dir = VfsLib.dirname(dir);
  }
}

export function needRepo(g: G): Repo {
  return discover(g, g.cwd) ?? raise(fatal("not a git repository (or any of the parent directories): .git"));
}

export function needWork(r: Repo): string {
  return r.root ?? raise(fatal("this operation must be run in a work tree"));
}

export function gpath(r: Repo, rel: string): string {
  return `${r.gitDir}/${rel}`;
}
