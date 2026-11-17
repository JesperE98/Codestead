// Port of Commands/Disks/DisksCmd.Findmnt.cs – the findmnt command: shows mounted file systems as a tree.

import * as DisksLib from "../../Disks/DisksLib.js";
import type { Mount } from "../../Disks/Mount.js";
import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { branch, labelUuidPrefix, long, table, type Column } from "./DisksCmd.js";

const findmntMan = `NAMN
       findmnt - hitta och visa monterade filsystem

SYNOPSIS
       findmnt [FLAGGA]... [KATALOG | ENHET]

BESKRIVNING
       Visar allt som är monterat som ett träd: varje filsystem under
       det som det är monterat i. Med en KATALOG eller ENHET visas bara
       den monteringen.

FLAGGOR
       -l, --list         lista i stället för träd
       -n, --noheadings   ingen rubrikrad
       -t, --types TYP    bara filsystem av typen TYP (t.ex. ext4,vfat)
       -T, --target FIL   filsystemet som FIL ligger på
       -o, --output LISTA kolumner: TARGET,SOURCE,FSTYPE,OPTIONS,UUID,
                          LABEL,SIZE,USED,AVAIL,USE%

EXEMPEL
       findmnt
       findmnt /
       findmnt -t ext4,btrfs,vfat
       findmnt -n -o UUID /`;

const findmntManEn = `NAME
       findmnt - find and show mounted file systems

SYNOPSIS
       findmnt [OPTION]... [DIRECTORY | DEVICE]

DESCRIPTION
       Shows everything that is mounted as a tree: each file system below
       the one it is mounted in. With a DIRECTORY or DEVICE, only that
       mount is shown.

OPTIONS
       -l, --list         list instead of tree
       -n, --noheadings   no header line
       -t, --types TYPE   only file systems of type TYPE (e.g. ext4,vfat)
       -T, --target FILE  the file system that FILE is on
       -o, --output LIST  columns: TARGET,SOURCE,FSTYPE,OPTIONS,UUID,
                          LABEL,SIZE,USED,AVAIL,USE%

EXAMPLES
       findmnt
       findmnt /
       findmnt -t ext4,btrfs,vfat
       findmnt -n -o UUID /`;

export const findmnt: CommandDef = {
  name: "findmnt",
  summary: "Visar monterade filsystem som ett träd",
  summaryEn: "Show mounted file systems as a tree",
  man: findmntMan,
  manEn: findmntManEn,
  run: (ctx) => {
    const o = UtilCmd.parseOpts(ctx.args, {
      flags: "lnr",
      values: "toT",
      long: long(["list", "l"], ["noheadings", "n"], ["raw", "r"], ["types", "t"], ["output", "o"], ["target", "T"]),
    });
    if (o.error !== null) return UtilCmd.badOption(ctx, o.error);
    const sh = ctx.sh;
    const state = sh.disks;
    const root = sh.rootUser();
    const c = (align: string, get: (m: Mount) => string): Column<Mount> => ({ align, get: (m) => get(m) });
    const cols = new Map<string, Column<Mount>>([
      ["TARGET", c("l", (m) => m.target)],
      ["SOURCE", c("l", (m) => (m.subvol !== null && m.subvol !== undefined ? `${m.source}[${m.subvol}]` : m.source))],
      ["FSTYPE", c("l", (m) => m.fstype)],
      ["OPTIONS", c("l", (m) => m.options)],
      ["UUID", c("l", (m) => (m.dev !== null && m.dev !== undefined ? (DisksLib.findBlock(state, m.dev)?.dev.uuid ?? "") : ""))],
      ["LABEL", c("l", (m) => (m.dev !== null && m.dev !== undefined ? (DisksLib.findBlock(state, m.dev)?.dev.label ?? "") : ""))],
      ["SIZE", c("r", (m) => DisksLib.lsblkSize(DisksLib.mountUsage(sh.vfs, state, m, root).size))],
      ["USED", c("r", (m) => DisksLib.lsblkSize(DisksLib.mountUsage(sh.vfs, state, m, root).used))],
      ["AVAIL", c("r", (m) => DisksLib.lsblkSize(DisksLib.mountUsage(sh.vfs, state, m, root).avail))],
      [
        "USE%",
        c("r", (m) => {
          const u = DisksLib.mountUsage(sh.vfs, state, m, root);
          return u.size !== 0 ? `${Js.num(Math.ceil((u.used * 100) / Math.max(1, u.used + u.avail)))}%` : "0%";
        }),
      ],
    ]);
    const names = (o.values.get("o") ?? "TARGET,SOURCE,FSTYPE,OPTIONS")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s !== "");
    for (const n of names) {
      if (!cols.has(n)) {
        ctx.err(`findmnt: unknown column: ${n}\n`);
        return 1;
      }
    }
    let mounts = state.mounts;
    let tree = !o.flags.has("l") && !o.flags.has("r");
    const tVal = o.values.get("t");
    if (tVal !== undefined && tVal !== "") {
      const types = tVal.split(",");
      mounts = mounts.filter((m) => types.includes(m.fstype));
      tree = false;
    }
    const TVal = o.values.get("T");
    const pick = TVal ?? (o.operands.length > 0 ? o.operands[0]! : null);
    if (pick !== null) {
      tree = false;
      if (TVal !== undefined) {
        const m = DisksLib.mountFor(state, sh.resolve(pick));
        mounts = m !== null ? [m] : [];
      } else {
        const b = pick.startsWith("/dev/") || labelUuidPrefix.test(pick) ? DisksLib.findBlock(state, pick) : null;
        const path = sh.resolve(pick);
        mounts = mounts.filter((m) => m.target === path || (b !== null && m.dev === b.name));
      }
    }
    if (mounts.length === 0) return 1;
    const rows: { m: Mount; prefix: string }[] = [];
    if (tree) {
      const all = mounts;
      const parentOf = (m: Mount): Mount | null => {
        let best: Mount | null = null;
        for (const p of all) {
          if (p === m) continue;
          const under = p.target === "/" ? m.target !== "/" : m.target.startsWith(p.target + "/");
          if (under && (best === null || p.target.length > best.target.length)) best = p;
        }
        return best;
      };
      const children = (p: Mount | null): Mount[] => all.filter((m) => parentOf(m) === p);
      const walk = (m: Mount, indent: string, isLast: boolean, top: boolean): void => {
        rows.push({ m, prefix: top ? "" : indent + branch(isLast) });
        const kids = children(m);
        for (let i = 0; i < kids.length; i++) walk(kids[i]!, top ? "" : indent + (isLast ? "  " : "│ "), i === kids.length - 1, false);
      };
      for (const top of children(null)) walk(top, "", true, true);
    } else {
      for (const m of mounts) rows.push({ m, prefix: "" });
    }
    const out = rows.map((r) => names.map((n, i) => (i === 0 && n === "TARGET" ? r.prefix : "") + cols.get(n)!.get(r.m, false)));
    if (!o.flags.has("n")) out.unshift([...names]);
    ctx.out(table(out, names.map((n) => cols.get(n)!.align)));
    return 0;
  },
};
