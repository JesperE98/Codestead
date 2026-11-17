// Port of Services/UnitRt.cs – systemd model: the run state of one loaded unit (service).

export interface UnitRt {
  name: string;
  /** The unit file that was loaded. */
  path: string;
  /** The unit file's content at the last load (daemon-reload). */
  loaded: string;
  /** "active", "inactive" or "failed". */
  active: string;
  /** "running", "dead", "exited" or "failed". */
  sub: string;
  /** When the state last changed. */
  since?: number | null;
  /** When the service last started (for "Duration"). */
  startedAt?: number | null;
  /** The main process while the service runs. */
  pid?: number | null;
  /** The latest main process, after the service stopped. */
  lastPid?: number | null;
  /** Why the service failed, e.g. "exit-code". */
  result?: string | null;
  /** E.g. "code=exited, status=1/FAILURE". */
  exitInfo?: string | null;
}
