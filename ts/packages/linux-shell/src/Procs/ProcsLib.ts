// Port of Procs/ProcsLib.cs (src/shell/procs.ts) – the process table of the simulated computer: system
// processes, the user's shell, a runaway process to find, and background jobs the student starts.

import type { Distro } from "../Distros/Distro.js";
import type { Proc } from "./Proc.js";
import type { ProcState } from "./ProcState.js";

/** The shell's own process (bash in the terminal). */
export const ShellPid = 1290;
/** The process that eats CPU and that the student should find. */
export const RunawayPid = 3141;
/** The exercise server running as root. */
export const ServerPid = 812;

function p(pid: number, ppid: number, user: string, cmd: string, extra?: (proc: Proc) => void): Proc {
  const proc: Proc = {
    pid,
    ppid,
    user,
    cmd,
    cpu: 0,
    mem: 0.1,
    vsz: 20_000 + ((pid * 7919) % 300_000),
    rss: 4_000 + ((pid * 104_729) % 40_000),
    tty: "?",
    stat: "Ss",
    start: "08:00",
    time: "0:00",
  };
  extra?.(proc);
  return proc;
}

export function initialProcs(distro: Distro, student: string): ProcState {
  const common: Proc[] = [
    p(1, 0, "root", "/sbin/init", (x) => (x.time = "0:02")),
    p(2, 0, "root", "[kthreadd]", (x) => {
      x.stat = "S";
      x.rss = 0;
      x.vsz = 0;
    }),
    p(312, 1, "root", "/usr/lib/systemd/systemd-journald", (x) => (x.mem = 0.3)),
    p(341, 1, "root", "/usr/lib/systemd/systemd-udevd"),
    p(520, 1, "root", "/usr/lib/systemd/systemd-logind"),
  ];
  const family: Proc[] =
    distro.family === "debian"
      ? [
          p(498, 1, "messagebus", "/usr/bin/dbus-daemon --system --address=systemd: --nofork"),
          p(530, 1, "root", "/usr/sbin/cron -f"),
          p(533, 1, "syslog", "/usr/sbin/rsyslogd -n"),
          ...(distro.id === "ubuntu" ? [p(560, 1, "root", "/usr/lib/snapd/snapd", (x) => (x.mem = 0.6))] : []),
        ]
      : distro.family === "arch"
        ? [p(498, 1, "dbus", "/usr/bin/dbus-broker-launch --scope system"), p(531, 1, "root", "/usr/lib/systemd/systemd-timesyncd")]
        : [
            p(498, 1, "dbus", "/usr/bin/dbus-broker-launch --scope system"),
            p(540, 1, "root", "/usr/bin/python3 -sP /usr/sbin/firewalld --nofork --nopid", (x) => (x.mem = 0.5)),
            p(545, 1, "chrony", "/usr/sbin/chronyd -F 2"),
            p(560, 1, "root", "/usr/sbin/NetworkManager --no-daemon", (x) => (x.mem = 0.4)),
          ];
  const procs: Proc[] = [...common, ...family];
  procs.push(p(733, 1, "root", "/usr/sbin/sshd -D"));
  procs.push(
    p(ServerPid, 1, "root", "/usr/local/bin/myserver --port 8080", (x) => {
      x.cpu = 1.2;
      x.mem = 1.8;
      x.time = "0:41";
    }),
  );
  procs.push(p(1201, 1, student, "/usr/lib/systemd/systemd --user"));
  procs.push(
    p(ShellPid, 1201, student, "-bash", (x) => {
      x.tty = "pts/0";
      x.stat = "Ss";
      x.start = "10:02";
    }),
  );
  procs.push(
    p(RunawayPid, 1201, student, "yes", (x) => {
      x.cpu = 99.7;
      x.mem = 0.0;
      x.stat = "R";
      x.start = "10:05";
      x.time = "42:13";
    }),
  );
  return { procs, jobs: [], nextPid: 4200 };
}

/** The command's name, e.g. "sshd" for "/usr/sbin/sshd -D". */
export function procName(proc: Proc): string {
  const first = proc.cmd.split(" ")[0]!;
  if (first.startsWith("[")) return first.slice(1, -1);
  const stripped = first.startsWith("-") ? first.slice(1) : first;
  return stripped.split("/").at(-1)!;
}
