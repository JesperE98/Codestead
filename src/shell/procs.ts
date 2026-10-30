// Processtabellen i den simulerade datorn: systemprocesser, användarens skal,
// en skenande process att hitta och bakgrundsjobb som eleven startar.

import type { Distro } from './distros';

export interface Proc {
  pid: number;
  ppid: number;
  user: string;
  /** Hela kommandoraden, t.ex. "/usr/sbin/sshd -D". */
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

export interface Job {
  id: number;
  pid: number;
  cmd: string;
  state: 'Running' | 'Done' | 'Terminated' | 'Killed';
  /** När ett `sleep`-jobb blir klart (ms sedan 1970). */
  endsAt?: number;
  exit?: number;
}

export interface ProcState {
  procs: Proc[];
  jobs: Job[];
  nextPid: number;
}

/** Skalets egen process (bash i terminalen). */
export const SHELL_PID = 1290;
/** Processen som slukar CPU och som eleven ska hitta. */
export const RUNAWAY_PID = 3141;
/** Övningsservern som körs som root. */
export const SERVER_PID = 812;

function p(pid: number, ppid: number, user: string, cmd: string, extra: Partial<Proc> = {}): Proc {
  return {
    pid,
    ppid,
    user,
    cmd,
    cpu: 0,
    mem: 0.1,
    vsz: 20_000 + ((pid * 7919) % 300_000),
    rss: 4_000 + ((pid * 104_729) % 40_000),
    tty: '?',
    stat: 'Ss',
    start: '08:00',
    time: '0:00',
    ...extra,
  };
}

export function initialProcs(distro: Distro): ProcState {
  const common = [
    p(1, 0, 'root', '/sbin/init', { time: '0:02' }),
    p(2, 0, 'root', '[kthreadd]', { stat: 'S', rss: 0, vsz: 0 }),
    p(312, 1, 'root', '/usr/lib/systemd/systemd-journald', { mem: 0.3 }),
    p(341, 1, 'root', '/usr/lib/systemd/systemd-udevd'),
    p(520, 1, 'root', '/usr/lib/systemd/systemd-logind'),
  ];
  const family: Proc[] =
    distro.family === 'debian'
      ? [
          p(498, 1, 'messagebus', '/usr/bin/dbus-daemon --system --address=systemd: --nofork'),
          p(530, 1, 'root', '/usr/sbin/cron -f'),
          p(533, 1, 'syslog', '/usr/sbin/rsyslogd -n'),
          ...(distro.id === 'ubuntu' ? [p(560, 1, 'root', '/usr/lib/snapd/snapd', { mem: 0.6 })] : []),
        ]
      : distro.family === 'arch'
        ? [p(498, 1, 'dbus', '/usr/bin/dbus-broker-launch --scope system'), p(531, 1, 'root', '/usr/lib/systemd/systemd-timesyncd')]
        : [
            p(498, 1, 'dbus', '/usr/bin/dbus-broker-launch --scope system'),
            p(540, 1, 'root', '/usr/bin/python3 -sP /usr/sbin/firewalld --nofork --nopid', { mem: 0.5 }),
            p(545, 1, 'chrony', '/usr/sbin/chronyd -F 2'),
            p(560, 1, 'root', '/usr/sbin/NetworkManager --no-daemon', { mem: 0.4 }),
          ];
  return {
    procs: [
      ...common,
      ...family,
      p(733, 1, 'root', '/usr/sbin/sshd -D'),
      p(SERVER_PID, 1, 'root', '/usr/local/bin/minserver --port 8080', { cpu: 1.2, mem: 1.8, time: '0:41' }),
      p(1201, 1, 'elev', '/usr/lib/systemd/systemd --user'),
      p(SHELL_PID, 1201, 'elev', '-bash', { tty: 'pts/0', stat: 'Ss', start: '10:02' }),
      p(RUNAWAY_PID, 1201, 'elev', 'yes', { cpu: 99.7, mem: 0.0, stat: 'R', start: '10:05', time: '42:13' }),
    ],
    jobs: [],
    nextPid: 4200,
  };
}

/** Kommandots namn, t.ex. "sshd" för "/usr/sbin/sshd -D". */
export function procName(proc: Proc): string {
  const first = proc.cmd.split(' ')[0];
  if (first.startsWith('[')) return first.slice(1, -1);
  return first.replace(/^-/, '').split('/').pop() ?? first;
}
