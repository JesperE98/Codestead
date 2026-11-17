// Port of Commands/Procs/ProcsCmd.Bg.cs – the bg command: resumes a stopped job in the background.

import type { CommandDef } from "../../Types/CommandDef.js";
import { pickJob } from "./ProcsCmd.js";

export const bg: CommandDef = {
  name: "bg",
  builtin: true,
  summary: "Fortsätter ett stoppat jobb i bakgrunden",
  man: `NAMN
       bg - låt ett stoppat jobb fortsätta i bakgrunden

SYNOPSIS
       bg [%JOBB]

BESKRIVNING
       Används efter att ett program stoppats med Ctrl+Z.`,
  run: (ctx) => {
    const job = pickJob(ctx);
    if (job === null) return 1;
    ctx.err(`bash: bg: job ${job.id} already in background\n`);
    return 0;
  },
};
