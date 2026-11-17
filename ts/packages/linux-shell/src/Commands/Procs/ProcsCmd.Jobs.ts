// Port of Commands/Procs/ProcsCmd.Jobs.cs – the jobs command: shows the background jobs in this terminal.

import type { Job } from "../../Procs/Job.js";
import type { CommandDef } from "../../Types/CommandDef.js";

function jobLine(job: Job, last: boolean, long: boolean): string {
  const state = job.state === "Running" ? "Running" : job.state;
  return `[${job.id}]${last ? "+" : "-"}  ${long ? job.pid + " " : ""}${state.padEnd(24)}${job.cmd}${job.state === "Running" ? " &" : ""}\n`;
}

export const jobs: CommandDef = {
  name: "jobs",
  builtin: true,
  summary: "Visar bakgrundsjobb i den här terminalen",
  man: `NAMN
       jobs - visa jobb som startats från den här terminalen

SYNOPSIS
       jobs [-l]

BESKRIVNING
       Ett jobb startas i bakgrunden genom att skriva & efter kommandot,
       t.ex. "sleep 300 &". Jobben numreras [1], [2] ... och kan anges som
       %1, %2 till kill, fg och bg.

FLAGGOR
       -l    visa även PID`,
  run: (ctx) => {
    const sh = ctx.sh;
    sh.refreshJobs();
    const list = sh.proc.jobs;
    for (let i = 0; i < list.length; i++) ctx.out(jobLine(list[i]!, i === list.length - 1, ctx.args.includes("-l")));
    return 0;
  },
};
