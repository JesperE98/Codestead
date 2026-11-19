// Port of Disks/DisksLib.Setup.cs – DisksLib: the disks, partitions, mounts and /etc/fstab of a new computer.

import type { Distro } from "../Distros/Distro.js";
import { Js } from "../Js.js";
import type { FsNode } from "../Vfs/FsNode.js";
import type { VFS } from "../Vfs/VFS.js";
import * as VfsLib from "../Vfs/VfsLib.js";
import type { World } from "../World.js";
import type { Disk } from "./Disk.js";
import type { DiskState } from "./DiskState.js";
import { allBlocks, G, GiB, idsByFamily, Last, MiB, RamKb, UsbDisk, UsbLabel, UsbPart, UsbSectors, UsbUuid, writeProcMounts, DiskSectors } from "./DisksLib.js";
import { copyFsFrom, type FsInfo } from "./FsInfo.js";
import type { Mount } from "./Mount.js";
import type { Partition } from "./Partition.js";

/** A file on the USB stick. `size` gives "binary files" (pictures, PDF) a pretend size. */
function usbFile(content: string, mtime: number, size: number | null = null): FsNode {
  const n = VfsLib.makeFile(content, "root", Js.oct(755));
  if (size !== null) n.size = size;
  n.mtime = mtime;
  return n;
}

/** The files on the USB stick, in the language of the student's world. */
function usbFiles(w: World): FsNode {
  const t = Date.UTC(2026, 6, 14, 10, 32, 0);
  const root = VfsLib.makeDir("root", Js.oct(755));
  root.mtime = t;
  const children = Js.obj<FsNode>();
  children.set(w.get("vacationPic"), usbFile("ÿØÿà\u0000\u0010JFIF\u0000 (simulated image)\n", t, 3_481_216));
  children.set(w.get("report"), usbFile(w.file("report"), t + 3_600_000, 842_113));
  children.set(w.get("todo"), usbFile(w.file("usbTodo"), t + 7_200_000));
  root.children = children;
  return root;
}

function part(name: string, start: number, sectors: number, ptype: string, partuuid: string, fs: FsInfo): Partition {
  const p: Partition = { name, start, sectors, ptype, partuuid };
  copyFsFrom(p, fs);
  return p;
}

function withBase(fs: FsInfo, base: number): FsInfo {
  const copy: FsInfo = {};
  copyFsFrom(copy, fs);
  copy.base = base;
  return copy;
}

