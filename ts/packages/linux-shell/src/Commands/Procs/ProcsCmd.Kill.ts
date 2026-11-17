// Port of Commands/Procs/ProcsCmd.Kill.cs – the kill command: sends a signal to a process (ends it).

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { arg, digitsRe, parseSignal, signalProc } from "./ProcsCmd.js";

export const kill: CommandDef = {
  name: "kill",
  builtin: true,
  summary: "Skickar en signal till en process (avslutar den)",
  man: `NAMN
       kill - skicka en signal till en process

SYNOPSIS
       kill [-SIGNAL] PID...
       kill %JOBB
       kill -l

BESKRIVNING
       Som standard skickas SIGTERM (15), som ber processen avsluta sig
       snyggt. Om den inte lyssnar kan du skicka SIGKILL (9), som tvingar
       den att sluta direkt – men då hinner den inte städa efter sig.

       Du kan bara skicka signaler till dina egna processer. För andra
       användares processer behövs sudo.

SIGNALER
       1  HUP    läs om inställningarna (för många tjänster)
       2  INT    samma som Ctrl+C
       9  KILL   tvinga processen att avsluta
       15 TERM   be processen avsluta (standard)

EXEMPEL
       kill 3141
       kill -9 3141
       kill %1`,
  run: (ctx) => {
    const args = [...ctx.args];
    if (arg(args, 0) === "-l" || arg(args, 0) === "-L") {
      ctx.out(" 1) SIGHUP\t 2) SIGINT\t 3) SIGQUIT\t 9) SIGKILL\n10) SIGUSR1\t12) SIGUSR2\t15) SIGTERM\t18) SIGCONT\n19) SIGSTOP\n");
      return 0;
    }
    let signal = 15;
    const first = arg(args, 0);
    if (first === "-s" || first === "-n") {
      args.shift();
      const next = args.length > 0 ? args[0]! : "";
      if (args.length > 0) args.shift();
      const s = parseSignal(next);
      if (s === null) return UtilCmd.badOption(ctx, "invalid signal specification");
      signal = s;
    } else if (first !== null && first.startsWith("-") && first !== "--") {
      args.shift();
      const s = parseSignal(first);
      if (s === null) {
        ctx.err(`bash: kill: ${ctx.args[0]!.slice(1)}: invalid signal specification\n`);
        return 1;
      }
      signal = s;
    }
    if (arg(args, 0) === "--") args.shift();
    if (args.length === 0) {
      ctx.err("kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]\n");
      return 2;
    }
    const sh = ctx.sh;
    sh.refreshJobs();
    let code = 0;
    for (const target of args) {
      let pid: number;
      if (target.startsWith("%")) {
        const spec = target.slice(1);
        const job = spec === "" || spec === "%" || spec === "+" ? (sh.proc.jobs.at(-1) ?? null) : (sh.proc.jobs.find((j) => Js.num(j.id) === spec) ?? null);
        if (job === null || job.state !== "Running") {
          ctx.err(`bash: kill: ${target}: no such job\n`);
          code = 1;
          continue;
        }
        pid = job.pid;
      } else if (digitsRe.test(target)) {
        pid = Js.number(target);
      } else {
        ctx.err(`bash: kill: ${target}: arguments must be process or job IDs\n`);
        code = 1;
        continue;
      }
      const proc = sh.proc.procs.find((p) => p.pid === pid) ?? null;
      if (proc === null) {
        ctx.err(`bash: kill: (${Js.num(pid)}) - No such process\n`);
        code = 1;
        continue;
      }
      if (!signalProc(ctx, proc, signal, (msg) => ctx.err(`bash: kill: (${Js.num(pid)}) - ${msg}\n`))) code = 1;
    }
    return code;
  },
};
