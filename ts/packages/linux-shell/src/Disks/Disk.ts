// Port of Disks/Disk.cs – disk model: a whole disk (the system disk, the USB stick, zram).

import type { FsInfo } from "./FsInfo.js";
import type { Partition } from "./Partition.js";

export interface Disk extends FsInfo {
  name: string;
  sectors: number;
  model: string;
  removable: boolean;
  /** Connection: sata, usb or empty (zram). */
  tran: string;
  major: number;
  minor: number;
  /** "gpt" or "dos". */
  pttype?: string | null;
  diskId?: string | null;
  partitions: Partition[];
}

/** dev is Disk (C# type test; disks are the FsInfo objects with a partition list). */
export function isDisk(dev: FsInfo): dev is Disk {
  return Array.isArray((dev as Partial<Disk>).partitions);
}
