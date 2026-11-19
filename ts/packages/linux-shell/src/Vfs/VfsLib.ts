// Port of Vfs/VfsLib.cs (src/shell/vfs.ts) – a small in-memory file system with owners and permissions (rwx).
// Everything is plain data so it can be saved as JSON.

import { Js, type Obj } from "../Js.js";
import type { FsNode } from "./FsNode.js";
import type { User } from "./User.js";

/** The content of a simulated binary starts with this. */
export const Elf = "\u007fELF";

export function makeDir(owner = "root", mode = -1, children: Obj<FsNode> | null = null, group: string | null = null): FsNode {
  return {
    type: "dir",
    mode: mode < 0 ? Js.oct(755) : mode,
    owner,
    group: group ?? owner,
    mtime: Js.now(),
    children: children ?? Js.obj<FsNode>(),
  };
}

export function makeFile(content = "", owner = "root", mode = -1, group: string | null = null): FsNode {
  return {
    type: "file",
    mode: mode < 0 ? Js.oct(644) : mode,
    owner,
    group: group ?? owner,
    mtime: Js.now(),
    content,
  };
}

export function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const seg of path.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (parts.length > 0) parts.pop();
    } else parts.push(seg);
  }
  return "/" + parts.join("/");
}

export function resolvePath(cwd: string, path: string): string {
  return normalizePath(path.startsWith("/") ? path : `${cwd}/${path}`);
}

export function dirname(path: string): string {
  const norm = normalizePath(path);
  const idx = norm.lastIndexOf("/");
  return idx <= 0 ? "/" : norm.slice(0, idx);
}

export function basename(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  if (trimmed === "") return "/";
  return trimmed.slice(trimmed.lastIndexOf("/") + 1);
}

/**
 * Simulated archives (tar, gzip, zip – see Commands/Archive/) start with a marker followed
 * by their pretend size: MARKER NUL size NUL content.
 */
const sizedBlob = /^(?:\u0000SIMTAR1|\u001f\u008b\u0008SIMGZ1|PK\u0003\u0004SIMZIP1)\u0000(\d+)\u0000/;

/** A symbolic link to target (its permissions are always rwxrwxrwx). */
export function makeLink(target: string, owner = "root", group: string | null = null): FsNode {
  return {
    type: "link",
    mode: Js.oct(777),
    owner,
    group: group ?? owner,
    mtime: Js.now(),
    content: target,
  };
}

export function nodeSize(node: FsNode): number {
  if (node.type === "dir") return 4096;
  if (node.size !== null && node.size !== undefined) return node.size;
  const content = node.content ?? "";
  const sized = sizedBlob.exec(content);
  if (sized) return Number(sized[1]);
  return Js.utf8Length(content);
}

/** perm is 'r', 'w' or 'x'. */
export function hasPerm(node: FsNode, user: User, perm: "r" | "w" | "x"): boolean {
  if (user.uid === 0) {
    // root may do anything, except run files that have no x bit at all.
    if (perm !== "x" || node.type === "dir") return true;
    return (node.mode & Js.oct(111)) !== 0;
  }
  const bit = perm === "r" ? 4 : perm === "w" ? 2 : 1;
  let shift = 0;
  if (node.owner === user.name) shift = 6;
  else if (user.groups.includes(node.group)) shift = 3;
  return ((node.mode >> shift) & bit) !== 0;
}

/** A copy of a node and everything in it. A copy is a new file: it has no inode number or hard links yet. */
export function cloneNode(node: FsNode): FsNode {
  const copy = Js.clone(node);
  const fresh = (n: FsNode): void => {
    n.ino = null;
    n.nlink = null;
    for (const c of n.children?.values() ?? []) fresh(c);
  };
  fresh(copy);
  return copy;
}
