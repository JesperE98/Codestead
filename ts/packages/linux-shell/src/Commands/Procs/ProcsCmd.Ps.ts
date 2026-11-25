// Port of Commands/Procs/ProcsCmd.Ps.cs – the ps command: shows processes.

import { Js } from "../../Js.js";
import type { Proc } from "../../Procs/Proc.js";
import * as ProcsLib from "../../Procs/ProcsLib.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UsersLib from "../../Users/UsersLib.js";
import { arg, jsRound, sign, snapshot } from "./ProcsCmd.js";

const bsdStyleRe = /^-?[aux]+$/;
const bsdFormatRe = /^[aux]*o$/;
const axRe = /[ax]/;
const sortSignRe = /^[-+]/;
const listSepRe = /[\s,]+/;

function fmtTime(t: string): string {
  const parts = t.split(":").map((x) => Js.number(x));
  const m = parts.length > 0 ? parts[0]! : NaN;
  const s = parts.length > 1 ? parts[1]! : NaN;
  return `${Js.num(Math.floor(m / 60)).padStart(2, "0")}:${Js.num(m % 60).padStart(2, "0")}:${Js.num(s).padStart(2, "0")}`;
}

/** A comma- or space-separated list (-u root,elev, -p 1,812, -o pid,cmd). */
function listArg(value: string | null): string[] {
  return (value ?? "").split(listSepRe).filter((x) => x !== "");
}

/** Like procps: an error, then the short usage text, exit code 1. */
function procpsError(ctx: CmdCtx, error: string): number {
  ctx.err(
    `error: ${error}\n\nUsage:\n ps [options]\n\n Try 'ps --help <simple|list|output|threads|misc|all>'\n  or 'ps --help <s|l|o|t|m|a>'\n for additional help text.\n\nFor more details see ps(1).\n`,
  );
  return 1;
}

/** A user name in a column of the given width: like procps, a longer name is cut and ends with "+" (message+). */
function userName(name: string, width: number): string {
  return name.length > width ? name.slice(0, width - 1) + "+" : name;
}

/** The kernel's name of the command (comm): the program's file name, at most 15 characters. */
function commName(p: Proc): string {
  return ProcsLib.procName(p).slice(0, 15);
}

/** The C column: the CPU usage as a whole number, at most 99 (procps). */
function cValue(p: Proc): string {
  return Js.num(Math.min(99, jsRound(p.cpu)));
}

/** The seconds since the process started (it started today at p.start, "HH:MM" – or yesterday, if that is later). */
function elapsedSeconds(p: Proc): number {
  const [h, m] = p.start.split(":").map((x) => Js.number(x));
  const now = Js.localNow();
  const secs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() - ((h ?? 0) * 3600 + (m ?? 0) * 60);
  return secs < 0 ? secs + 86_400 : secs;
}

/** etime: [[dd-]hh:]mm:ss */
function fmtElapsed(secs: number): string {
  const d = Math.floor(secs / 86_400);
  const h = Math.floor((secs % 86_400) / 3600);
  const mm = `${Js.pad2(Math.floor((secs % 3600) / 60))}:${Js.pad2(secs % 60)}`;
  return d > 0 ? `${Js.num(d)}-${Js.pad2(h)}:${mm}` : h > 0 ? `${Js.pad2(h)}:${mm}` : mm;
}

interface ColumnDef {
  header: string;
  width: number;
  /** Left-aligned columns are cut to the width (unless last); right-aligned ones are padded on the left. */
  left: boolean;
  value: (p: Proc, ctx: CmdCtx, width: number) => string;
}

const userCol = (header: string): ColumnDef => ({ header, width: 8, left: true, value: (p, _c, w) => userName(p.user, w) });
const uidCol = (header: string): ColumnDef => ({
  header,
  width: 5,
  left: false,
  value: (p, ctx) => Js.num(UsersLib.findUser(ctx.sh, p.user)?.uid ?? 0),
});
const cmdCol = (header: string): ColumnDef => ({ header, width: 27, left: true, value: (p) => p.cmd });
const commCol = (header: string): ColumnDef => ({ header, width: 15, left: true, value: (p) => commName(p) });

