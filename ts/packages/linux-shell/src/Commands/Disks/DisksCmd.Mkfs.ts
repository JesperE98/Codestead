// Port of Commands/Disks/DisksCmd.Mkfs.cs – the mkfs commands (mkfs, mkfs.ext4, mke2fs, mkfs.vfat, mkfs.fat): make a
// file system on a partition (format).

import * as DisksLib from "../../Disks/DisksLib.js";
import { Js } from "../../Js.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import type { Sink } from "../../Types/Sink.js";
import type { FsNode } from "../../Vfs/FsNode.js";
import * as VfsLib from "../../Vfs/VfsLib.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { isRoot, long, tip } from "./DisksCmd.js";

// The man pages come first: mkfs below is built when the module loads.
const mkfsMan = `NAMN
       mkfs.ext4, mkfs.vfat - skapa ett filsystem (formatera)

SYNOPSIS
       mkfs.ext4 [-L ETIKETT] PARTITION
       mkfs.vfat [-n ETIKETT] PARTITION
       mkfs -t TYP PARTITION

BESKRIVNING
       Skapar ett nytt, tomt filsystem på en partition. ALLT som fanns på
       partitionen försvinner. Partitionen får ett nytt UUID.

       VARNING: på ett riktigt system är det här ett av de farligaste
       kommandona som finns. Kontrollera alltid med lsblk -f att du har
       rätt enhet (sdb är inte alltid USB-stickan!) och att partitionen
       inte är monterad.

       ext4 är standard i Linux. vfat (FAT32) fungerar i Windows, macOS
       och nästan alla andra prylar, men har inga Linux-rättigheter och
       klarar inte filer större än 4 GiB.

FLAGGOR
       -L ETIKETT   etikett för ext4 (mkfs.ext4)
       -n ETIKETT   etikett för FAT, högst 11 tecken (mkfs.vfat)
       -F           (mkfs.ext4) fråga inte, även om det finns ett filsystem
       -t TYP       (mkfs) ext2, ext3, ext4 eller vfat

EXEMPEL
       sudo umount /mnt/usb
       sudo mkfs.ext4 -L BACKUP /dev/sdb1
       sudo mkfs.vfat -n USBSTICK /dev/sdb1`;

const mkfsManEn = `NAME
       mkfs.ext4, mkfs.vfat - make a file system (format)

SYNOPSIS
       mkfs.ext4 [-L LABEL] PARTITION
       mkfs.vfat [-n LABEL] PARTITION
       mkfs -t TYPE PARTITION

DESCRIPTION
       Creates a new, empty file system on a partition. EVERYTHING that was
       on the partition is lost. The partition gets a new UUID.

       WARNING: on a real system this is one of the most dangerous commands
       there is. Always check with lsblk -f that you have the right device
       (sdb is not always the USB stick!) and that the partition is not
       mounted.

       ext4 is the Linux standard. vfat (FAT32) works in Windows, macOS
       and almost every other gadget, but has no Linux permissions and
       cannot store files larger than 4 GiB.

OPTIONS
       -L LABEL     label for ext4 (mkfs.ext4)
       -n LABEL     label for FAT, at most 11 characters (mkfs.vfat)
       -F           (mkfs.ext4) do not ask, even if there is a file system
       -t TYPE      (mkfs) ext2, ext3, ext4 or vfat

EXAMPLES
       sudo umount /mnt/usb
       sudo mkfs.ext4 -L BACKUP /dev/sdb1
       sudo mkfs.vfat -n USBSTICK /dev/sdb1`;

