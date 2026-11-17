// Port of Disks/Mount.cs – disk model: a mounted file system.

import type { FsNode } from "../Vfs/FsNode.js";

export interface Mount {
  /** What `mount` shows as the source: /dev/sdb1, tmpfs, proc ... */
  source: string;
  target: string;
  fstype: string;
  options: string;
  /** The device (e.g. "sdb1") when the source is a disk or partition. */
  dev?: string | null;
  /** btrfs subvolume, shown as /dev/sda3[/root] by findmnt. */
  subvol?: string | null;
  /** Size in bytes for file systems not on a disk (tmpfs). */
  size?: number | null;
  /** Bytes used in addition to the files in the VFS. */
  base?: number | null;
  /** The directory that was at the mount point before (put back on umount). */
  under?: FsNode | null;
  /** The system's own mounts – cannot be unmounted. (Left out of the JSON when false.) */
  system?: boolean;
}