/** The columns -o knows: the ones the course can use, with procps's headers and widths. */
const psColumns = new Map<string, ColumnDef>([
  ["pid", { header: "PID", width: 7, left: false, value: (p) => Js.num(p.pid) }],
  ["ppid", { header: "PPID", width: 7, left: false, value: (p) => Js.num(p.ppid) }],
  ["user", userCol("USER")],
  ["uname", userCol("USER")],
  ["euser", userCol("EUSER")],
  ["ruser", userCol("RUSER")],
  ["uid", uidCol("UID")],
  ["euid", uidCol("EUID")],
  ["ruid", uidCol("RUID")],
  ["comm", commCol("COMMAND")],
  ["ucomm", commCol("COMMAND")],
  ["ucmd", commCol("CMD")],
  ["cmd", cmdCol("CMD")],
  ["args", cmdCol("COMMAND")],
  ["command", cmdCol("COMMAND")],
  ["%cpu", { header: "%CPU", width: 4, left: false, value: (p) => Js.toFixed(p.cpu, 1) }],
  ["pcpu", { header: "%CPU", width: 4, left: false, value: (p) => Js.toFixed(p.cpu, 1) }],
  ["%mem", { header: "%MEM", width: 4, left: false, value: (p) => Js.toFixed(p.mem, 1) }],
  ["pmem", { header: "%MEM", width: 4, left: false, value: (p) => Js.toFixed(p.mem, 1) }],
  ["c", { header: "C", width: 2, left: false, value: (p) => cValue(p) }],
  ["stat", { header: "STAT", width: 4, left: true, value: (p) => p.stat }],
  ["s", { header: "S", width: 1, left: true, value: (p) => p.stat.slice(0, 1) }],
  ["state", { header: "S", width: 1, left: true, value: (p) => p.stat.slice(0, 1) }],
  ["tty", { header: "TT", width: 8, left: true, value: (p) => p.tty }],
  ["tt", { header: "TT", width: 8, left: true, value: (p) => p.tty }],
  ["tname", { header: "TTY", width: 8, left: true, value: (p) => p.tty }],
  ["time", { header: "TIME", width: 8, left: false, value: (p) => fmtTime(p.time) }],
  ["cputime", { header: "TIME", width: 8, left: false, value: (p) => fmtTime(p.time) }],
  ["etime", { header: "ELAPSED", width: 11, left: false, value: (p) => fmtElapsed(elapsedSeconds(p)) }],
  ["etimes", { header: "ELAPSED", width: 7, left: false, value: (p) => Js.num(elapsedSeconds(p)) }],
  ["stime", { header: "STIME", width: 5, left: true, value: (p) => p.start }],
  ["start_time", { header: "START", width: 5, left: true, value: (p) => p.start }],
  ["start", { header: "STARTED", width: 8, left: false, value: (p) => p.start + ":00" }],
  ["vsz", { header: "VSZ", width: 6, left: false, value: (p) => Js.num(p.vsz) }],
  ["vsize", { header: "VSZ", width: 6, left: false, value: (p) => Js.num(p.vsz) }],
  ["rss", { header: "RSS", width: 5, left: false, value: (p) => Js.num(p.rss) }],
  ["rssize", { header: "RSS", width: 5, left: false, value: (p) => Js.num(p.rss) }],
  ["rsz", { header: "RSZ", width: 5, left: false, value: (p) => Js.num(p.rss) }],
  ["ni", { header: "NI", width: 3, left: false, value: () => "0" }],
  ["nice", { header: "NI", width: 3, left: false, value: () => "0" }],
  ["pri", { header: "PRI", width: 3, left: false, value: () => "19" }],
]);

interface Column {
  def: ColumnDef;
  header: string;
  width: number;
}

