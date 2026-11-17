// Port of Commands/Extras/ExtrasCmd.Htop.cs – the htop command: shows processes and resource usage.

import { Js } from "../../Js.js";
import type { Proc } from "../../Procs/Proc.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as ProcsCmd from "../Procs/ProcsCmd.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { note } from "./ExtrasCmd.js";

/** Math.round in JavaScript (halves round up). */
function jsRound(v: number): number {
  return Math.floor(v + 0.5);
}

export const htop: CommandDef = {
  name: "htop",
  summary: "Visar processer och resursanvändning",
  man: `NAMN
       htop - interaktiv processvisare

BESKRIVNING
       Visar CPU, minne och alla processer som körs. I en riktig terminal
       sorterar du med F6, söker med F3, avslutar processer med F9 och
       stänger htop med q eller F10. I simulatorn visas en ögonblicksbild.`,
  run: (ctx) => {
    const procs = [...ProcsCmd.currentProcs(ctx, "htop")].sort((a, b) => {
      const d = b.cpu - a.cpu;
      if (d !== 0) return d < 0 ? -1 : 1;
      return a.pid - b.pid;
    });
    const load = procs.reduce((s, p) => s + p.cpu, 0);
    const bar = (pct: number): string =>
      `[${UtilCmd.Color.green}${Js.repeat("|", jsRound(Math.min(pct, 100) / 4)).padEnd(25)}${UtilCmd.Color.reset}${Js.toFixed(pct, 1).padStart(5)}%]`;
    const mb = (kb: number): string => (kb >= 1024 ? `${Js.toFixed(kb / 1024, 1)}M` : `${Js.num(kb)}K`);
    ctx.out(
      `    0${bar(Math.min(100, load))}   Tasks: ${procs.length}, 1 running\n` +
        `    1${bar(3.2)}   Load average: ${Js.toFixed(load / 100, 2)} ${Js.toFixed((load / 100) * 0.9, 2)} ${Js.toFixed((load / 100) * 0.8, 2)}\n` +
        `  Mem[${UtilCmd.Color.green}||||||||||||             ${UtilCmd.Color.reset}1.84G/7.70G]   Uptime: 02:14:07\n` +
        "  Swp[                             0K/2.00G]\n\n" +
        `\x1b[30;42m    PID USER       PRI  NI  VIRT   RES S CPU% MEM%   TIME+  Command              ${UtilCmd.Color.reset}\n`,
    );
    for (const p of procs) {
      ctx.out(
        `${Js.num(p.pid).padStart(7)} ${p.user.slice(0, 9).padEnd(10)} 20   0 ${mb(p.vsz).padStart(5)} ${mb(p.rss).padStart(5)} ${p.stat[0] ?? ""} ${Js.toFixed(p.cpu, 1).padStart(4)} ${Js.toFixed(p.mem, 1).padStart(4)} ${(p.time + ".00").padStart(8)} ${p.cmd}\n`,
      );
    }
    ctx.out("\nF1Help  F2Setup  F3Search  F4Filter  F5Tree  F6SortBy  F7Nice-  F8Nice+  F9Kill  F10Quit\n");
    note(ctx, ctx.sh.msg("extras.htopSnapshot"));
    return 0;
  },
};
