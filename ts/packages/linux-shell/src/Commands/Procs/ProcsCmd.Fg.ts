// Port of Commands/Procs/ProcsCmd.Fg.cs – the fg command: moves a background job to the foreground.

import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { pickJob } from "./ProcsCmd.js";

export const fg: CommandDef = {
  name: "fg",
  builtin: true,
  summary: "Flyttar ett bakgrundsjobb till förgrunden",
  man: `NAMN
       fg - flytta ett jobb till förgrunden

SYNOPSIS
       fg [%JOBB]

BESKRIVNING
       Jobbet tar över terminalen tills det är klart. I en riktig terminal
       kan du skicka tillbaka det till bakgrunden med Ctrl+Z följt av bg.`,
  run: (ctx) => {
    const job = pickJob(ctx);
    if (job === null) return 1;
    ctx.out(job.cmd + "\n");
    if (job.state === "Running") {
      ctx.out(`${UtilCmd.Color.dim}(${ctx.sh.msg("procs.fgJobDone")})${UtilCmd.Color.reset}\n`);
      ctx.sh.finishJob(job, "Done");
    }
    ctx.sh.proc.jobs = ctx.sh.proc.jobs.filter((j) => j !== job);
    return 0;
  },
};
