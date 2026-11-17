// Port of Vfs/VFS.cs – virtual file system: the tree with lookups, reads, writes, umask and hard links.

import { Js } from "../Js.js";
import { FsError } from "./FsError.js";
import type { FsNode } from "./FsNode.js";
import type { User } from "./User.js";
import * as VfsLib from "./VfsLib.js";

/** Depth of symbolic links followed by writeFile (C# [ThreadStatic]; JavaScript has one thread). */
let writeHops = 0;

export class VFS {
  root: FsNode;

  constructor(root: FsNode) {
    this.root = root;
  }

  /** How many symbolic links a lookup follows before it gives up (ELOOP), as in Linux. */
  static readonly maxSymlinks = 40;

  /**
   * Walks to a node and checks search permission (x) on every directory on the way. Symbolic links on
   * the way are followed; the last one too, unless follow is false (like lstat).
   */
  lookup(path: string, user: User, follow = true): FsNode {
    return this.walk(VfsLib.normalizePath(path), user, follow, 0).node;
  }

  /** The path without symbolic links (what `realpath` and `pwd -P` print). */
  realPath(path: string, user: User): string {
    return this.walk(VfsLib.normalizePath(path), user, true, 0).path;
  }

  private walk(norm: string, user: User, follow: boolean, hops: number): { node: FsNode; path: string } {
    const segs = norm.split("/").filter((s) => s !== "");
    let node = this.root;
    let cur = "/";
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i]!;
      if (node.type !== "dir" || !node.children) throw new FsError("ENOTDIR");
      if (!VfsLib.hasPerm(node, user, "x")) throw new FsError("EACCES");
      const next = node.children.get(seg);
      if (!next) throw new FsError("ENOENT");
      if (next.type === "link" && (follow || i < segs.length - 1)) {
        if (hops >= VFS.maxSymlinks) throw new FsError("ELOOP");
        const target = VfsLib.resolvePath(cur, next.content ?? "");
        const rest = segs.slice(i + 1).join("/");
        return this.walk(VfsLib.normalizePath(rest === "" ? target : `${target}/${rest}`), user, follow, hops + 1);
      }
      node = next;
      cur = cur === "/" ? `/${seg}` : `${cur}/${seg}`;
    }
    return { node, path: cur };
  }

  /** The node itself, also when it is a symbolic link (like lstat). */
  tryLookupLink(path: string, user: User): FsNode | null {
    try {
      return this.lookup(path, user, false);
    } catch (e) {
      if (e instanceof FsError) return null;
      throw e;
    }
  }

  tryLookup(path: string, user: User): FsNode | null {
    try {
      return this.lookup(path, user);
    } catch (e) {
      if (e instanceof FsError) return null;
      throw e;
    }
  }

  /** The parent directory and the file name for a path. */
  parent(path: string, user: User): { dir: FsNode; name: string } {
    const norm = VfsLib.normalizePath(path);
    if (norm === "/") throw new FsError("EEXIST");
    const dir = this.lookup(VfsLib.dirname(norm), user);
    if (dir.type !== "dir" || !dir.children) throw new FsError("ENOTDIR");
    return { dir, name: VfsLib.basename(norm) };
  }

  readFile(path: string, user: User): string {
    const norm = VfsLib.normalizePath(path);
    if (norm === "/dev/null") return "";
    const node = this.lookup(norm, user);
    if (node.type === "dir") throw new FsError("EISDIR");
    if (!VfsLib.hasPerm(node, user, "r")) throw new FsError("EACCES");
    return node.content ?? "";
  }

  writeFile(path: string, content: string, user: User, append = false): void {
    const norm = VfsLib.normalizePath(path);
    if (norm === "/dev/null") return;
    const { dir, name } = this.parent(norm, user);
    const existing = dir.children!.get(name);
    if (existing && existing.type === "link") {
      // Writing to a symbolic link writes to the file it points to (and creates it if it is missing).
      if (++writeHops > VFS.maxSymlinks) {
        writeHops--;
        throw new FsError("ELOOP");
      }
      try {
        this.writeFile(VfsLib.resolvePath(this.realPath(VfsLib.dirname(norm), user), existing.content ?? ""), content, user, append);
      } finally {
        writeHops--;
      }
      return;
    }
    if (existing) {
      if (existing.type === "dir") throw new FsError("EISDIR");
      if (!VfsLib.hasPerm(existing, user, "w")) throw new FsError("EACCES");
      existing.content = append ? (existing.content ?? "") + content : content;
      existing.size = null;
      existing.mtime = Js.now();
      return;
    }
    if (!VfsLib.hasPerm(dir, user, "w")) throw new FsError("EACCES");
    dir.children!.set(name, VfsLib.makeFile(content, user.name, this.newFileMode, user.groups[0] ?? null));
    dir.mtime = Js.now();
  }

  mkdir(path: string, user: User): void {
    const { dir, name } = this.parent(path, user);
    if (dir.children!.has(name)) throw new FsError("EEXIST");
    if (!VfsLib.hasPerm(dir, user, "w")) throw new FsError("EACCES");
    dir.children!.set(name, VfsLib.makeDir(user.name, this.newDirMode, null, user.groups[0] ?? null));
    dir.mtime = Js.now();
  }

  /** Inserts a ready node (used by cp and mv). Overwrites files. */
  insert(path: string, node: FsNode, user: User): void {
    const { dir, name } = this.parent(path, user);
    if (!VfsLib.hasPerm(dir, user, "w")) throw new FsError("EACCES");
    const existing = dir.children!.get(name);
    if (existing && existing.type === "dir" && node.type !== "dir") throw new FsError("EISDIR");
    dir.children!.set(name, node);
    dir.mtime = Js.now();
  }

  /**
   * Removes a name (a symbolic link itself, not what it points to). A file with other hard links lives on
   * under its other names. Checking whether directories are empty is up to the caller.
   */
  remove(path: string, user: User): void {
    const { dir, name } = this.parent(path, user);
    const node = dir.children!.get(name);
    if (!node) throw new FsError("ENOENT");
    if (!VfsLib.hasPerm(dir, user, "w")) throw new FsError("EACCES");
    dir.children!.delete(name);
    VFS.unlinked(node);
    dir.mtime = Js.now();
  }

  /** A name of the node (and of everything in it) has gone: count down its hard links. */
  private static unlinked(node: FsNode): void {
    if (node.nlink !== null && node.nlink !== undefined) node.nlink = node.nlink > 2 ? node.nlink - 1 : null;
    for (const c of node.children?.values() ?? []) VFS.unlinked(c);
  }

  // ---------- Permissions for new files (umask) ----------

  /** The umask of the shell: permissions taken away from new files and directories. */
  umask = Js.oct(22);

  /** The mode of a new file: rw-rw-rw- without the umask (644 with the usual 022). */
  get newFileMode(): number {
    return Js.oct(666) & ~this.umask;
  }

  /** The mode of a new directory: rwxrwxrwx without the umask (755 with the usual 022). */
  get newDirMode(): number {
    return Js.oct(777) & ~this.umask;
  }

  // ---------- Hard links and inode numbers ----------

  private nextIno = 0;

  /** The inode number of a node (given the first time it is asked for). */
  inoOf(node: FsNode): number {
    if (node.ino !== null && node.ino !== undefined) return node.ino;
    if (this.nextIno === 0) {
      let max = 0;
      const scan = (n: FsNode): void => {
        if (n.ino !== null && n.ino !== undefined && n.ino > max) max = n.ino;
        for (const c of n.children?.values() ?? []) scan(c);
      };
      scan(this.root);
      this.nextIno = Math.max(max + 1, 1_310_721);
    }
    node.ino = this.nextIno++;
    return node.ino;
  }

  /** The number of hard links, as `ls -l` and `stat` show it. */
  static linkCount(n: FsNode): number {
    if (n.type === "dir") {
      let dirs = 0;
      for (const c of n.children?.values() ?? []) if (c.type === "dir") dirs++;
      return 2 + dirs;
    }
    return n.nlink ?? 1;
  }

  /** Adds a hard link: the same file under one more name. */
  hardLink(node: FsNode, path: string, user: User): void {
    if (node.type === "dir") throw new FsError("EPERM");
    this.inoOf(node);
    this.insert(path, node, user);
    node.nlink = (node.nlink ?? 1) + 1;
  }

  /**
   * A saved terminal has each hard link as a separate copy with the same inode number: make them the same
   * node again, so that a change through one name shows through the others.
   */
  joinHardLinks(): void {
    const first = new Map<number, FsNode>();
    const join = (dir: FsNode): void => {
      if (!dir.children) return;
      for (const [name, child] of [...dir.children]) {
        if (child.nlink !== null && child.nlink !== undefined && child.nlink > 1 && child.ino !== null && child.ino !== undefined) {
          const same = first.get(child.ino);
          if (same) dir.children.set(name, same);
          else first.set(child.ino, child);
        }
        join(child);
      }
    };
    join(this.root);
  }

  listDir(path: string, user: User): string[] {
    const node = this.lookup(path, user);
    if (node.type !== "dir" || !node.children) throw new FsError("ENOTDIR");
    if (!VfsLib.hasPerm(node, user, "r")) throw new FsError("EACCES");
    return [...node.children.keys()].sort();
  }
}
