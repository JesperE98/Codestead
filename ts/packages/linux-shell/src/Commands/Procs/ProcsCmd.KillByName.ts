// Port of Commands/Procs/ProcsCmd.KillByName.cs – the killall, pkill and pgrep commands.

import * as ProcsLib from "../../Procs/ProcsLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { arg, parseSignal, signalProc, snapshot } from "./ProcsCmd.js";

const regexSpecialRe = /[.*+?^${}()|[\]\\]/g;

/** name: 'killall' | 'pkill' | 'pgrep' */
export function byName(name: string): CommandDef {
  const summaries = new Map<string, string>([
    ["killall", "Avslutar alla processer med ett visst namn"],
    ["pkill", "Avslutar processer vars namn matchar ett mönster"],
    ["pgrep", "Visar PID för processer vars namn matchar ett mönster"],
  ]);
  const options =
    name === "pgrep" ? "\n       -l        visa även processens namn\n       -a        visa hela kommandoraden" : "\n       -9        skicka SIGKILL i stället för SIGTERM";
  return {
    name,
    summary: summaries.get(name)!,
    man: `NAMN
       ${name} - ${summaries.get(name)!.toLowerCase()}

SYNOPSIS
       ${name} [-SIGNAL] ${name === "killall" ? "NAMN" : "MÖNSTER"}

FLAGGOR${options}
       -u ANV    bara processer som tillhör ANV

EXEMPEL
       ${name} ${name === "killall" ? "firefox" : "myserver"}`,
    run: (ctx) => {
      const args = [...ctx.args];
      let signal = 15;
      let user: string | null = null;
      let list = false;
      let full = false;
      const rest: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i]!;
        if (a === "-u") user = arg(args, ++i);
        else if (a === "-l" && name === "pgrep") list = true;
        else if (a === "-a" && name === "pgrep") full = true;
        else if (a.startsWith("-") && name !== "pgrep") {
          const s = parseSignal(a);
          if (s === null) return UtilCmd.badOption(ctx, `invalid option -- '${a.slice(1)}'`);
          signal = s;
        } else rest.push(a);
      }
      const pattern = arg(rest, 0);
      if (pattern === null || pattern === "") {
        ctx.err(name === "killall" ? "Usage: killall [OPTION]... [--] NAME...\n" : `${name}: no matching criteria specified\n`);
        return 2;
      }
      let re: RegExp;
      try {
        re = name === "killall" ? new RegExp(`^${pattern.replace(regexSpecialRe, "\\$&")}$`) : new RegExp(pattern);
      } catch (e) {
        if (!(e instanceof SyntaxError)) throw e;
        ctx.err(`${name}: invalid regular expression\n`);
        return 2;
      }
      const matches = snapshot(ctx).filter((p) => re.test(ProcsLib.procName(p)) && (user === null || p.user === user) && p.pid !== ProcsLib.ShellPid);
      if (name === "pgrep") {
        for (const p of matches) ctx.out(full ? `${p.pid} ${p.cmd}\n` : list ? `${p.pid} ${ProcsLib.procName(p)}\n` : `${p.pid}\n`);
        return matches.length > 0 ? 0 : 1;
      }
      if (matches.length === 0) {
        if (name === "killall") ctx.err(`${pattern}: no process found\n`);
        return 1;
      }
      let ok = false;
      for (const p of matches) {
        const report =
          name === "killall"
            ? (msg: string) => ctx.err(`${ProcsLib.procName(p)}(${p.pid}): ${msg}\n`)
            : (msg: string) => ctx.err(`pkill: killing pid ${p.pid} failed: ${msg}\n`);
        if (signalProc(ctx, p, signal, report)) ok = true;
      }
      return ok ? 0 : 1;
    },
  };
}
