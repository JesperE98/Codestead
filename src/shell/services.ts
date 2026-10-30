// Tjänsterna i den simulerade datorn – en förenklad modell av systemd.
//
// Varje tjänst (unit) har en unit-fil i det virtuella filsystemet och ett
// körtillstånd (active/inactive/failed) med en huvudprocess i processtabellen
// (`sh.proc`). Allt som händer skrivs till journalen, som `journalctl` läser.
// Tillståndet sparas i skalet (`sh.services`) tillsammans med resten av datorn.

import type { Distro } from './distros';
import { initialProcs, RUNAWAY_PID, SERVER_PID, type Proc } from './procs';
import type { Shell } from './shell';
import { makeDir, makeFile, type FsNode, type User } from './vfs';

/** Unit-filer som följer med paketen. (I äldre Debian: /lib/systemd/system.) */
export const SYSTEM_UNIT_DIR = '/usr/lib/systemd/system';
/** Unit-filer som administratören har skrivit eller ändrat. Har företräde. */
export const ADMIN_UNIT_DIR = '/etc/systemd/system';

export interface JournalEntry {
  /** Tidpunkt (ms sedan 1970). */
  t: number;
  /** Vilken uppstart raden hör till (index i `boots`). */
  boot: number;
  /** Programmet som skrev raden, t.ex. "systemd", "sshd" eller "kernel". */
  ident: string;
  pid?: number;
  /** 0 = emerg … 3 = err, 4 = warning, 5 = notice, 6 = info, 7 = debug. */
  prio: number;
  msg: string;
  /** Tjänsten raden handlar om (för `journalctl -u`). */
  unit?: string;
  /** Förklaring som visas med `journalctl -x`. */
  x?: { subject: string; body: string[] };
}

export type ActiveState = 'active' | 'inactive' | 'failed';
export type SubState = 'running' | 'dead' | 'exited' | 'failed';

export interface UnitRt {
  name: string;
  /** Unit-filen som laddades. */
  path: string;
  /** Unit-filens innehåll vid senaste laddningen (daemon-reload). */
  loaded: string;
  active: ActiveState;
  sub: SubState;
  /** När tillståndet senast ändrades. */
  since?: number;
  /** När tjänsten senast startade (för "Duration"). */
  startedAt?: number;
  /** Huvudprocessen medan tjänsten kör. */
  pid?: number;
  /** Den senaste huvudprocessen, efter att tjänsten stannat. */
  lastPid?: number;
  /** Varför tjänsten misslyckades, t.ex. "exit-code". */
  result?: string;
  /** T.ex. "code=exited, status=1/FAILURE". */
  exitInfo?: string;
}

export interface ServiceState {
  units: Record<string, UnitRt>;
  journal: JournalEntry[];
  /** Alla uppstarter; den sista är den nuvarande. */
  boots: { id: string; start: number }[];
  /** Löpnummer för jobb (visas med journalctl -x). */
  job: number;
  machineId: string;
}

// ---------- Tjänsterna som finns från början ----------

type ServiceType = 'simple' | 'exec' | 'notify' | 'forking' | 'oneshot' | 'dbus';

interface StartFailure {
  /** Utdata från programmet innan det kraschade. */
  log: string[];
  status: number;
  statusName: string;
}

interface ServiceDef {
  name: string;
  description: string;
  exec: string;
  type?: ServiceType;
  user?: string;
  reload?: string;
  docs?: string[];
  after?: string;
  restart?: string;
  remainAfterExit?: boolean;
  /** Målet i [Install]. Saknas det är tjänsten "static". */
  wantedBy?: string;
  alias?: string;
  /** Unit-filen ligger i /etc/systemd/system (skriven av administratören). */
  admin?: boolean;
  /** PID som tjänsten får vid uppstart (samma som i processtabellen). */
  pid?: number;
  /** Aktiverad från början (har [Install]). */
  enabled?: boolean;
  /** Statisk tjänst som ändå startas vid uppstart (som beroende). */
  boot?: boolean;
  /** Startas för hand efter uppstarten (av administratören). */
  manual?: boolean;
  /** Programmets egna loggrader när det startar. */
  log?: string[];
  /** Programmets egna loggrader när det stängs av. */
  stopLog?: string[];
  /** Kontroll innan start – returnerar ett fel om tjänsten kraschar. */
  check?(sh: Shell): StartFailure | null;
  /** Extra kommentar överst i unit-filen. */
  comment?: string;
}

/** Konfigurationsfilen som rapportd behöver (och som saknas från början). */
export const RAPPORTD_CONF = '/etc/rapportd.conf';

const RAPPORTD_EXAMPLE = `# Exempelkonfiguration för rapportd.
# Kopiera den till ${RAPPORTD_CONF} och ändra efter behov:
#   sudo cp ${RAPPORTD_CONF}.example ${RAPPORTD_CONF}

port = 9090
rapportkatalog = /var/lib/rapportd
intervall = 1h
`;

