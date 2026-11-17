// Port of Commands/Procs/ProcsCmd.Wait.cs – the wait command: waits until the background jobs are done.

import type { CommandDef } from "../../Types/CommandDef.js";

export const wait: CommandDef = {
  name: "wait",
  builtin: true,
  summary: "Väntar tills bakgrundsjobben är klara",
  man: `NAMN
       wait - vänta på att bakgrundsjobb blir klara

BESKRIVNING
       Används i skript som startar flera saker parallellt med & och
       sedan behöver vänta in dem. I simulatorn blir jobben klara direkt.`,
  run: (ctx) => {
    for (const job of [...ctx.sh.proc.jobs]) if (job.state === "Running") ctx.sh.finishJob(job, "Done");
    ctx.sh.proc.jobs = [];
    return 0;
  },
};