export function initialDisks(distro: Distro, w: World): DiskState {
  const ids = idsByFamily.get(distro.family)!;
  const pu = (n: number): string => `${ids.disk.slice(0, 8).toLowerCase()}-0000-4000-8000-00000000000${n}`;
  let partitions: Partition[];
  const efi: FsInfo = { fstype: "vfat", fsver: "FAT32", uuid: ids.efi };
  const swap: FsInfo = { fstype: "swap", fsver: "1", uuid: ids.swap, swapActive: true };
  const rootBase = distro.id === "ubuntu" ? 9.6 : distro.id === "debian" ? 3.8 : distro.id === "arch" ? 3.1 : distro.id === "fedora" ? 6.2 : 4;
  switch (distro.family) {
    case "debian":
      // The Debian installer's layout: EFI, root and swap last.
      partitions = [
        part("sda1", 2048, 1 * G, "EFI System", pu(1), withBase(efi, 6.2 * MiB)),
        part("sda2", 2048 + G, Last - 2 * G - (2048 + G) + 1, "Linux filesystem", pu(2), {
          fstype: "ext4",
          fsver: "1.0",
          uuid: ids.root,
          base: rootBase * GiB,
        }),
        part("sda3", Last - 2 * G + 1, 2 * G, "Linux swap", pu(3), swap),
      ];
      break;
    case "arch":
      // As in the Arch wiki: the EFI partition is mounted on /boot, then swap and root.
      partitions = [
        part("sda1", 2048, 1 * G, "EFI System", pu(1), withBase(efi, 158 * MiB)),
        part("sda2", 2048 + G, 2 * G, "Linux swap", pu(2), swap),
        part("sda3", 2048 + 3 * G, Last - (2048 + 3 * G) + 1, "Linux filesystem", pu(3), {
          fstype: "ext4",
          fsver: "1.0",
          uuid: ids.root,
          base: rootBase * GiB,
        }),
      ];
      break;
    default: {
      // Fedora: EFI, /boot with ext4 and the rest btrfs (the subvolumes root and home).
      // Swap is in RAM (zram), not on the disk.
      const r = idsByFamily.get("redhat")!;
      partitions = [
        part("sda1", 2048, 1_228_800, "EFI System", pu(1), withBase(efi, 19.6 * MiB)),
        part("sda2", 1_230_848, G, "Linux extended boot", pu(2), {
          fstype: "ext4",
          fsver: "1.0",
          uuid: r.boot ?? null,
          base: 286 * MiB,
        }),
        part("sda3", 1_230_848 + G, Last - (1_230_848 + G) + 1, "Linux filesystem", pu(3), {
          fstype: "btrfs",
          fsver: "1",
          label: "fedora",
          uuid: r.root,
          base: rootBase * GiB,
        }),
      ];
      break;
    }
  }
  const disks: Disk[] = [
    {
      name: "sda",
      sectors: DiskSectors,
      model: "QEMU HARDDISK",
      removable: false,
      tran: "sata",
      major: 8,
      minor: 0,
      pttype: "gpt",
      diskId: ids.disk,
      partitions,
    },
    {
      name: UsbDisk,
      sectors: UsbSectors,
      model: "USB Flash Disk",
      removable: true,
      tran: "usb",
      major: 8,
      minor: 16,
      pttype: "dos",
      diskId: "0x5d3a1c7e",
      partitions: [
        {
          name: UsbPart,
          start: 2048,
          sectors: UsbSectors - 2048,
          ptype: "W95 FAT32 (LBA)",
          ptypeId: "c",
          partuuid: "5d3a1c7e-01",
          fstype: "vfat",
          fsver: "FAT32",
          label: UsbLabel,
          uuid: UsbUuid,
          base: 0,
          root: usbFiles(w),
        },
      ],
    },
  ];
  if (distro.family === "redhat") {
    disks.push({
      name: "zram0",
      sectors: 2 * G,
      model: "",
      removable: false,
      tran: "",
      major: 251,
      minor: 0,
      partitions: [],
      fstype: "swap",
      fsver: "1",
      label: "zram0",
      uuid: idsByFamily.get("redhat")!.swap,
      swapActive: true,
    });
  }
  return { disks, mounts: systemMounts(distro) };
}