function serviceDefs(distro: Distro): ServiceDef[] {
  const fam = distro.family;
  const common: ServiceDef[] = [
    {
      name: 'systemd-journald.service',
      description: 'Journal Service',
      exec: '/usr/lib/systemd/systemd-journald',
      type: 'notify',
      docs: ['man:systemd-journald.service(8)', 'man:journald.conf(5)'],
      pid: 312,
      boot: true,
      log: ['Journal started', 'System Journal (/var/log/journal) is 24.0M, max 4.0G, 3.9G free.'],
    },
    {
      name: 'systemd-udevd.service',
      description: 'Rule-based Manager for Device Events and Files',
      exec: '/usr/lib/systemd/systemd-udevd',
      type: 'notify',
      docs: ['man:systemd-udevd.service(8)', 'man:udev(7)'],
      pid: 341,
      boot: true,
    },
    fam === 'debian'
      ? {
          name: 'dbus.service',
          description: 'D-Bus System Message Bus',
          exec: '/usr/bin/dbus-daemon --system --address=systemd: --nofork',
          type: 'notify',
          user: 'messagebus',
          docs: ['man:dbus-daemon(1)'],
          pid: 498,
          boot: true,
        }
      : {
          name: 'dbus-broker.service',
          description: 'D-Bus System Message Bus',
          exec: '/usr/bin/dbus-broker-launch --scope system',
          type: 'notify',
          user: 'dbus',
          docs: ['man:dbus-broker-launch(1)'],
          wantedBy: 'multi-user.target',
          alias: 'dbus.service',
          enabled: true,
          pid: 498,
          log: ['Ready'],
        },
    {
      name: 'systemd-logind.service',
      description: 'User Login Management',
      exec: '/usr/lib/systemd/systemd-logind',
      type: 'notify',
      docs: ['man:sd-login(3)', 'man:systemd-logind.service(8)', 'man:logind.conf(5)'],
      pid: 520,
      boot: true,
      log: ['New seat seat0.'],
    },
  ];

  const network: ServiceDef[] =
    distro.id === 'debian'
      ? [
          {
            name: 'networking.service',
            description: 'Raise network interfaces',
            exec: '/sbin/ifup -a --read-environment',
            type: 'oneshot',
            remainAfterExit: true,
            docs: ['man:interfaces(5)'],
            wantedBy: 'multi-user.target',
            enabled: true,
          },
        ]
      : fam === 'arch'
        ? [
            {
              name: 'systemd-networkd.service',
              description: 'Network Configuration',
              exec: '/usr/lib/systemd/systemd-networkd',
              type: 'notify',
              user: 'systemd-network',
              docs: ['man:systemd-networkd.service(8)'],
              wantedBy: 'multi-user.target',
              enabled: true,
              pid: 470,
              log: ['eth0: Link UP', 'eth0: Gained carrier', 'eth0: DHCPv4 address 192.168.1.42/24, gateway 192.168.1.1'],
            },
          ]
        : [
            {
              name: 'NetworkManager.service',
              description: 'Network Manager',
              exec: '/usr/sbin/NetworkManager --no-daemon',
              type: 'dbus',
              reload: '/usr/bin/busctl call org.freedesktop.NetworkManager /org/freedesktop/NetworkManager org.freedesktop.NetworkManager Reload u 0',
              docs: ['man:NetworkManager(8)'],
              wantedBy: 'multi-user.target',
              enabled: true,
              pid: fam === 'redhat' ? 560 : 590,
              log: ['<info>  NetworkManager is starting...', '<info>  device (eth0): state change: ip-config -> activated'],
            },
          ];

  const ssh: ServiceDef =
    fam === 'debian'
      ? {
          name: 'ssh.service',
          description: 'OpenBSD Secure Shell server',
          exec: '/usr/sbin/sshd -D',
          type: 'notify',
          reload: '/bin/kill -HUP $MAINPID',
          docs: ['man:sshd(8)', 'man:sshd_config(5)'],
          after: 'network.target auditd.service',
          restart: 'on-failure',
          wantedBy: 'multi-user.target',
          alias: 'sshd.service',
          enabled: true,
          pid: 733,
          log: ['Server listening on 0.0.0.0 port 22.', 'Server listening on :: port 22.'],
          stopLog: ['Received signal 15; terminating.'],
        }
      : {
          name: 'sshd.service',
          description: fam === 'arch' ? 'OpenSSH Daemon' : 'OpenSSH server daemon',
          exec: '/usr/sbin/sshd -D',
          type: 'notify',
          reload: '/bin/kill -HUP $MAINPID',
          docs: ['man:sshd(8)', 'man:sshd_config(5)'],
          after: 'network.target',
          restart: 'on-failure',
          wantedBy: 'multi-user.target',
          enabled: true,
          pid: 733,
          log: ['Server listening on 0.0.0.0 port 22.', 'Server listening on :: port 22.'],
          stopLog: ['Received signal 15; terminating.'],
        };

  const family: ServiceDef[] =
    fam === 'debian'
      ? [
          {
            name: 'cron.service',
            description: 'Regular background program processing daemon',
            exec: '/usr/sbin/cron -f',
            docs: ['man:cron(8)'],
            wantedBy: 'multi-user.target',
            enabled: true,
            pid: 530,
            log: ['(CRON) INFO (pidfile fd = 3)', '(CRON) INFO (Running @reboot jobs)'],
          },
          {
            name: 'rsyslog.service',
            description: 'System Logging Service',
            exec: '/usr/sbin/rsyslogd -n',
            type: 'notify',
            user: 'syslog',
            docs: ['man:rsyslogd(8)', 'man:rsyslog.conf(5)'],
            wantedBy: 'multi-user.target',
            enabled: true,
            pid: 533,
          },
          ...(distro.id === 'ubuntu'
            ? [
                {
                  name: 'snapd.service',
                  description: 'Snap Daemon',
                  exec: '/usr/lib/snapd/snapd',
                  type: 'notify' as const,
                  wantedBy: 'multi-user.target',
                  enabled: true,
                  pid: 560,
                },
              ]
            : []),
        ]
      : fam === 'arch'
        ? [
            {
              name: 'systemd-timesyncd.service',
              description: 'Network Time Synchronization',
              exec: '/usr/lib/systemd/systemd-timesyncd',
              type: 'notify',
              user: 'systemd-timesync',
              docs: ['man:systemd-timesyncd.service(8)'],
              wantedBy: 'sysinit.target',
              enabled: true,
              pid: 531,
              log: ['Contacted time server 162.159.200.1:123 (0.arch.pool.ntp.org).'],
            },
          ]
        : [
            {
              name: 'firewalld.service',
              description: 'firewalld - dynamic firewall daemon',
              exec: '/usr/bin/python3 -sP /usr/sbin/firewalld --nofork --nopid',
              type: 'dbus',
              reload: '/bin/kill -HUP $MAINPID',
              docs: ['man:firewalld(1)'],
              wantedBy: 'multi-user.target',
              alias: 'dbus-org.fedoraproject.FirewallD1.service',
              enabled: true,
              pid: 540,
            },
            {
              name: 'chronyd.service',
              description: 'NTP client/server',
              exec: '/usr/sbin/chronyd -F 2',
              type: 'forking',
              user: 'chrony',
              docs: ['man:chronyd(8)', 'man:chrony.conf(5)'],
              wantedBy: 'multi-user.target',
              enabled: true,
              pid: 545,
              log: ['chronyd version 4.8 starting (+CMDMON +NTP +REFCLOCK +RTC +PRIVDROP +SCFILTER +SIGND +NTS +SECHASH +IPV6 +DEBUG)'],
            },
            {
              name: 'crond.service',
              description: 'Command Scheduler',
              exec: '/usr/sbin/crond -n',
              wantedBy: 'multi-user.target',
              enabled: true,
              pid: 552,
              log: ['(CRON) STARTUP (1.7.2)', '(CRON) INFO (running with inotify support)'],
            },
          ];

  const own: ServiceDef[] = [
    {
      name: 'rapportd.service',
      description: 'Rapportd report service',
      exec: `/usr/local/bin/rapportd --config ${RAPPORTD_CONF}`,
      type: 'notify',
      after: 'network.target',
      wantedBy: 'multi-user.target',
      admin: true,
      enabled: true,
      pid: 655,
      log: [`Reading configuration from ${RAPPORTD_CONF}`, 'Report scheduler ready (interval 1h)'],
      check: (sh) =>
        sh.vfs.tryLookup(RAPPORTD_CONF, sh.rootUser())?.type === 'file'
          ? null
          : {
              log: [
                `error: cannot open config file ${RAPPORTD_CONF}: No such file or directory`,
                `hint: an example configuration is installed as ${RAPPORTD_CONF}.example`,
              ],
              status: 1,
              statusName: 'FAILURE',
            },
      comment: '# Rapportd skapar rapporter varje timme. Installerad av administratören.',
    },
    {
      name: 'minserver.service',
      description: 'Minserver web server (practice server)',
      exec: '/usr/local/bin/minserver --port 8080',
      reload: '/bin/kill -HUP $MAINPID',
      after: 'network.target',
      wantedBy: 'multi-user.target',
      admin: true,
      manual: true,
      pid: SERVER_PID,
      log: ['Reading configuration from /etc/minserver.conf', 'Listening on port 8080'],
      stopLog: ['Shutting down, closing connections'],
      comment: '# Övningsservern från kapitlet om processer.',
    },
  ];

  return [...common, ...network, ...family, ssh, ...own];
}

