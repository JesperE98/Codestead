// Port of Commands/Systemd/SystemdCmd.Analyze.cs – the systemd-analyze command: shows how long the boot took.

import { Js } from "../../Js.js";
import * as ServicesLib from "../../Services/ServicesLib.js";
import type { CommandDef } from "../../Types/CommandDef.js";

function fakeMs(name: string): number {
  let h = 0;
  // for (const ch of name) iterates code points; charCodeAt(0) is the first UTF-16 unit. (uint arithmetic in C#.)
  for (const ch of name) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return 20 + (h % 1800);
}

const startupRe = /in (\S+) \(kernel\) \+ (\S+) \(userspace\) = (\S+)\./;

export const analyze: CommandDef = {
  name: "systemd-analyze",
  summary: "Visar hur lång tid uppstarten tog",
  summaryEn: "Show how long the boot took",
  man: `NAMN
       systemd-analyze - analysera uppstarten

SYNOPSIS
       systemd-analyze [time]
       systemd-analyze blame

BESKRIVNING
       Utan argument (eller med time) visas hur lång tid kärnan och
       tjänsterna tog att starta. blame listar tjänsterna med den som tog
       längst tid först – bra för att hitta varför datorn startar långsamt.`,
  manEn: `NAME
       systemd-analyze - analyze the boot

SYNOPSIS
       systemd-analyze [time]
       systemd-analyze blame

DESCRIPTION
       Without arguments (or with time) it shows how long the kernel and
       the services took to start. blame lists the services with the
       slowest first – useful for finding out why the computer boots slowly.`,
  run: (ctx) => {
    const sh = ctx.sh;
    const verb = ctx.args.find((a) => !a.startsWith("-")) ?? "time";
    const cur = ServicesLib.currentBoot(sh);
    if (verb === "time") {
      const line = sh.services.journal.find((e) => e.boot === cur && e.msg.startsWith("Startup finished"))?.msg;
      const m = startupRe.exec(line ?? "");
      const [k, u, total] = m !== null ? [m[1]!, m[2]!, m[3]!] : ["2.153s", "4.871s", "7.024s"];
      ctx.out(`Startup finished in ${k} (kernel) + ${u} (userspace) = ${total} \nmulti-user.target reached after ${u} in userspace.\n`);
      return 0;
    }
    if (verb === "blame") {
      const started: string[] = [];
      const seen = new Set<string>();
      for (const e of sh.services.journal) {
        if (e.boot === cur && e.unit !== null && e.unit !== undefined && e.unit !== "" && e.ident === "systemd" && !seen.has(e.unit)) {
          seen.add(e.unit);
          started.push(e.unit);
        }
      }
      const rows = started.map((name) => ({ name, ms: fakeMs(name) })).sort((a, b) => b.ms - a.ms);
      for (const r of rows) ctx.out(`${(r.ms >= 1000 ? `${Js.toFixed(r.ms / 1000.0, 3)}s` : `${r.ms}ms`).padStart(7)} ${r.name}\n`);
      return 0;
    }
    ctx.err(`Unknown command verb '${verb}'.\n`);
    return 1;
  },
};