/** The -o lists ("pid,cmd", "pid=", "user=Owner"), or procps's error for a name it doesn't know. */
function parseFormat(specs: string[]): Column[] | string {
  const columns: Column[] = [];
  for (const spec of specs) {
    for (const item of listArg(spec)) {
      const eq = item.indexOf("=");
      const name = eq < 0 ? item : item.slice(0, eq);
      const def = psColumns.get(name);
      if (def === undefined) return `unknown user-defined format specifier "${name}"`;
      const header = eq < 0 ? def.header : item.slice(eq + 1);
      columns.push({ def, header, width: Math.max(def.width, header.length) });
    }
  }
  return columns;
}

/** One line of -o columns: the last column is not padded or cut on the right (procps). */
function formatLine(columns: Column[], cells: string[]): string {
  return cells
    .map((cell, i) => {
      const col = columns[i]!;
      const last = i === columns.length - 1;
      if (!col.def.left) return cell.padStart(col.width);
      return last ? cell : cell.slice(0, col.width).padEnd(col.width);
    })
    .join(" ");
}

function printColumns(ctx: CmdCtx, columns: Column[], procs: Proc[]): void {
  // ps -o pid= -o comm= shows no header line at all.
  if (columns.some((c) => c.header !== "")) ctx.out(formatLine(columns, columns.map((c) => c.header)) + "\n");
  for (const p of procs) {
    ctx.out(formatLine(columns, columns.map((c, i) => c.def.value(p, ctx, i === columns.length - 1 ? Number.MAX_SAFE_INTEGER : c.width))) + "\n");
  }
}