function defFor(sh: Shell, name: string): ServiceDef | undefined {
  return serviceDefs(sh.distro).find((d) => d.name === name);
}

function unitFile(def: ServiceDef): string {
  const lines: string[] = [];
  if (def.comment) lines.push(def.comment);
  lines.push('[Unit]', `Description=${def.description}`);
  if (def.docs) lines.push(`Documentation=${def.docs.join(' ')}`);
  if (def.after) lines.push(`After=${def.after}`);
  lines.push('', '[Service]');
  if (def.type && def.type !== 'simple') lines.push(`Type=${def.type}`);
  if (def.remainAfterExit) lines.push('RemainAfterExit=yes');
  if (def.user) lines.push(`User=${def.user}`);
  lines.push(`ExecStart=${def.exec}`);
  if (def.reload) lines.push(`ExecReload=${def.reload}`);
  if (def.restart) lines.push(`Restart=${def.restart}`);
  if (def.wantedBy) {
    lines.push('', '[Install]', `WantedBy=${def.wantedBy}`);
    if (def.alias) lines.push(`Alias=${def.alias}`);
  }
  return lines.join('\n') + '\n';
}

// ---------- Unit-filer ----------

export interface ParsedUnit {
  description: string;
  docs: string[];
  type: ServiceType;
  exec: string;
  reload?: string;
  user?: string;
  remainAfterExit: boolean;
  wantedBy: string[];
  alias: string[];
}

