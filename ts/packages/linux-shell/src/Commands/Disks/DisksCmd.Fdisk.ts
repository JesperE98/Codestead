// Port of Commands/Disks/DisksCmd.Fdisk.cs – the fdisk command: shows (and in theory changes) partition tables.

import type { Disk } from "../../Disks/Disk.js";
import * as DisksLib from "../../Disks/DisksLib.js";
import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { isRoot, long, table, tip } from "./DisksCmd.js";

const fdiskMan = `NAMN
       fdisk - visa och ändra partitionstabellen på en disk

SYNOPSIS
       fdisk -l [DISK]...
       fdisk DISK

BESKRIVNING
       En disk delas in i partitioner. Partitionstabellen (GPT eller den
       äldre MBR/dos) beskriver var varje partition börjar och slutar.
       fdisk -l visar tabellen. Kräver root.

       VARNING: fdisk DISK ändrar partitionstabellen. Ett misstag på ett
       riktigt system kan göra att allt på disken blir oläsbart. Kontrollera
       alltid med lsblk att du har rätt disk – och ha en backup. I
       simulatorn går det bara att lista (-l).

FLAGGOR
       -l, --list   lista partitionstabellerna

EXEMPEL
       sudo fdisk -l
       sudo fdisk -l /dev/sdb`;

const fdiskManEn = `NAME
       fdisk - show and change the partition table of a disk

SYNOPSIS
       fdisk -l [DISK]...
       fdisk DISK

DESCRIPTION
       A disk is divided into partitions. The partition table (GPT or the
       older MBR/dos) describes where each partition starts and ends.
       fdisk -l shows the table. Requires root.

       WARNING: fdisk DISK changes the partition table. A mistake on a
       real system can make everything on the disk unreadable. Always
       check with lsblk that you have the right disk – and have a backup.
       The simulator can only list (-l).

OPTIONS
       -l, --list   list the partition tables

EXAMPLES
       sudo fdisk -l
       sudo fdisk -l /dev/sdb`;

function fdiskSize(bytes: number): string {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${Js.num(Js.number(Js.toFixed(v, 2)))} ${units[u]}`;
}

function fdiskList(disk: Disk): string {
  const bytes = disk.sectors * DisksLib.Sector;
  let out =
    `Disk /dev/${disk.name}: ${fdiskSize(bytes)}, ${bytes} bytes, ${disk.sectors} sectors\n` +
    (disk.model !== "" ? `Disk model: ${disk.model.padEnd(16)}\n` : "") +
    "Units: sectors of 1 * 512 = 512 bytes\n" +
    `Sector size (logical/physical): 512 bytes / ${disk.tran === "usb" || disk.tran === "" ? 512 : 4096} bytes\n` +
    `I/O size (minimum/optimal): ${disk.tran === "sata" ? 4096 : 512} bytes / ${disk.tran === "sata" ? 4096 : 512} bytes\n`;
  if (disk.pttype === null || disk.pttype === undefined || disk.pttype === "") return out;
  out += `Disklabel type: ${disk.pttype}\nDisk identifier: ${disk.diskId ?? ""}\n\n`;
  const dos = disk.pttype === "dos";
  const rows: string[][] = [dos ? ["Device", "Boot", "Start", "End", "Sectors", "Size", "Id", "Type"] : ["Device", "Start", "End", "Sectors", "Size", "Type"]];
  for (const p of disk.partitions) {
    const nums = [Js.num(p.start), Js.num(p.start + p.sectors - 1), Js.num(p.sectors), DisksLib.lsblkSize(p.sectors * DisksLib.Sector)];
    const row = [`/dev/${p.name}`];
    if (dos) row.push("");
    row.push(...nums);
    if (dos) row.push(p.ptypeId ?? "83");
    row.push(p.ptype);
    rows.push(row);
  }
  out += table(rows, dos ? ["l", "l", "r", "r", "r", "r", "r", "l"] : ["l", "r", "r", "r", "r", "l"]);
  return out;
}

export const fdisk: CommandDef = {
  name: "fdisk",
  summary: "Visar och ändrar partitionstabeller",
  summaryEn: "Show and change partition tables",
  man: fdiskMan,
  manEn: fdiskManEn,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, { flags: "l", long: long(["list", "l"]) });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const state = ctx.sh.disks;
    if (!o.flags.has("l")) {
      if (o.operands.length !== 1) {
        ctx.err(" fdisk: bad usage\nTry 'fdisk --help' for more information.\n");
        return 1;
      }
      const b = DisksLib.findBlock(state, o.operands[0]!);
      if (b === null || !isRoot(ctx)) {
        ctx.err(`fdisk: cannot open ${o.operands[0]}: ${b !== null ? "Permission denied" : "No such file or directory"}\n`);
        return 1;
      }
      ctx.out("\nWelcome to fdisk (util-linux 2.39.3).\nChanges will remain in memory only, until you decide to write them.\nBe careful before using the write command.\n\n");
      tip(ctx, "disks.noPartitionChanges");
      return 1;
    }
    let disks = state.disks;
    if (o.operands.length > 0) {
      disks = [];
      for (const op of o.operands) {
        const b = DisksLib.findBlock(state, op);
        if (b === null) {
          ctx.err(`fdisk: cannot open ${op}: No such file or directory\n`);
          continue;
        }
        if (!disks.includes(b.disk)) disks.push(b.disk);
      }
    }
    if (!isRoot(ctx)) {
      for (const d of disks) ctx.err(`fdisk: cannot open /dev/${d.name}: Permission denied\n`);
      return 1;
    }
    ctx.out(disks.map(fdiskList).join("\n\n"));
    return 0;
  },
};