export const ps: CommandDef = {
  name: "ps",
  summary: "Visar processer",
  man: `NAMN
       ps - visa en ögonblicksbild av processerna

SYNOPSIS
       ps [FLAGGOR]

BESKRIVNING
       Utan flaggor visas bara processerna i din egen terminal.

FLAGGOR
       aux              alla processer, med användare, CPU och minne (BSD-stil)
       -ef              alla processer med förälderns PID (PPID)
       -f               fullt format (med PPID) för processerna i din terminal
       -u ANVÄNDARE     bara processer som tillhör ANVÄNDARE
       -p PID           bara processen med PID
       -C NAMN          bara processer vars program heter NAMN
       -o KOLUMNER      välj kolumnerna själv, t.ex. -o pid,ppid,user,comm
                        (även cmd, args, %cpu, %mem, stat, etime, time, tty);
                        pid= utan rubrik. -eo visar alla processer.
       --sort=-%cpu     sortera efter CPU-användning, störst först
                        (även -%mem, pid, -pid)

KOLUMNER
       PID   processens id-nummer
       %CPU  hur mycket av processorn processen använder
       STAT  R = kör, S = sover, s = sessionsledare, + = i förgrunden
       TTY   terminalen processen hör till (? = ingen)

EXEMPEL
       ps aux | grep sshd
       ps aux --sort=-%cpu | head -5
       ps -eo pid,ppid,comm
       ps -o comm= -p 1`,
  run: (ctx) => {
    const args = [...ctx.args];
    let style = "short"; // 'short' | 'bsd' | 'full'
    let all = false;
    const users: string[] = [];
    const pids: number[] = [];
    const names: string[] = [];
    let format: string[] | null = null;
    let sort: string | null = null;
    const addFormat = (spec: string | null): string | null => {
      if (spec === null || spec === "") return "format specification must follow -o";
      (format ??= []).push(spec);
      return null;
    };
    for (let i = 0; i < args.length; i++) {
      const a = args[i]!;
      let error: string | null = null;
      if (a === "U") users.push(...listArg(arg(args, ++i)));
      else if (a === "p") pids.push(...listArg(arg(args, ++i)).map((x) => Js.number(x)));
      else if (bsdFormatRe.test(a)) {
        if (axRe.test(a)) all = true;
        error = addFormat(arg(args, ++i));
      } else if (bsdStyleRe.test(a) && axRe.test(a)) {
        all = true;
        style = a.includes("u") ? "bsd" : "full";
      } else if (a.startsWith("--sort=")) sort = a.slice(7);
      else if (a === "--sort") sort = arg(args, ++i);
      else if (a.startsWith("--format=")) error = addFormat(a.slice(9));
      else if (a === "--format") error = addFormat(arg(args, ++i));
      else if (a.startsWith("--")) error = "unknown gnu long option";
      else if (a.startsWith("-") && a.length > 1) {
        // SysV options can be put together (-ef, -eo pid,cmd, -fp 1); -o, -u, -p and -C take the rest of the
        // word or the next word.
        for (let j = 1; j < a.length && error === null; j++) {
          const c = a[j]!;
          if (c === "e" || c === "A") all = true;
          else if (c === "f" || c === "F") style = "full";
          else if (c === "o" || c === "u" || c === "p" || c === "C") {
            const value = j + 1 < a.length ? a.slice(j + 1) : arg(args, ++i);
            if (c === "o") error = addFormat(value);
            else if (value === null) error = c === "p" ? "list of process IDs must follow -p" : c === "u" ? "list of users must follow -u" : "list of command names must follow -C";
            else if (c === "u") users.push(...listArg(value));
            else if (c === "p") pids.push(...listArg(value).map((x) => Js.number(x)));
            else names.push(...listArg(value));
            break;
          } else error = "unsupported SysV option";
        }
      } else error = "unsupported option (BSD syntax)";
      if (error !== null) return procpsError(ctx, error);
    }
    const columns = format === null ? null : parseFormat(format);
    if (typeof columns === "string") return procpsError(ctx, columns);
    const selected = users.length > 0 || pids.length > 0 || names.length > 0;
    let procs = snapshot(ctx, `ps ${ctx.args.join(" ")}`.trim());
    // Without -e, -A, a or x, ps shows only the processes of your own terminal – unless you choose processes
    // with -u, -p or -C (a process is shown if it matches any of them).
    if (!all) {
      procs = selected
        ? procs.filter((p) => users.includes(p.user) || pids.includes(p.pid) || names.includes(commName(p)))
        : procs.filter((p) => p.tty === "pts/0");
    }
    if (sort !== null && sort !== "") {
      const desc = sort.startsWith("-");
      const key = sort.replace(sortSignRe, "");
      const val = (p: Proc): number => (key === "%cpu" || key === "pcpu" ? p.cpu : key === "%mem" || key === "pmem" ? p.mem : p.pid);
      procs.sort((a, b) => sign(desc ? val(b) - val(a) : val(a) - val(b)));
    }
    if (columns !== null) printColumns(ctx, columns, procs);
    else if (style === "short" && !all && !selected) {
      ctx.out("    PID TTY          TIME CMD\n");
      for (const p of procs) ctx.out(`${Js.num(p.pid).padStart(7)} ${p.tty.padEnd(8)} ${fmtTime(p.time)} ${ProcsLib.procName(p)}\n`);
    } else if (style !== "bsd") {
      ctx.out("UID          PID    PPID  C STIME TTY          TIME CMD\n");
      for (const p of procs) {
        ctx.out(
          `${userName(p.user, 8).padEnd(8)} ${Js.num(p.pid).padStart(7)} ${Js.num(p.ppid).padStart(7)} ${cValue(p).padStart(2)} ${p.start} ${p.tty.padEnd(8)} ${fmtTime(p.time)} ${p.cmd}\n`,
        );
      }
    } else {
      ctx.out("USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n");
      for (const p of procs) {
        ctx.out(
          `${userName(p.user, 8).padEnd(8)} ${Js.num(p.pid).padStart(7)} ${Js.toFixed(p.cpu, 1).padStart(4)} ${Js.toFixed(p.mem, 1).padStart(4)} ${Js.num(p.vsz).padStart(6)} ${Js.num(p.rss).padStart(5)} ${p.tty.padEnd(8)} ${p.stat.padEnd(4)} ${p.start} ${p.time.padStart(6)} ${p.cmd}\n`,
        );
      }
    }
    return 0;
  },
};
