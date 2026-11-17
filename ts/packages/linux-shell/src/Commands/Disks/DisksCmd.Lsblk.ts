// Port of Commands/Disks/DisksCmd.Lsblk.cs – the lsblk command: lists disks and partitions (block devices).

import type { Block } from "../../Disks/Block.js";
import type { Disk } from "../../Disks/Disk.js";
import * as DisksLib from "../../Disks/DisksLib.js";
import type { Partition } from "../../Disks/Partition.js";
import type { Usage } from "../../Disks/Usage.js";
import { Js } from "../../Js.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { branch, long, table, type Column } from "./DisksCmd.js";

const lsblkMan = `NAMN
       lsblk - lista blockenheter: diskar och partitioner

SYNOPSIS
       lsblk [FLAGGA]... [ENHET]...

BESKRIVNING
       Visar diskarna som ett träd, med partitionerna under varje disk.
       RM = 1 betyder en löstagbar enhet (t.ex. en USB-sticka), TYPE är
       disk eller part, och MOUNTPOINTS visar var filsystemet är monterat
       ([SWAP] betyder att partitionen används som swap).

FLAGGOR
       -f, --fs           visa filsystemen: typ, etikett, UUID och ledigt
       -o, --output LISTA välj kolumner, t.ex. NAME,SIZE,FSTYPE,MOUNTPOINTS
                          (+UUID lägger till en kolumn till standardlistan)
       -d, --nodeps       bara diskarna, inte partitionerna
       -p, --paths        visa hela sökvägen (/dev/sda1)
       -l, --list         lista i stället för träd
       -n, --noheadings   ingen rubrikrad

KOLUMNER
       NAME SIZE TYPE FSTYPE FSVER LABEL UUID PARTUUID MOUNTPOINTS
       FSSIZE FSUSED FSAVAIL FSUSE% MODEL TRAN RM RO MAJ:MIN PATH

EXEMPEL
       lsblk
       lsblk -f
       lsblk -o NAME,SIZE,FSTYPE,LABEL,MOUNTPOINTS
       lsblk /dev/sdb`;

const lsblkManEn = `NAME
       lsblk - list block devices: disks and partitions

SYNOPSIS
       lsblk [OPTION]... [DEVICE]...

DESCRIPTION
       Shows the disks as a tree, with the partitions under each disk.
       RM = 1 means a removable device (such as a USB stick), TYPE is
       disk or part, and MOUNTPOINTS shows where the file system is
       mounted ([SWAP] means the partition is used as swap).

OPTIONS
       -f, --fs           show file systems: type, label, UUID and free space
       -o, --output LIST  choose columns, e.g. NAME,SIZE,FSTYPE,MOUNTPOINTS
                          (+UUID adds a column to the default list)
       -d, --nodeps       only the disks, not the partitions
       -p, --paths        print full paths (/dev/sda1)
       -l, --list         list instead of tree
       -n, --noheadings   no header line

COLUMNS
       NAME SIZE TYPE FSTYPE FSVER LABEL UUID PARTUUID MOUNTPOINTS
       FSSIZE FSUSED FSAVAIL FSUSE% MODEL TRAN RM RO MAJ:MIN PATH

EXAMPLES
       lsblk
       lsblk -f
       lsblk -o NAME,SIZE,FSTYPE,LABEL,MOUNTPOINTS
       lsblk /dev/sdb`;

interface LsblkRow {
  block: Block;
  prefix: string;
}