/** Läser de viktigaste inställningarna ur en unit-fil. */
export function parseUnit(text: string): ParsedUnit {
  const values: Record<string, string[]> = {};
  let section = '';
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const sec = /^\[(.+)\]$/.exec(line);
    if (sec) {
      section = sec[1];
      continue;
    }
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = `${section}.${line.slice(0, eq).trim()}`;
    (values[key] ??= []).push(line.slice(eq + 1).trim());
  }
  const last = (k: string) => values[k]?.at(-1);
  const list = (k: string) => (values[k] ?? []).flatMap((v) => v.split(/\s+/)).filter(Boolean);
  const type = (last('Service.Type') ?? 'simple') as ServiceType;
  return {
    description: last('Unit.Description') ?? '',
    docs: list('Unit.Documentation'),
    type,
    exec: (last('Service.ExecStart') ?? '').replace(/^[-@:+!]+/, ''),
    reload: last('Service.ExecReload'),
    user: last('Service.User'),
    remainAfterExit: /^(yes|true|1|on)$/i.test(last('Service.RemainAfterExit') ?? ''),
    wantedBy: [...list('Install.WantedBy'), ...list('Install.RequiredBy')],
    alias: list('Install.Alias'),
  };
}

function ensureDir(sh: Shell, path: string): FsNode {
  const root = sh.rootUser();
  let cur = '';
  let node = sh.vfs.root;
  for (const seg of path.split('/').filter(Boolean)) {
    cur += '/' + seg;
    if (!node.children![seg]) node.children![seg] = makeDir('root', 0o755);
    node = node.children![seg];
  }
  return sh.vfs.lookup(cur || '/', root);
}

function wantsPath(target: string, unit: string): string {
  return `${ADMIN_UNIT_DIR}/${target}.wants/${unit}`;
}

function writeUnitFiles(sh: Shell): void {
  const sys = ensureDir(sh, SYSTEM_UNIT_DIR);
  const admin = ensureDir(sh, ADMIN_UNIT_DIR);
  for (const def of serviceDefs(sh.distro)) {
    const dir = def.admin ? admin : sys;
    dir.children![def.name] = makeFile(unitFile(def));
    if (def.enabled && def.wantedBy) {
      const wants = ensureDir(sh, `${ADMIN_UNIT_DIR}/${def.wantedBy}.wants`);
      wants.children![def.name] = makeFile(unitFile(def));
    }
  }
  const etc = sh.vfs.lookup('/etc', sh.rootUser());
  if (!etc.children!['rapportd.conf.example']) etc.children!['rapportd.conf.example'] = makeFile(RAPPORTD_EXAMPLE);
}

/** Hittar unit-filen för en tjänst (administratörens kopia går före paketets). */
function findUnitFile(sh: Shell, name: string): { path: string; content: string } | null {
  for (const dir of [ADMIN_UNIT_DIR, SYSTEM_UNIT_DIR]) {
    const node = sh.vfs.tryLookup(`${dir}/${name}`, sh.rootUser());
    if (node?.type === 'file') return { path: `${dir}/${name}`, content: node.content ?? '' };
  }
  return null;
}

/** Laddar (eller laddar om) en tjänst från dess unit-fil. */
function loadUnit(sh: Shell, name: string): UnitRt | null {
  const file = findUnitFile(sh, name);
  const st = sh.services;
  if (!file) return null;
  const existing = st.units[name];
  if (existing) {
    existing.path = file.path;
    existing.loaded = file.content;
    return existing;
  }
  const rt: UnitRt = { name, path: file.path, loaded: file.content, active: 'inactive', sub: 'dead' };
  st.units[name] = rt;
  return rt;
}