/** Creates a new, empty file system on a partition – everything that was there is lost. fstype: ext2, ext3, ext4 or vfat. */
function makeFs(ctx: CmdCtx, fstype: string, spec: string | null, label: string | null, force: boolean): number {
  const ext = fstype !== "vfat";
  const prog = ext ? `mkfs.${fstype}` : "mkfs.fat";
  if (ext) ctx.out(ctx.sh.distro.family === "debian" ? "mke2fs 1.47.0 (5-Feb-2023)\n" : "mke2fs 1.47.3 (8-Jul-2025)\n");
  else ctx.out("mkfs.fat 4.2 (2021-01-31)\n");
  if (spec === null || spec === "") {
    ctx.err(ext ? "Usage: mke2fs [-L volume-label] [-t fs-type] [-F] device [blocks-count]\n" : "No device specified.\nUsage: mkfs.fat [OPTIONS] TARGET [BLOCKS]\n");
    return 1;
  }
  const state = ctx.sh.disks;
  const b = DisksLib.findBlock(state, spec);
  if (b === null) {
    ctx.err(ext ? `The file ${spec} does not exist and no size was specified.\n` : `mkfs.fat: unable to open ${spec}: No such file or directory\n`);
    return 1;
  }
  if (!isRoot(ctx)) {
    ctx.err(ext ? `${prog}: Permission denied while trying to determine filesystem size\n` : `mkfs.fat: unable to open ${b.path}: Permission denied\n`);
    return 1;
  }
  const dev = b.dev;
  if (DisksLib.mountsOf(state, b.name).length > 0) {
    ctx.err(ext ? `${b.path} is mounted; will not make a filesystem here!\n` : `mkfs.fat: ${b.path} contains a mounted filesystem.\n`);
    return 1;
  }
  if (dev.swapActive === true) {
    ctx.err(ext ? `${b.path} is apparently in use by the system; will not make a filesystem here!\n` : `mkfs.fat: unable to open ${b.path}: Device or resource busy\n`);
    return 1;
  }
  if ((b.part === null || b.part === undefined) && b.disk.partitions.length > 0) {
    ctx.out(`Found a ${b.disk.pttype ?? ""} partition table in ${b.path}\n`);
    tip(ctx, "disks.formatPartitionsOnly");
    return 1;
  }
  const sh = ctx.sh;
  const finish = (io: Sink): number => {
    const uuid = DisksLib.newUuid(fstype);
    dev.fstype = fstype;
    dev.fsver = ext ? "1.0" : "FAT32";
    dev.uuid = uuid;
    dev.label = label === null || label === "" ? null : label;
    dev.base = 0;
    const fresh = VfsLib.makeDir("root", Js.oct(755));
    if (ext) {
      const children = Js.obj<FsNode>();
      children.set("lost+found", VfsLib.makeDir("root", Js.oct(700)));
      fresh.children = children;
    }
    dev.root = fresh;
    if (ext) {
      // long arithmetic in C#: integer divisions.
      const blocks = Math.trunc(DisksLib.blockSize(dev) / 4096);
      io.out(
        `Creating filesystem with ${blocks} 4k blocks and ${Math.trunc(Math.trunc(blocks / 4) / 8192) * 8192} inodes\n` +
          `Filesystem UUID: ${uuid}\n` +
          "Superblock backups stored on blocks: \n\t32768, 98304, 163840, 229376, 294912, 819200, 884736, 1605632, 2654208\n\n" +
          "Allocating group tables: done                            \n" +
          "Writing inode tables: done                            \n" +
          (fstype === "ext2" ? "" : "Creating journal (16384 blocks): done\n") +
          "Writing superblocks and filesystem accounting information: done   \n\n",
      );
    } else if (label !== null && label !== "" && label !== label.toUpperCase()) {
      io.err("mkfs.fat: Warning: lowercase labels might not work properly on some systems\n");
    }
    return 0;
  };
  if (ext && dev.fstype !== null && dev.fstype !== undefined && dev.fstype !== "" && !force) {
    ctx.out(`${b.path} contains a ${dev.fstype} file system${dev.label !== null && dev.label !== undefined && dev.label !== "" ? ` labelled '${dev.label}'` : ""}\n`);
    sh.ask("Proceed anyway? (y,N) ", false, (yes, io) => (yes ? finish(io) : 1));
    return 0;
  }
  return finish(ctx);
}

const extTypes = ["ext2", "ext3", "ext4"];

export function mkfsExt(fixed: string | null = null): (ctx: CmdCtx) => number {
  return (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, { flags: "Fqv", values: "Ltb", long: long(["label", "L"], ["type", "t"]) });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const type = fixed ?? o.values.get("t") ?? "ext2";
    if (!extTypes.includes(type)) {
      ctx.err(`mke2fs: invalid fs type '${type}'\n`);
      return 1;
    }
    return makeFs(ctx, type, o.operands[0] ?? null, o.values.get("L") ?? null, o.flags.has("F"));
  };
}

export function mkfsVfatRun(ctx: CmdCtx): number {
  const o = UtilCmd.parseOpts(ctx.args, { flags: "cIv", values: "nFs" });
  if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
  const label = o.values.get("n") ?? null;
  if (label !== null && label !== "" && label.length > 11) {
    ctx.err("mkfs.fat: Label can be no longer than 11 characters\n");
    return 1;
  }
  return makeFs(ctx, "vfat", o.operands[0] ?? null, label, true);
}

export function mkfsDef(name: string, run: (ctx: CmdCtx) => number): CommandDef {
  return {
    name,
    summary: "Skapar ett filsystem på en partition (formaterar)",
    summaryEn: "Make a file system on a partition (format)",
    man: mkfsMan,
    manEn: mkfsManEn,
    run,
  };
}

export const mkfs: CommandDef = mkfsDef("mkfs", (ctx) => {
  const o = UtilCmd.parseOpts(ctx.args, { flags: "FqvV", values: "tLn", long: long(["type", "t"]) });
  if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
  const type = o.values.get("t") ?? "ext2";
  if (type === "vfat" || type === "fat" || type === "msdos") {
    return makeFs(ctx, "vfat", o.operands[0] ?? null, o.values.get("n") ?? null, true);
  }
  if (extTypes.includes(type)) return makeFs(ctx, type, o.operands[0] ?? null, o.values.get("L") ?? null, o.flags.has("F"));
  ctx.err(`mkfs: failed to execute mkfs.${type}: No such file or directory\n`);
  return 1;
});
