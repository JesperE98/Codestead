// Port of Commands/Disks/DisksCmd.Df.cs – the df command: shows free and used space on file systems.

import * as DisksLib from "../../Disks/DisksLib.js";
import type { Mount } from "../../Disks/Mount.js";
import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { long, table } from "./DisksCmd.js";

const dfMan = `NAMN
       df - visa ledigt och använt utrymme på filsystemen (disk free)

SYNOPSIS
       df [FLAGGA]... [FIL]...

BESKRIVNING
       Visar storlek, använt och ledigt utrymme för varje monterat
       filsystem. Med FIL visas bara filsystemet som filen ligger på.

       Kolumnen "Mounted on" är monteringspunkten: var i katalogträdet
       filsystemet syns. På ext4 reserveras 5 % åt root, därför blir
       Used + Avail lite mindre än Size.

FLAGGOR
       -h, --human-readable   läsbara storlekar (1.6M, 49G)
       -T, --print-type       visa filsystemets typ (ext4, vfat, tmpfs ...)
       -t, --type=TYP         visa bara filsystem av typen TYP
       -x, --exclude-type=TYP visa inte filsystem av typen TYP
       -a, --all              visa även låtsasfilsystem som proc och sysfs

EXEMPEL
       df -h                  allt, med läsbara storlekar
       df -hT                 med typen
       df -h ~                hur mycket plats finns där hemkatalogen ligger?
       df -h -x tmpfs         bara riktiga diskar`;

const dfManEn = `NAME
       df - report file system disk space usage (disk free)

SYNOPSIS
       df [OPTION]... [FILE]...

DESCRIPTION
       Shows size, used and available space for every mounted file
       system. With FILE, only the file system that FILE is on is shown.

       The "Mounted on" column is the mount point: where in the directory
       tree the file system appears. ext4 reserves 5 % for root, so
       Used + Avail is a little less than Size.

OPTIONS
       -h, --human-readable   human-readable sizes (1.6M, 49G)
       -T, --print-type       show the file system type (ext4, vfat, tmpfs ...)
       -t, --type=TYPE        only show file systems of type TYPE
       -x, --exclude-type=TYPE  do not show file systems of type TYPE
       -a, --all              also show pseudo file systems such as proc and sysfs

EXAMPLES
       df -h                  everything, human-readable
       df -hT                 with the type
       df -h ~                how much space is there where my home is?
       df -h -x tmpfs         only real disks`;

/** All values for a flag that may be repeated, e.g. `df -x tmpfs -x devtmpfs`. */
function repeated(args: readonly string[], short: string, longName: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--") break;
    if (a === `-${short}` || a === `--${longName}`) values.push(++i < args.length ? args[i]! : "");
    else if (a.startsWith(`--${longName}=`)) values.push(a.slice(longName.length + 3));
    else if (a.startsWith(`-${short}`) && !a.startsWith("--")) values.push(a.slice(2));
  }
  return values.flatMap((v) => v.split(",")).filter((v) => v !== "");
}

export const df: CommandDef = {
  name: "df",
  summary: "Visar hur mycket plats som finns på filsystemen",
  summaryEn: "Show free and used space on file systems",
  man: dfMan,
  manEn: dfManEn,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "hTakP",
      values: "tx",
      long: long(["human-readable", "h"], ["print-type", "T"], ["all", "a"], ["type", "t"], ["exclude-type", "x"], ["portability", "P"]),
    });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const sh = ctx.sh;
    const state = sh.disks;
    const root = sh.rootUser();
    let code = 0;
    let mounts: Mount[] = [];
    if (o.operands.length > 0) {
      for (const op of o.operands) {
        const block = op.startsWith("/dev/") ? DisksLib.findBlock(state, op) : null;
        const byDev = block !== null ? (DisksLib.mountsOf(state, block.name)[0] ?? null) : null;
        if (byDev !== null) {
          mounts.push(byDev);
          continue;
        }
        const path = sh.resolve(op);
        if (sh.vfs.tryLookup(path, root) === null) {
          ctx.err(`df: ${op}: No such file or directory\n`);
          code = 1;
          continue;
        }
        const m = DisksLib.mountFor(state, path);
        if (m !== null) mounts.push(m);
      }
    } else {
      mounts = state.mounts.filter((m) => o.flags.has("a") || (m.fstype !== "proc" && m.fstype !== "sysfs"));
    }
    const only = repeated(ctx.args, "t", "type");
    const skip = repeated(ctx.args, "x", "exclude-type");
    if (only.length > 0) mounts = mounts.filter((m) => only.includes(m.fstype));
    if (skip.length > 0) mounts = mounts.filter((m) => !skip.includes(m.fstype));
    if (mounts.length === 0) {
      if (code === 0) ctx.err("df: no file systems processed\n");
      return 1;
    }
    const h = o.flags.has("h");
    const T = o.flags.has("T");
    const header = ["Filesystem"];
    if (T) header.push("Type");
    header.push(h ? "Size" : "1K-blocks", "Used", h ? "Avail" : "Available", "Use%", "Mounted on");
    const rows: string[][] = [header];
    for (const m of mounts) {
      const u = DisksLib.mountUsage(sh.vfs, state, m, root);
      const size = Math.floor(u.size / 1024);
      const used = Math.ceil(u.used / 1024);
      const avail = Math.floor(u.avail / 1024);
      const pct = used + avail > 0 ? `${Math.ceil((used * 100) / (used + avail))}%` : "-";
      const fmt = (kb: number): string => (h ? UtilCmd.humanSize(kb * 1024.0) : Js.num(kb));
      const row = [m.source];
      if (T) row.push(m.fstype);
      row.push(fmt(size), fmt(used), fmt(avail), pct, m.target);
      rows.push(row);
    }
    // Minimum column widths as in GNU df.
    const align = ["l"];
    if (T) align.push("l");
    align.push("r", "r", "r", "r", "l");
    const minWidths = [14];
    if (T) minWidths.push(4);
    minWidths.push(5, 5, 5, 4);
    ctx.out(table(rows, align, minWidths));
    return code;
  },
};