/** Översätter "minserver", "sshd" (alias) eller "minserver.service" till en laddad tjänst. */
export function resolveUnit(sh: Shell, arg: string): UnitRt | null {
  const st = sh.services;
  if (/^\d+$/.test(arg)) return Object.values(st.units).find((u) => u.pid === Number(arg)) ?? null;
  const name = /\.[a-z]+$/.test(arg) ? arg : `${arg}.service`;
  if (!name.endsWith('.service')) return null;
  if (st.units[name]) return st.units[name];
  for (const u of Object.values(st.units)) if (parseUnit(u.loaded).alias.includes(name)) return u;
  return loadUnit(sh, name);
}

/** Tjänstens fullständiga namn för felmeddelanden ("minserver" → "minserver.service"). */
export function unitName(arg: string): string {
  return /\.[a-z]+$/.test(arg) ? arg : `${arg}.service`;
}

export function unitInfo(rt: UnitRt): ParsedUnit {
  return parseUnit(rt.loaded);
}

/** Har unit-filen ändrats sedan den laddades? */
export function changedOnDisk(sh: Shell, rt: UnitRt): boolean {
  const file = findUnitFile(sh, rt.name);
  return !!file && file.content !== rt.loaded;
}

export type EnabledState = 'enabled' | 'disabled' | 'static' | 'alias';

export function enabledState(sh: Shell, rt: UnitRt, asked?: string): EnabledState {
  if (asked && unitName(asked) !== rt.name) return 'alias';
  const info = unitInfo(rt);
  if (!info.wantedBy.length) return 'static';
  return info.wantedBy.some((t) => sh.vfs.tryLookup(wantsPath(t, rt.name), sh.rootUser())) ? 'enabled' : 'disabled';
}

/** "preset" i statusutskriften: Debian aktiverar nya tjänster, Arch och Fedora inte. */
export function presetState(sh: Shell): 'enabled' | 'disabled' {
  return sh.distro.family === 'debian' ? 'enabled' : 'disabled';
}

// ---------- Journalen ----------

const JOURNAL_MAX = 3000;

export function currentBoot(sh: Shell): number {
  return sh.services.boots.length - 1;
}

export function log(sh: Shell, t: number, ident: string, msg: string, opts: Partial<JournalEntry> = {}): void {
  const st = sh.services;
  const pid = opts.pid ?? (ident === 'systemd' ? 1 : undefined);
  st.journal.push({ t, boot: currentBoot(sh), ident, prio: 6, msg, ...opts, pid });
  if (st.journal.length > JOURNAL_MAX) st.journal.splice(0, st.journal.length - JOURNAL_MAX);
}

function identOf(exec: string): string {
  return exec.split(' ')[0].split('/').pop() ?? exec;
}

function subjectStarted(unit: string, job: number): JournalEntry['x'] {
  return {
    subject: `A start job for unit ${unit} has finished successfully`,
    body: [`A start job for unit ${unit} has finished successfully.`, '', `The job identifier is ${job}.`],
  };
}

// ---------- Processer ----------

