// Port of Vfs/FsNode.cs – virtual file system: a file, directory or symbolic link (plain data, saved as JSON).

import type { Obj } from "../Js.js";

export interface FsNode {
  /** "file", "dir" or "link" (a symbolic link: content is the path it points to). */
  type: "file" | "dir" | "link";
  /** Permission bits, e.g. 0o755. Includes setuid (0o4000) and the sticky bit (0o1000). */
  mode: number;
  owner: string;
  group: string;
  mtime: number;
  content?: string | null;
  /** The directory's entries in insertion order (a Map: JSON objects would reorder names like "2024"). */
  children?: Obj<FsNode> | null;
  /** Pretend size of "binaries" in /usr/bin. */
  size?: number | null;
  /**
   * The inode number, given the first time something shows it (ls -i, stat) or when the file gets a hard link.
   * Hard links are the same node in several directories; they share the inode number, which is how they are
   * joined again when a saved terminal is loaded (see VFS.joinHardLinks).
   */
  ino?: number | null;
  /** The number of hard links (names) when there are more than one. */
  nlink?: number | null;
}
