// Port of Procs/ProcState.cs – process table: the saved processes and jobs.

import type { Job } from "./Job.js";
import type { Proc } from "./Proc.js";

export interface ProcState {
  procs: Proc[];
  jobs: Job[];
  nextPid: number;
}