function systemMounts(distro: Distro): Mount[] {
  const kb = (k: number): number => k * 1024;
  // Integer division in C# (long).
  const run = Math.trunc(RamKb / 10);
  const half = Math.trunc(RamKb / 2);
  const tmpfs = (target: string, options: string, size: number, base = 0): Mount => ({
    source: "tmpfs",
    target,
    fstype: "tmpfs",
    options,
    size: kb(size),
    base,
    system: true,
  });
  const devName = distro.family === "debian" ? "udev" : distro.family === "arch" ? "dev" : "devtmpfs";
  const devSize = distro.family === "redhat" ? 4096 : 3_995_264;
  const m: Mount[] = [
    { source: "sysfs", target: "/sys", fstype: "sysfs", options: "rw,nosuid,nodev,noexec,relatime", system: true },
    { source: "proc", target: "/proc", fstype: "proc", options: "rw,nosuid,nodev,noexec,relatime", system: true },
    {
      source: devName,
      target: "/dev",
      fstype: "devtmpfs",
      options: `rw,nosuid,relatime,size=${devSize}k,nr_inodes=998816,mode=755,inode64`,
      size: kb(devSize),
      system: true,
    },
    tmpfs("/run", `rw,nosuid,nodev,noexec,relatime,size=${run}k,mode=755,inode64`, run, 1.6 * MiB),
  ];
  switch (distro.family) {
    case "debian":
      m.push({
        source: "/dev/sda2",
        target: "/",
        fstype: "ext4",
        options: "rw,relatime,errors=remount-ro",
        dev: "sda2",
        system: true,
      });
      break;
    case "arch":
      m.push({ source: "/dev/sda3", target: "/", fstype: "ext4", options: "rw,relatime", dev: "sda3", system: true });
      break;
    case "redhat":
      m.push({
        source: "/dev/sda3",
        target: "/",
        fstype: "btrfs",
        options: "rw,relatime,seclabel,compress=zstd:1,ssd,discard=async,space_cache=v2,subvolid=257,subvol=/root",
        dev: "sda3",
        subvol: "/root",
        system: true,
      });
      break;
  }
  m.push(tmpfs("/dev/shm", "rw,nosuid,nodev,inode64", half));
  if (distro.family === "debian") m.push(tmpfs("/run/lock", "rw,nosuid,nodev,noexec,relatime,size=5120k,inode64", 5120, 8192));
  // Debian 13, Arch and Fedora have /tmp in RAM (tmpfs). Ubuntu has it on the disk.
  if (distro.id !== "ubuntu") m.push(tmpfs("/tmp", `rw,nosuid,nodev,size=${half}k,nr_inodes=1048576,inode64`, half));
  const vfatOpts = "rw,relatime,fmask=0077,dmask=0077,codepage=437,iocharset=ascii,shortname=mixed,utf8,errors=remount-ro";
  switch (distro.family) {
    case "debian":
      m.push({ source: "/dev/sda1", target: "/boot/efi", fstype: "vfat", options: vfatOpts, dev: "sda1", system: true });
      break;
    case "arch":
      m.push({ source: "/dev/sda1", target: "/boot", fstype: "vfat", options: vfatOpts.replaceAll("0077", "0022"), dev: "sda1", system: true });
      break;
    case "redhat":
      m.push({
        source: "/dev/sda3",
        target: "/home",
        fstype: "btrfs",
        options: "rw,relatime,seclabel,compress=zstd:1,ssd,discard=async,space_cache=v2,subvolid=256,subvol=/home",
        dev: "sda3",
        subvol: "/home",
        system: true,
      });
      m.push({ source: "/dev/sda2", target: "/boot", fstype: "ext4", options: "rw,relatime,seclabel", dev: "sda2", system: true });
      // vfatOpts.replace('relatime', 'relatime,seclabel') – only the first occurrence.
      m.push({ source: "/dev/sda1", target: "/boot/efi", fstype: "vfat", options: vfatOpts.replace("relatime", "relatime,seclabel"), dev: "sda1", system: true });
      break;
  }
  m.push(tmpfs("/run/user/1000", `rw,nosuid,nodev,relatime,size=${run}k,nr_inodes=201808,mode=700,uid=1000,gid=1000,inode64`, run, 124 * 1024));
  return m;
}

