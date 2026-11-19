// Port of Disks/FsInfo.cs – disk model: a file system (or swap) on a partition or a whole device.

import type { FsNode } from "../Vfs/FsNode.js";

/** A file system (or swap) on a partition or a whole device. Disk and Partition extend it. */
export interface FsInfo {
  fstype?: string | null;
  fsver?: string | null;
  label?: string | null;
  uuid?: string | null;
  /** Bytes used by things that are not in the VFS (the system's own files). */
  base?: number | null;
  /** The file system's content when it is not mounted (e.g. the USB stick). */
  root?: FsNode | null;
  /** In use as swap right now – cannot be mounted or formatted. (Left out of the JSON when false.) */
  swapActive?: boolean;
}

/** Copies the file system fields from another FsInfo ({ ...fs }). */
export function copyFsFrom(target: FsInfo, fs: FsInfo): void {
  target.fstype = fs.fstype ?? null;
  target.fsver = fs.fsver ?? null;
  target.label = fs.label ?? null;
  target.uuid = fs.uuid ?? null;
  target.base = fs.base ?? null;
  target.root = fs.root ?? null;
  target.swapActive = fs.swapActive ?? false;
}
