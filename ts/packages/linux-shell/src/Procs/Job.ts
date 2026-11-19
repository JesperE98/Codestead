// Port of Procs/Job.cs – process table: a background job started by the student.

export interface Job {
  id: number;
  pid: number;
  cmd: string;
  /** "Running", "Done", "Terminated" or "Killed". */
  state: string;
  /** When a `sleep` job finishes (ms since 1970). */
  endsAt?: number | null;
  exit?: number | null;
}
