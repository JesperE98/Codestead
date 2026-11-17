// Port of Disks/DisksLib.Space.cs – DisksLib: how much space files and file systems use (for df and du).

import type { FsNode } from "../Vfs/FsNode.js";
import type { User } from "../Vfs/User.js";
import type { VFS } from "../Vfs/VFS.js";
import * as VfsLib from "../Vfs/VfsLib.js";
import type { DiskState } from "./DiskState.js";
import { blockSize, findBlock, mountsOf } from "./DisksLib.js";
import type { FsInfo } from "./FsInfo.js";
import type { Mount } from "./Mount.js";
import type { Usage } from "./Usage.js";

// ---------- Space ----------

const BlockBytes = 4096;
const pseudo = new Set(["proc", "sysfs"]);

function ceilBlocks(node: FsNode): number {
  return Math.ceil(VfsLib.nodeSize(node) / BlockBytes) * BlockBytes;
}

function treeUsage(node: FsNode): number {
  if (node.type === "file") return ceilBlocks(node);
  let sum = BlockBytes;
  if (node.children) for (const child of node.children.values()) sum += treeUsage(child);
  return sum;
}

/** How much the files under a mount point take, without other mounts below it. */
function mountTreeUsage(vfs: VFS, state: DiskState, m: Mount, root: User): number {
  if (pseudo.has(m.fstype)) return 0;
  const start = vfs.tryLookup(m.target, root);
  if (start === null) return 0;
  const others = new Set(state.mounts.filter((o) => o !== m).map((o) => o.target));
  const walk = (node: FsNode, path: string): number => {
    if (node.type === "file") return ceilBlocks(node);
    let sum = BlockBytes;
    if (node.children) {
      for (const [name, child] of node.children) {
        const p = path === "/" ? `/${name}` : `${path}/${name}`;
        if (others.has(p)) continue;
        sum += walk(child, p);
      }
    }
    return sum;
  };
  return walk(start, m.target);
}

function fsOverhead(fstype: string | null | undefined): number {
  return fstype === "ext4" || fstype === "ext2" ? 0.983 : fstype === "vfat" ? 0.999 : 1;
}

/** How much a file system on a partition uses, mounted or not. */
export function partitionUsage(vfs: VFS, state: DiskState, dev: FsInfo, devName: string, root: User): Usage {
  const size = Math.floor(blockSize(dev) * fsOverhead(dev.fstype));
  let used = dev.base ?? 0;
  const mounts = mountsOf(state, devName);
  if (mounts.length > 0) for (const m of mounts) used += mountTreeUsage(vfs, state, m, root);
  else if (dev.root) used += treeUsage(dev.root);
  used = Math.min(used, size);
  const reserved = dev.fstype === "ext4" || dev.fstype === "ext2" ? Math.floor(size * 0.05) : 0;
  return { size, used, avail: Math.max(0, size - used - reserved) };
}

/** The space for a mount (what df shows). */
export function mountUsage(vfs: VFS, state: DiskState, m: Mount, root: User): Usage {
  if (m.dev !== null && m.dev !== undefined) {
    const b = findBlock(state, m.dev);
    if (b !== null) return partitionUsage(vfs, state, b.dev, b.name, root);
  }
  const size = m.size ?? 0;
  const used = Math.min(size, (m.base ?? 0) + (m.fstype === "devtmpfs" ? 0 : mountTreeUsage(vfs, state, m, root)));
  return { size, used, avail: Math.max(0, size - used) };
}