/** /etc/fstab as each distribution's installer would have written it. */
export function fstabFor(distro: Distro): string {
  switch (distro.family) {
    case "debian": {
      const ids = idsByFamily.get("debian")!;
      return (
        "# /etc/fstab: static file system information.\n" +
        "#\n" +
        "# Use 'blkid' to print the universally unique identifier for a\n" +
        "# device; this may be used with UUID= as a more robust way to name devices\n" +
        "# that works even if disks are added and removed. See fstab(5).\n" +
        "#\n" +
        "# <file system> <mount point>   <type>  <options>       <dump>  <pass>\n" +
        "# / was on /dev/sda2 during installation\n" +
        `UUID=${ids.root} /               ext4    errors=remount-ro 0       1\n` +
        "# /boot/efi was on /dev/sda1 during installation\n" +
        `UUID=${ids.efi}  /boot/efi       vfat    umask=0077      0       1\n` +
        "# swap was on /dev/sda3 during installation\n" +
        `UUID=${ids.swap} none            swap    sw              0       0\n`
      );
    }
    case "arch": {
      const ids = idsByFamily.get("arch")!;
      return (
        "# Static information about the filesystems.\n" +
        "# See fstab(5) for details.\n" +
        "\n" +
        "# <file system> <dir> <type> <options> <dump> <pass>\n" +
        "# /dev/sda3\n" +
        `UUID=${ids.root}\t/         \text4      \trw,relatime\t0 1\n` +
        "\n" +
        "# /dev/sda1\n" +
        `UUID=${ids.efi}      \t/boot     \tvfat      \trw,relatime,fmask=0022,dmask=0022,codepage=437,iocharset=ascii,shortname=mixed,utf8,errors=remount-ro\t0 2\n` +
        "\n" +
        "# /dev/sda2\n" +
        `UUID=${ids.swap}\tnone      \tswap      \tdefaults  \t0 0\n` +
        "\n"
      );
    }
    default: {
      const ids = idsByFamily.get("redhat")!;
      return (
        "\n" +
        "#\n" +
        "# /etc/fstab\n" +
        "# Created by anaconda on Mon Oct 20 10:02:11 2026\n" +
        "#\n" +
        "# Accessible filesystems, by reference, are maintained under '/dev/disk/'.\n" +
        "# See man pages fstab(5), findfs(8), mount(8) and/or blkid(8) for more info.\n" +
        "#\n" +
        "# After editing this file, run 'systemctl daemon-reload' to update systemd\n" +
        "# units generated from this file.\n" +
        "#\n" +
        `UUID=${ids.root} /                       btrfs   subvol=root,compress=zstd:1 0 0\n` +
        `UUID=${ids.boot} /boot                   ext4    defaults        1 2\n` +
        `UUID=${ids.efi}          /boot/efi               vfat    umask=0077,shortname=winnt 0 2\n` +
        `UUID=${ids.root} /home                   btrfs   subvol=home,compress=zstd:1 0 0\n`
      );
    }
  }
}

/** UUID of the file system mounted on /. */
export function rootUuid(distro: Distro): string {
  return idsByFamily.get(distro.family)!.root;
}

/** The old /etc/fstab from versions before the disk chapter. */
const oldFstab = "# <file system>  <mount point>  <type>  <options>  <dump>  <pass>\nUUID=1234-abcd   /              ext4    defaults   0       1\n";

/**
 * Creates the disk model for a new (or old saved) shell: device files in /dev, the mount points,
 * /proc/mounts and an /etc/fstab that matches the disks.
 */
export function setupDisks(distro: Distro, vfs: VFS, w: World): DiskState {
  const state = initialDisks(distro, w);
  const root = vfs.root;
  const dir = (path: string): FsNode | null => {
    let node = root;
    for (const seg of path.split("/").filter((s) => s !== "")) {
      if (node.type !== "dir" || !node.children) return null;
      let next = node.children.get(seg);
      if (!next) {
        next = VfsLib.makeDir();
        node.children.set(seg, next);
      }
      node = next;
    }
    return node.type === "dir" ? node : null;
  };
  const dev = dir("/dev");
  if (dev?.children) {
    for (const b of allBlocks(state)) if (!dev.children.has(b.name)) dev.children.set(b.name, VfsLib.makeFile("", "root", Js.oct(660), "disk"));
  }
  for (const m of state.mounts) {
    if (m.dev !== null && m.dev !== undefined && m.target !== "/") {
      const node = dir(m.target);
      if (node !== null && m.target.startsWith("/boot")) node.mode = m.fstype === "vfat" && distro.family !== "arch" ? Js.oct(700) : Js.oct(755);
    }
  }
  const etc = dir("/etc");
  const fstab = etc?.children?.get("fstab");
  if (etc?.children && (!fstab || fstab.content === oldFstab)) etc.children.set("fstab", VfsLib.makeFile(fstabFor(distro)));
  writeProcMounts(vfs, state);
  return state;
}
