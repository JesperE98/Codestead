// Port of Disks/Partition.cs – disk model: a partition.

import type { FsInfo } from "./FsInfo.js";

export interface Partition extends FsInfo {
  name: string;
  /** The first sector. */
  start: number;
  sectors: number;
  /** Partition type shown by fdisk, e.g. "EFI System". */
  ptype: string;
  /** MBR type (only for dos partition tables), e.g. "c". */
  ptypeId?: string | null;
  partuuid: string;
}

/** dev is Partition (C# type test; partitions are the FsInfo objects with a PARTUUID). */
export function isPartition(dev: FsInfo): dev is Partition {
  return typeof (dev as Partial<Partition>).partuuid === "string";
}