function lsblkColumns(ctx: CmdCtx): Map<string, Column<LsblkRow>> {
  const sh = ctx.sh;
  const state = sh.disks;
  const root = sh.rootUser();
  const mountpoints = (b: Block): string[] => {
    if (b.dev.swapActive === true) return ["[SWAP]"];
    const list = DisksLib.mountsOf(state, b.name).map((m) => m.target);
    list.reverse();
    return list;
  };
  const use = (b: Block): Usage | null => (DisksLib.mountsOf(state, b.name).length > 0 ? DisksLib.partitionUsage(sh.vfs, state, b.dev, b.name, root) : null);
  const minor = (b: Block): number => (b.part !== null && b.part !== undefined ? b.disk.minor + b.disk.partitions.indexOf(b.part) + 1 : b.disk.minor);
  const c = (align: string, get: (r: LsblkRow, full: boolean) => string): Column<LsblkRow> => ({ align, get });
  const isPart = (b: Block): boolean => b.part !== null && b.part !== undefined;
  return new Map<string, Column<LsblkRow>>([
    ["NAME", c("l", (r, full) => r.prefix + (full ? r.block.path : r.block.name))],
    ["KNAME", c("l", (r) => r.block.name)],
    ["PATH", c("l", (r) => r.block.path)],
    ["MAJ:MIN", c("l", (r) => `${Js.num(r.block.disk.major).padStart(3)}:${Js.num(minor(r.block)).padEnd(3)}`)],
    ["RM", c("r", (r) => (r.block.disk.removable ? "1" : "0"))],
    ["SIZE", c("r", (r) => DisksLib.lsblkSize(DisksLib.blockSize(r.block.dev)))],
    ["RO", c("r", () => "0")],
    ["TYPE", c("l", (r) => (isPart(r.block) ? "part" : "disk"))],
    ["MOUNTPOINT", c("l", (r) => mountpoints(r.block)[0] ?? "")],
    ["MOUNTPOINTS", c("l", (r) => mountpoints(r.block).join("\n"))],
    ["FSTYPE", c("l", (r) => r.block.dev.fstype ?? "")],
    ["FSVER", c("l", (r) => r.block.dev.fsver ?? "")],
    ["LABEL", c("l", (r) => r.block.dev.label ?? "")],
    ["UUID", c("l", (r) => r.block.dev.uuid ?? "")],
    ["PARTUUID", c("l", (r) => r.block.part?.partuuid ?? "")],
    ["PTTYPE", c("l", (r) => r.block.disk.pttype ?? "")],
    [
      "FSSIZE",
      c("r", (r) => {
        const u = use(r.block);
        return u !== null ? DisksLib.lsblkSize(u.size) : "";
      }),
    ],
    [
      "FSUSED",
      c("r", (r) => {
        const u = use(r.block);
        return u !== null ? DisksLib.lsblkSize(u.used) : "";
      }),
    ],
    [
      "FSAVAIL",
      c("r", (r) => {
        const u = use(r.block);
        return u !== null ? DisksLib.lsblkSize(u.avail) : "";
      }),
    ],
    [
      "FSUSE%",
      c("r", (r) => {
        const u = use(r.block);
        return u !== null ? `${u.used + u.avail !== 0 ? Js.num(Math.ceil((u.used * 100) / (u.used + u.avail))) : "0"}%` : "";
      }),
    ],
    ["MODEL", c("l", (r) => (isPart(r.block) ? "" : r.block.disk.model))],
    ["TRAN", c("l", (r) => (isPart(r.block) ? "" : r.block.disk.tran))],
    ["HOTPLUG", c("r", (r) => (r.block.disk.removable ? "1" : "0"))],
  ]);
}

const leadingPlus = /^\+/;

export const lsblk: CommandDef = {
  name: "lsblk",
  summary: "Listar diskar och partitioner (blockenheter)",
  summaryEn: "List disks and partitions (block devices)",
  man: lsblkMan,
  manEn: lsblkManEn,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "fdplnab",
      values: "o",
      long: long(["fs", "f"], ["nodeps", "d"], ["paths", "p"], ["list", "l"], ["noheadings", "n"], ["all", "a"], ["bytes", "b"], ["output", "o"]),
    });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const state = ctx.sh.disks;
    const cols = lsblkColumns(ctx);
    const defaults = o.flags.has("f")
      ? ["NAME", "FSTYPE", "FSVER", "LABEL", "UUID", "FSAVAIL", "FSUSE%", "MOUNTPOINTS"]
      : ["NAME", "MAJ:MIN", "RM", "SIZE", "RO", "TYPE", "MOUNTPOINTS"];
    let names = defaults;
    const oVal = o.values.get("o");
    if (oVal !== undefined) {
      const list = oVal
        .replace(leadingPlus, "")
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s !== "");
      names = oVal.startsWith("+") ? [...defaults, ...list] : list;
    }
    for (const n of names) {
      if (!cols.has(n)) {
        ctx.err(`lsblk: unknown column: ${n}\n`);
        return 1;
      }
    }
    let disks: Disk[] = state.disks;
    let onlyPart: Partition | null = null;
    let code = 0;
    if (o.operands.length > 0) {
      disks = [];
      for (const op of o.operands) {
        const b = op.startsWith("/") ? DisksLib.findBlock(state, op) : null;
        if (b === null) {
          ctx.err(`lsblk: ${op}: not a block device\n`);
          code = 32;
          continue;
        }
        if (b.part !== null && b.part !== undefined) onlyPart = b.part;
        if (!disks.includes(b.disk)) disks.push(b.disk);
      }
      if (disks.length === 0) return code;
    }
    const rows: LsblkRow[] = [];
    const tree = !o.flags.has("l");
    for (const disk of disks) {
      if (onlyPart !== null && disk.partitions.includes(onlyPart)) {
        const part = onlyPart;
        rows.push({ block: DisksLib.allBlocks(state).find((b) => b.part === part)!, prefix: "" });
        continue;
      }
      rows.push({ block: { path: `/dev/${disk.name}`, name: disk.name, disk, dev: disk }, prefix: "" });
      if (o.flags.has("d")) continue;
      for (let i = 0; i < disk.partitions.length; i++) {
        const p = disk.partitions[i]!;
        const prefix = tree ? branch(i === disk.partitions.length - 1) : "";
        rows.push({ block: { path: `/dev/${p.name}`, name: p.name, disk, part: p, dev: p }, prefix });
      }
    }
    const full = o.flags.has("p");
    const tbl = rows.map((r) => names.map((n) => cols.get(n)!.get(r, full)));
    if (!o.flags.has("n")) tbl.unshift([...names]);
    ctx.out(table(tbl, names.map((n) => cols.get(n)!.align)));
    return code;
  },
};
