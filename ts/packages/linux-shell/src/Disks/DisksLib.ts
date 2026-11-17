// Port of Disks/DisksLib.cs (src/shell/disks.ts) – the disks in the simulated computer: a system disk with
// partitions and a USB stick the student can mount.
//
// Mounting a file system here means that the directory in the VFS (e.g. /mnt/usb) is replaced by
// the file system's root directory. The directory that was there is saved and put back on umount,
// and the file system's content is then saved in the partition – just like for real, the files
// disappear from the tree but are still on the stick. The other parts are DisksLib.Setup.ts and
// DisksLib.Space.ts, re-exported here.

import { Js } from "../Js.js";
import type { FsNode } from "../Vfs/FsNode.js";
import type { User } from "../Vfs/User.js";
import type { VFS } from "../Vfs/VFS.js";
import * as VfsLib from "../Vfs/VfsLib.js";
import type { Block } from "./Block.js";
import { isDisk } from "./Disk.js";
import type { DiskState } from "./DiskState.js";
import type { FsInfo } from "./FsInfo.js";
import type { Mount } from "./Mount.js";
import { isPartition } from "./Partition.js";

export * from "./DisksLib.Setup.js";
export * from "./DisksLib.Space.js";

export const Sector = 512;
export const MiB = 1024 * 1024;
export const GiB = 1024 * 1024 * 1024;
/** RAM in KiB (the same as `free` shows). */
export const RamKb = 8_073_420;

export const UsbDisk = "sdb";
export const UsbPart = "sdb1";
export const UsbLabel = "USBSTICK";
export const UsbUuid = "7E21-9A4F";

export interface Ids {
  efi: string;
  boot?: string | null;
  root: string;
  swap: string;
  disk: string;
}

/** UUIDs per family, so that /etc/fstab, blkid and lsblk agree. */
export const idsByFamily = new Map<string, Ids>([
  [
    "debian",
    {
      efi: "4A1C-93E2",
      root: "3f1c9a2e-7b4d-4e8a-9c61-2d5e8f0a4b17",
      swap: "9a6d3e51-0c2f-4b8e-a7d4-5e1f2c3b6a90",
      disk: "6B0E2F4A-1C3D-4E5F-8A9B-0C1D2E3F4A5B",
    },
  ],
  [
    "arch",
    {
      efi: "C2D7-5B18",
      root: "b84e2c61-95f3-4d0a-8e7b-1a2c3d4e5f60",
      swap: "2e9f7a14-6c3b-4d5e-9f80-a1b2c3d4e5f6",
      disk: "9F3A1B2C-4D5E-4F60-8172-93A4B5C6D7E8",
    },
  ],
  [
    "redhat",
    {
      efi: "1D6B-8F2A",
      boot: "e5a0c3b7-2d14-4f69-8b3e-7c1d2e3f4a5b",
      root: "c7f1e2d3-a4b5-4c6d-8e9f-0a1b2c3d4e5f",
      swap: "0b3c4d5e-6f70-4182-93a4-b5c6d7e8f901",
      disk: "2A4C6E80-1B3D-4F5A-9C7E-8D0F1A2B3C4D",
    },
  ],
]);

/** Sectors per GiB. */
export const G = GiB / Sector;
export const DiskSectors = 64 * G;
/** The last sector used (GPT needs room for a backup copy at the end). */
export const Last = DiskSectors - 2049;
export const UsbSectors = 31_277_232;

// ---------- Lookups ----------

export function allBlocks(state: DiskState): Block[] {
  const out: Block[] = [];
  for (const disk of state.disks) {
    out.push({ path: `/dev/${disk.name}`, name: disk.name, disk, dev: disk });
    for (const p of disk.partitions) out.push({ path: `/dev/${p.name}`, name: p.name, disk, part: p, dev: p });
  }
  return out;
}

const specRe = /^(LABEL|UUID|PARTUUID)=([^\n]*)$/; // .NET "." is [^\n]
const quoteRe = /^["']|["']$/g;

/** Finds a device from /dev/sdb1, LABEL=USBSTICK or UUID=... */
export function findBlock(state: DiskState, spec: string): Block | null {
  const blocks = allBlocks(state);
  const eq = specRe.exec(spec);
  if (eq) {
    const value = eq[2]!.replace(quoteRe, "");
    const key = eq[1]!;
    return (
      blocks.find((b) => {
        const v = key === "LABEL" ? b.dev.label : key === "UUID" ? b.dev.uuid : isPartition(b.dev) ? b.dev.partuuid : null;
        return v !== null && v !== undefined && (key === "LABEL" ? v === value : v.toLowerCase() === value.toLowerCase());
      }) ?? null
    );
  }
  const path = VfsLib.normalizePath(spec.startsWith("/") ? spec : `/dev/${spec}`);
  return blocks.find((b) => b.path === path) ?? null;
}

export function mountsOf(state: DiskState, devName: string): Mount[] {
  return state.mounts.filter((m) => m.dev === devName);
}

/** The mount the path is in (the longest matching mount point). */
export function mountFor(state: DiskState, path: string): Mount | null {
  const p = VfsLib.normalizePath(path);
  let best: Mount | null = null;
  for (const m of state.mounts) {
    if (m.target === p || m.target === "/" || p.startsWith(m.target + "/")) {
      if (best === null || m.target.length >= best.target.length) best = m;
    }
  }
  return best;
}

export function blockSize(dev: FsInfo): number {
  if (isDisk(dev)) return dev.sectors * Sector;
  if (isPartition(dev)) return dev.sectors * Sector;
  return 0;
}

/** Size as lsblk shows it: 64G, 14.9G, 600M. */
export function lsblkSize(bytes: number): string {
  const units = ["B", "K", "M", "G", "T"];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  let s = Js.toFixed(v, 1);
  if (s.endsWith(".0")) s = s.slice(0, -2);
  return s + units[u];
}

// ---------- /proc/mounts ----------

export function writeProcMounts(vfs: VFS, state: DiskState): void {
  const proc = vfs.root.children?.get("proc");
  if (!proc || proc.type !== "dir" || !proc.children) return;
  const lines = state.mounts.map((m) => `${m.source} ${m.target} ${m.fstype} ${m.options} 0 0\n`).join("");
  proc.children.set("mounts", VfsLib.makeFile(lines, "root", Js.oct(444)));
}

/** The content of a partition: the mount's directory in the VFS, or the saved content. */
export function partitionRoot(vfs: VFS, state: DiskState, devName: string, root: User): FsNode | null {
  const m = mountsOf(state, devName)[0];
  if (m) return vfs.tryLookup(m.target, root);
  return findBlock(state, devName)?.dev.root ?? null;
}

/** A new random UUID (ext4) or volume id (FAT). */
export function newUuid(fstype: string): string {
  const hex = (n: number): string => {
    let s = "";
    for (let i = 0; i < n; i++) s += Math.floor(Js.random() * 16).toString(16);
    return s;
  };
  if (fstype === "vfat") return `${hex(4)}-${hex(4)}`.toUpperCase();
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[Math.floor(Js.random() * 4)]}${hex(3)}-${hex(12)}`;
}

export const RamBytes = RamKb * 1024;