function hhmm(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function newProc(pid: number, user: string, cmd: string, t: number): Proc {
  return {
    pid,
    ppid: 1,
    user,
    cmd,
    cpu: 0,
    mem: 0.2,
    vsz: 20_000 + ((pid * 7919) % 300_000),
    rss: 4_000 + ((pid * 104_729) % 40_000),
    tty: '?',
    stat: 'Ss',
    start: hhmm(t),
    time: '0:00',
  };
}

function hasProc(sh: Shell, pid: number | undefined): boolean {
  return pid !== undefined && sh.proc.procs.some((p) => p.pid === pid);
}

function pickPid(sh: Shell, wanted?: number): number {
  if (wanted !== undefined && !hasProc(sh, wanted) && !sh.proc.jobs.some((j) => j.pid === wanted)) return wanted;
  return sh.proc.nextPid++;
}

// ---------- Starta och stoppa ----------

/**
 * Hur en start går till:
 * - 'real': på riktigt – processen läggs in i processtabellen.
 * - 'init': när modellen skapas – befintliga processer i tabellen tas över.
 * - 'record': bara journalrader (för den förra uppstarten).
 */
type Mode = 'real' | 'init' | 'record';

export interface StartResult {
  ok: boolean;
}

export function startUnit(sh: Shell, rt: UnitRt, t: number, mode: Mode = 'real', atBoot = false): StartResult {
  const st = sh.services;
  if (rt.active === 'active') return { ok: true };
  const info = unitInfo(rt);
  const def = defFor(sh, rt.name);
  const desc = info.description ? `${rt.name} - ${info.description}` : rt.name;
  const job = ++st.job;
  const ident = identOf(info.exec);
  const user = info.user ?? 'root';

  // Vad som kan gå fel: programmet finns inte, eller (för våra egna tjänster) en kontroll.
  let failure: (StartFailure & { exec?: boolean }) | null = null;
  if (mode !== 'record') {
    if (def?.check) failure = def.check(sh);
    else if (!def) {
      const bin = info.exec.split(' ')[0];
      const path = bin.includes('/') ? bin : `/usr/bin/${bin}`;
      const node = bin ? sh.vfs.tryLookup(path, sh.rootUser()) : null;
      if (!node || node.type !== 'file' || !(node.mode & 0o111)) {
        failure = { log: [], status: 203, statusName: 'EXEC', exec: true };
      }
    }
  }

  if (info.type !== 'simple' && info.type !== 'exec') log(sh, t, 'systemd', `Starting ${desc}...`, { unit: rt.name });
  const pid = mode === 'record' ? (def?.pid ?? 900 + job) : mode === 'init' ? (def?.pid ?? pickPid(sh)) : pickPid(sh, atBoot ? def?.pid : undefined);

  if (failure) {
    const bin = info.exec.split(' ')[0] || '(none)';
    if (failure.exec) {
      log(sh, t, 'systemd', `${rt.name}: Failed to locate executable ${bin}: No such file or directory`, { unit: rt.name, prio: 3, pid });
      log(sh, t, 'systemd', `${rt.name}: Failed at step EXEC spawning ${bin}: No such file or directory`, { unit: rt.name, prio: 3, pid });
    } else {
      for (const line of failure.log) log(sh, t, ident, line, { unit: rt.name, pid, prio: line.startsWith('error') ? 3 : 6 });
    }
    const exitInfo = `code=exited, status=${failure.status}/${failure.statusName}`;
    log(sh, t, 'systemd', `${rt.name}: Main process exited, ${exitInfo}`, {
      unit: rt.name,
      prio: 5,
      x: {
        subject: 'Unit process exited',
        body: [`An ExecStart= process belonging to unit ${rt.name} has exited.`, '', `The process' exit code is 'exited' and its exit status is ${failure.status}.`],
      },
    });
    log(sh, t, 'systemd', `${rt.name}: Failed with result 'exit-code'.`, {
      unit: rt.name,
      prio: 4,
      x: { subject: 'Unit failed', body: [`The unit ${rt.name} has entered the 'failed' state with result 'exit-code'.`] },
    });
    log(sh, t, 'systemd', `Failed to start ${desc}.`, {
      unit: rt.name,
      prio: 3,
      x: {
        subject: `A start job for unit ${rt.name} has failed`,
        body: [`A start job for unit ${rt.name} has finished with a failure.`, '', `The job identifier is ${job} and the job result is failed.`],
      },
    });
    Object.assign(rt, { active: 'failed', sub: 'failed', since: t, startedAt: t, pid: undefined, lastPid: pid, result: 'exit-code', exitInfo });
    return { ok: false };
  }

  if (info.type === 'oneshot') {
    for (const line of def?.log ?? []) log(sh, t, ident, line, { unit: rt.name, pid });
    if (info.remainAfterExit) {
      log(sh, t, 'systemd', `Finished ${desc}.`, { unit: rt.name, x: subjectStarted(rt.name, job) });
      Object.assign(rt, { active: 'active', sub: 'exited', since: t, startedAt: t, pid: undefined, lastPid: pid, result: undefined, exitInfo: 'code=exited, status=0/SUCCESS' });
    } else {
      log(sh, t, 'systemd', `${rt.name}: Deactivated successfully.`, { unit: rt.name });
      log(sh, t, 'systemd', `Finished ${desc}.`, { unit: rt.name, x: subjectStarted(rt.name, job) });
      Object.assign(rt, { active: 'inactive', sub: 'dead', since: t, startedAt: t, pid: undefined, lastPid: pid, result: undefined, exitInfo: 'code=exited, status=0/SUCCESS' });
    }
    return { ok: true };
  }

  if (mode !== 'record') {
    const template = initialProcs(sh.distro).procs.find((p) => p.pid === pid && p.cmd === info.exec);
    if (mode === 'real' || (!hasProc(sh, pid) && !template)) {
      if (!hasProc(sh, pid)) sh.proc.procs.push(template && mode === 'real' ? { ...template, start: hhmm(t), time: '0:00' } : newProc(pid, user, info.exec, t));
    }
  }
  const started = () => log(sh, t, 'systemd', `Started ${desc}.`, { unit: rt.name, x: subjectStarted(rt.name, job) });
  if (info.type === 'simple' || info.type === 'exec') started();
  for (const line of def?.log ?? []) log(sh, t, ident, line, { unit: rt.name, pid });
  if (info.type !== 'simple' && info.type !== 'exec') started();
  Object.assign(rt, { active: 'active', sub: 'running', since: t, startedAt: t, pid, lastPid: undefined, result: undefined, exitInfo: undefined });
  return { ok: true };
}

export function stopUnit(sh: Shell, rt: UnitRt, t: number, mode: Mode = 'real'): void {
  if (rt.active !== 'active') return;
  const info = unitInfo(rt);
  const def = defFor(sh, rt.name);
  const desc = info.description ? `${rt.name} - ${info.description}` : rt.name;
  log(sh, t, 'systemd', `Stopping ${desc}...`, { unit: rt.name });
  if (rt.pid !== undefined) {
    for (const line of def?.stopLog ?? []) log(sh, t, identOf(info.exec), line, { unit: rt.name, pid: rt.pid });
    if (mode !== 'record') sh.proc.procs = sh.proc.procs.filter((p) => p.pid !== rt.pid);
  }
  log(sh, t, 'systemd', `${rt.name}: Deactivated successfully.`, { unit: rt.name });
  log(sh, t, 'systemd', `Stopped ${desc}.`, { unit: rt.name });
  Object.assign(rt, {
    active: 'inactive',
    sub: 'dead',
    since: t,
    lastPid: rt.pid ?? rt.lastPid,
    pid: undefined,
    result: undefined,
    exitInfo: rt.pid !== undefined ? 'code=killed, signal=TERM' : rt.exitInfo,
  });
}

/**
 * Stämmer av tjänsterna mot processtabellen: har huvudprocessen dödats
 * (t.ex. med `sudo pkill minserver`) är tjänsten inte längre igång.
 */
export function syncServices(sh: Shell, t = Date.now()): void {
  for (const rt of Object.values(sh.services.units)) {
    if (rt.active !== 'active' || rt.pid === undefined || hasProc(sh, rt.pid)) continue;
    log(sh, t, 'systemd', `${rt.name}: Deactivated successfully.`, { unit: rt.name });
    Object.assign(rt, { active: 'inactive', sub: 'dead', since: t, lastPid: rt.pid, pid: undefined, exitInfo: 'code=killed, signal=TERM' });
  }
}

/** Läser om alla unit-filer (systemctl daemon-reload). */
export function daemonReload(sh: Shell): void {
  const st = sh.services;
  const names = new Set<string>(Object.keys(st.units));
  for (const dir of [SYSTEM_UNIT_DIR, ADMIN_UNIT_DIR]) {
    const node = sh.vfs.tryLookup(dir, sh.rootUser());
    for (const [name, child] of Object.entries(node?.children ?? {})) if (child.type === 'file' && name.endsWith('.service')) names.add(name);
  }
  for (const name of names) {
    if (loadUnit(sh, name)) continue;
    // Unit-filen är borttagen: glöm tjänsten om den inte kör.
    if (st.units[name].active !== 'active') delete st.units[name];
  }
}

// ---------- Aktivera och avaktivera ----------

export interface LinkChange {
  created: string[];
  removed: string[];
}

export function enableUnit(sh: Shell, rt: UnitRt): LinkChange {
  const info = unitInfo(rt);
  const change: LinkChange = { created: [], removed: [] };
  for (const target of info.wantedBy) {
    const path = wantsPath(target, rt.name);
    if (sh.vfs.tryLookup(path, sh.rootUser())) continue;
    const dir = ensureDir(sh, `${ADMIN_UNIT_DIR}/${target}.wants`);
    // Det virtuella filsystemet har inga symboliska länkar – en kopia av unit-filen får räcka.
    dir.children![rt.name] = makeFile(findUnitFile(sh, rt.name)?.content ?? rt.loaded);
    change.created.push(`${path} → ${rt.path}`);
  }
  return change;
}

export function disableUnit(sh: Shell, rt: UnitRt): LinkChange {
  const info = unitInfo(rt);
  const change: LinkChange = { created: [], removed: [] };
  for (const target of info.wantedBy) {
    const path = wantsPath(target, rt.name);
    if (!sh.vfs.tryLookup(path, sh.rootUser())) continue;
    sh.vfs.remove(path, sh.rootUser());
    change.removed.push(path);
  }
  return change;
}

// ---------- Uppstart ----------

function hexId(): string {
  let s = '';
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

export function systemdVersion(d: Distro): { major: number; full: string } {
  switch (d.id) {
    case 'ubuntu':
      return { major: 255, full: '255.4-1ubuntu8.11' };
    case 'debian':
      return { major: 257, full: '257.8-1~deb13u2' };
    case 'arch':
      return { major: 258, full: '258.1-1-arch' };
    default:
      return { major: 258, full: '258-1.fc43' };
  }
}

/** Datorn startar: kärnan, systemd och alla tjänster som ska startas vid uppstart. */
function bootUp(sh: Shell, t0: number, mode: Mode, user: User | null): number {
  const st = sh.services;
  st.boots.push({ id: hexId(), start: t0 });
  const d = sh.distro;
  const k = (msg: string, prio = 6) => log(sh, t0, 'kernel', msg, { prio });
  k(`Linux version ${d.kernel} (simulated) #1 SMP PREEMPT_DYNAMIC`, 5);
  k(`Command line: BOOT_IMAGE=/boot/vmlinuz-${d.kernel} root=UUID=1234-abcd ro quiet`);
  k('ACPI BIOS Error (bug): Could not resolve symbol [\\_SB.PCI0.GPP0.SWUS], AE_NOT_FOUND (20240827/dswload2-162)', 3);
  k('ACPI Error: AE_NOT_FOUND, During name lookup/catalog (20240827/psobject-220)', 3);
  k('EXT4-fs (sda2): mounted filesystem with ordered data mode. Quota mode: none.');
  let t = t0 + 2153;
  log(sh, t, 'systemd', `systemd ${systemdVersion(d).full} running in system mode (+PAM +AUDIT +SELINUX +APPARMOR +SECCOMP +GCRYPT -GNUTLS +OPENSSL +ACL +BLKID +CURL +ELFUTILS +FIDO2 +IDN2 -IDN +KMOD +LIBCRYPTSETUP +LIBFDISK +PCRE2 +PWQUALITY +P11KIT +QRENCODE +TPM2 +BZIP2 +LZ4 +XZ +ZLIB +ZSTD +BPF_FRAMEWORK +XKBCOMMON +UTMP +SYSVINIT +LIBARCHIVE)`);
  log(sh, t, 'systemd', 'Detected virtualization kvm.');
  log(sh, t, 'systemd', `Hostname set to <${d.hostname}>.`);
  for (const def of serviceDefs(d)) {
    const rt = st.units[def.name];
    if (!rt) continue;
    const wanted = def.boot || enabledState(sh, rt) === 'enabled';
    if (!wanted) continue;
    t += 180;
    startUnit(sh, rt, t, mode, true);
  }
  // Egna tjänster som eleven har skrivit och aktiverat.
  for (const rt of Object.values(st.units)) {
    if (defFor(sh, rt.name) || enabledState(sh, rt) !== 'enabled') continue;
    t += 180;
    startUnit(sh, rt, t, mode, true);
  }
  t += 400;
  log(sh, t, 'systemd', 'Reached target multi-user.target - Multi-User System.');
  log(sh, t, 'systemd', `Startup finished in 2.153s (kernel) + ${((t - t0 - 2153) / 1000).toFixed(3)}s (userspace) = ${((t - t0) / 1000).toFixed(3)}s.`);
  if (user) {
    t += 20_000;
    log(sh, t, 'systemd-logind', `New session 1 of user ${user.name}.`, { pid: 520, unit: 'systemd-logind.service' });
    log(sh, t, 'systemd', `Started session-1.scope - Session 1 of User ${user.name}.`);
  }
  return t;
}

function shutdown(sh: Shell, t: number, mode: Mode): void {
  for (const rt of Object.values(sh.services.units).reverse()) stopUnit(sh, rt, t, mode);
  log(sh, t, 'systemd', 'Reached target shutdown.target - System Shutdown.');
  log(sh, t, 'systemd-shutdown', 'Syncing filesystems and block devices.', { pid: 1 });
  log(sh, t, 'kernel', 'reboot: Restarting system');
  for (const rt of Object.values(sh.services.units)) Object.assign(rt, { active: 'inactive', sub: 'dead', pid: undefined, result: undefined });
}

/** Skapar tjänstemodellen för en ny (eller gammal sparad) dator. */
export function initialServices(sh: Shell): ServiceState {
  const st: ServiceState = { units: {}, journal: [], boots: [], job: 100, machineId: hexId() };
  sh.services = st;
  writeUnitFiles(sh);
  for (const def of serviceDefs(sh.distro)) loadUnit(sh, def.name);
  const student = sh.getUser('elev');
  const now = Date.now();
  const bootStart = now - (2 * 3600 + 14 * 60) * 1000;

  // Förra uppstarten (i går) – bara journalrader. Då fanns rapportd.conf.
  const prevStart = bootStart - 24 * 3600 * 1000;
  let t = bootUp(sh, prevStart, 'record', student);
  const server = st.units['minserver.service'];
  t += 30_000;
  startUnit(sh, server, t, 'record');
  shutdown(sh, prevStart + 9 * 3600 * 1000, 'record');

  // Den här uppstarten. Processerna finns redan i processtabellen.
  t = bootUp(sh, bootStart, 'init', student);
  // Administratören startade övningsservern för hand – men aktiverade den aldrig.
  t += 10_000;
  log(sh, t, 'sudo', `${student.name} : TTY=pts/0 ; PWD=/home/${student.name} ; USER=root ; COMMAND=/usr/bin/systemctl start minserver`, { pid: 1240 });
  startUnit(sh, server, t, 'init', true);
  // Processer som dödats innan modellen fanns (äldre sparade terminaler).
  syncServices(sh, now);
  return st;
}

/** Startar om datorn: alla tjänster stoppas, och de aktiverade startar igen. */
export function reboot(sh: Shell): void {
  const now = Date.now();
  syncServices(sh, now);
  shutdown(sh, now, 'real');
  // Allt som inte är tjänster försvinner – utom grunden som alltid finns.
  const servicePids = new Set(serviceDefs(sh.distro).map((d) => d.pid));
  const base = initialProcs(sh.distro).procs.filter((p) => !servicePids.has(p.pid) && p.pid !== RUNAWAY_PID);
  sh.proc.procs = base;
  sh.proc.jobs = [];
  for (const rt of Object.values(sh.services.units)) Object.assign(rt, { lastPid: undefined, exitInfo: undefined, since: undefined });
  bootUp(sh, now + 3000, 'real', sh.getUser('elev'));
}
