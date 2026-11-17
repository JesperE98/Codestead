// Port of Network/Listener.cs – network model: a listening port (from the process table).

import type { Proc } from "../Procs/Proc.js";

export interface Listener {
  /** "tcp" or "udp". */
  proto: string;
  addr: string;
  port: number;
  proc: Proc;
  fd: number;
}
