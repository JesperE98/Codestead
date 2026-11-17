// Port of Disks/Block.cs – disk model: the result of looking up a block device.

import type { Disk } from "./Disk.js";
import type { FsInfo } from "./FsInfo.js";
import type { Partition } from "./Partition.js";

/** A block device lookup: a whole disk or a partition. */
export interface Block {
  path: string;
  name: string;
  disk: Disk;
  part?: Partition | null;
  /** The partition, or the disk if it is a whole disk. */
  dev: FsInfo;
}
