// Port of Procs/Proc.cs – process table: one process.

export interface Proc {
  pid: number;
  ppid: number;
  user: string;
  /** The whole command line, e.g. "/usr/sbin/sshd -D". */
  cmd: string;
  cpu: number;
  mem: number;
  vsz: number;
  rss: number;
  tty: string;
  stat: string;
  start: string;
  time: string;
}
