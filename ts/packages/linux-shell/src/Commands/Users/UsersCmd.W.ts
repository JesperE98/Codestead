// Port of Commands/Users/UsersCmd.W.cs – the w command: shows who is logged on and what they are doing.

import { Js } from "../../Js.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as ProcsCmd from "../Procs/ProcsCmd.js";
import { LoginTime, loginName } from "./UsersCmd.js";

export const w: CommandDef = {
  name: "w",
  summary: "Visar vilka som är inloggade och vad de gör",
  summaryEn: "Show who is logged on and what they are doing",
  man: `NAMN
       w - visa vilka som är inloggade och vad de gör

BESKRIVNING
       Första raden är samma som uptime. Sedan kommer en rad per
       inloggning med kommandot som körs just nu (WHAT).

FLAGGOR
       -h    utan rubrikrader`,
  manEn: `NAME
       w - show who is logged on and what they are doing

DESCRIPTION
       The first line is the same as uptime. Then comes one line per login
       with the command currently running (WHAT).

OPTIONS
       -h    no header lines`,
  run: (ctx) => {
    if (!ctx.args.includes("-h")) {
      const load = ProcsCmd.currentProcs(ctx).reduce((s, p) => s + p.cpu, 0) / 100;
      const now = Js.localNow();
      ctx.out(
        ` ${Js.hhmmss(now)} up  2:14,  1 user,  load average: ${Js.toFixed(load, 2)}, ${Js.toFixed(load * 0.9, 2)}, ${Js.toFixed(load * 0.8, 2)}\n`,
      );
      ctx.out("USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU  WHAT\n");
    }
    ctx.out(`${loginName(ctx.sh).padEnd(8)} pts/0    -                ${LoginTime}    0.00s  0.05s  0.00s ${["w", ...ctx.args].join(" ")}\n`);
    return 0;
  },
};
