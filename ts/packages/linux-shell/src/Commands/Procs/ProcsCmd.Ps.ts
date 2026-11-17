// Port of Commands/Procs/ProcsCmd.Ps.cs – the ps command: shows processes.

import { Js } from "../../Js.js";
import type { Proc } from "../../Procs/Proc.js";
import * as ProcsLib from "../../Procs/ProcsLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { arg, jsRound, sign, snapshot } from "./ProcsCmd.js";

const bsdStyleRe = /^-?[aux]+$/;
const axRe = /[ax]/;
const sortSignRe = /^[-+]/;

function fmtTime(t: string): string {
  const parts = t.split(":").map((x) => Js.number(x));
  const m = parts.length > 0 ? parts[0]! : NaN;
  const s = parts.length > 1 ? parts[1]! : NaN;
  return `${Js.num(Math.floor(m / 60)).padStart(2, "0")}:${Js.num(m % 60).padStart(2, "0")}:${Js.num(s).padStart(2, "0")}`;
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
       -u ANVÄNDARE     bara processer som tillhör ANVÄNDARE
       -p PID           bara processen med PID
       --sort=-%cpu     sortera efter CPU-användning, störst först
                        (även -%mem, pid, -pid)

KOLUMNER
       PID   processens id-nummer
       %CPU  hur mycket av processorn processen använder
       STAT  R = kör, S = sover, s = sessionsledare, + = i förgrunden
       TTY   terminalen processen hör till (? = ingen)

EXEMPEL
       ps aux | grep sshd
       ps aux --sort=-%cpu | head -5`,
  run: (ctx) => {
    const args = [...ctx.args];
    let style = "short"; // 'short' | 'bsd' | 'full'
    let user: string | null = null;
    let pid: number | null = null;
    let sort: string | null = null;
    for (let i = 0; i < args.length; i++) {
      const a = args[i]!;
      if (a === "-u" || a === "U") user = arg(args, ++i);
      else if (bsdStyleRe.test(a) && axRe.test(a)) style = a.includes("u") ? "bsd" : "full";
      else if (["-ef", "-e", "-A", "-f", "-eF"].includes(a)) style = "full";
      else if (a === "-p" || a === "p") pid = Js.number(arg(args, ++i));
      else if (a.startsWith("--sort=")) sort = a.slice(7);
      else if (a === "--sort") sort = arg(args, ++i);
      else return UtilCmd.badOption(ctx, `unsupported option (BSD syntax) '${a}'`);
    }
    let procs = snapshot(ctx, `ps ${ctx.args.join(" ")}`.trim());
    if (style === "short" && user === null && pid === null) procs = procs.filter((p) => p.tty === "pts/0");
    if (user !== null) procs = procs.filter((p) => p.user === user);
    if (pid !== null) {
      const wanted = pid;
      procs = procs.filter((p) => p.pid === wanted);
    }
    if (sort !== null && sort !== "") {
      const desc = sort.startsWith("-");
      const key = sort.replace(sortSignRe, "");
      const val = (p: Proc): number => (key === "%cpu" || key === "pcpu" ? p.cpu : key === "%mem" || key === "pmem" ? p.mem : p.pid);
      procs.sort((a, b) => sign(desc ? val(b) - val(a) : val(a) - val(b)));
    }
    if (style === "short" && user === null && pid === null) {
      ctx.out("    PID TTY          TIME CMD\n");
      for (const p of procs) ctx.out(`${Js.num(p.pid).padStart(7)} ${p.tty.padEnd(8)} ${fmtTime(p.time)} ${ProcsLib.procName(p)}\n`);
    } else if (style === "full" || (style === "short" && (user !== null || pid !== null))) {
      ctx.out("UID          PID    PPID  C STIME TTY          TIME CMD\n");
      for (const p of procs) {
        ctx.out(
          `${p.user.padEnd(8)} ${Js.num(p.pid).padStart(7)} ${Js.num(p.ppid).padStart(7)} ${Js.num(jsRound(p.cpu)).padStart(2)} ${p.start} ${p.tty.padEnd(8)} ${fmtTime(p.time)} ${p.cmd}\n`,
        );
      }
    } else {
      ctx.out("USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n");
      for (const p of procs) {
        ctx.out(
          `${p.user.padEnd(10)} ${Js.num(p.pid).padStart(5)} ${Js.toFixed(p.cpu, 1).padStart(4)} ${Js.toFixed(p.mem, 1).padStart(4)} ${Js.num(p.vsz).padStart(6)} ${Js.num(p.rss).padStart(5)} ${p.tty.padEnd(8)} ${p.stat.padEnd(4)} ${p.start} ${p.time.padStart(6)} ${p.cmd}\n`,
        );
      }
    }
    return 0;
  },
};
