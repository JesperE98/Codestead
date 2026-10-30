// Kommandon för tjänster och loggar: systemctl, journalctl, hostnamectl,
// systemd-analyze och reboot. Modellen (tjänster, journal, uppstarter) finns i
// ../services.ts.

import { procName } from '../procs';
import {
  ADMIN_UNIT_DIR,
  changedOnDisk,
  currentBoot,
  daemonReload,
  disableUnit,
  enableUnit,
  enabledState,
  presetState,
  reboot,
  resolveUnit,
  startUnit,
  stopUnit,
  syncServices,
  SYSTEM_UNIT_DIR,
  systemdVersion,
  unitInfo,
  unitName,
  log,
  type JournalEntry,
  type UnitRt,
} from '../services';
import type { CmdCtx, CommandDef } from '../types';
import { COLOR } from './util';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BOLD_GREEN = '\x1b[1;32m';
const BOLD_YELLOW = '\x1b[1;33m';

const pad2 = (n: number) => String(n).padStart(2, '0');
const clock = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

function tzName(d: Date): string {
  try {
    return d.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

/** "Oct 30 08:00:03" – som i journalen. */
function shortTime(t: number): string {
  const d = new Date(t);
  return `${MONTHS[d.getMonth()]} ${pad2(d.getDate())} ${clock(d)}`;
}

/** "Fri 2026-10-30 08:00:03 CET" – som i systemctl status. */
function longTime(t: number): string {
  const d = new Date(t);
  return `${DAYS[d.getDay()]} ${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${clock(d)} ${tzName(d)}`;
}

function isoTime(t: number): string {
  const d = new Date(t);
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${clock(d)}${sign}${pad2(Math.floor(Math.abs(off) / 60))}${pad2(Math.abs(off) % 60)}`;
}

/** "2h 14min" / "5s" / "1 day 3h". */
function span(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}min`;
  const days = Math.floor(h / 24);
  return `${days} day${days === 1 ? '' : 's'} ${h % 24}h`;
}

function paint(ctx: CmdCtx, code: string, s: string): string {
  return ctx.isTTY ? `${code}${s}${COLOR.reset}` : s;
}

function tip(ctx: CmdCtx, text: { sv: string; en: string }): void {
  ctx.err(`${COLOR.dim}${ctx.sh.msg(text)}${COLOR.reset}\n`);
}

function supportUrl(ctx: CmdCtx): string {
  switch (ctx.sh.distro.id) {
    case 'ubuntu':
      return 'http://www.ubuntu.com/support';
    case 'debian':
      return 'https://www.debian.org/support';
    default:
      return 'https://lists.freedesktop.org/mailman/listinfo/systemd-devel';
  }
}

function journalLine(ctx: CmdCtx, e: JournalEntry, output = 'short'): string {
  if (output === 'cat') return e.msg;
  const time = output === 'short-iso' ? isoTime(e.t) : shortTime(e.t);
  const who = e.ident === 'kernel' || e.pid === undefined ? e.ident : `${e.ident}[${e.pid}]`;
  const msg = e.prio <= 3 ? paint(ctx, COLOR.red, e.msg) : e.prio === 4 ? paint(ctx, BOLD_YELLOW, e.msg) : e.prio === 5 ? paint(ctx, COLOR.bold, e.msg) : e.msg;
  return `${time} ${ctx.sh.distro.hostname} ${who}: ${msg}`;
}

function catalogLines(ctx: CmdCtx, e: JournalEntry): string[] {
  if (!e.x) return [];
  return [`Subject: ${e.x.subject}`, 'Defined-By: systemd', `Support: ${supportUrl(ctx)}`, '', ...e.x.body].map((l) => `░░ ${l}`.trimEnd() + (l === '' ? ' ' : ''));
}

const AUTH = 'Interactive authentication required.';

function sudoTip(ctx: CmdCtx): void {
  tip(ctx, {
    sv: '(Att ändra tjänster kräver root – sätt sudo framför kommandot.)',
    en: '(Changing services requires root – put sudo in front of the command.)',
  });
}

function isRoot(ctx: CmdCtx): boolean {
  return ctx.sh.currentUser().uid === 0;
}

// ---------- systemctl ----------

function activeText(ctx: CmdCtx, rt: UnitRt): string {
  const now = Date.now();
  const since = rt.since !== undefined ? ` since ${longTime(rt.since)}; ${span(now - rt.since)} ago` : '';
  if (rt.active === 'active') return `${paint(ctx, BOLD_GREEN, `active (${rt.sub})`)}${since}`;
  if (rt.active === 'failed') return `${paint(ctx, COLOR.red, `failed (Result: ${rt.result ?? 'exit-code'})`)}${since}`;
  return `inactive (dead)${since}`;
}

function dot(ctx: CmdCtx, rt: UnitRt): string {
  if (rt.active === 'active') return paint(ctx, BOLD_GREEN, '●');
  if (rt.active === 'failed') return paint(ctx, COLOR.red, '×');
  return '○';
}

function changedWarning(ctx: CmdCtx, rt: UnitRt): string {
  return paint(
    ctx,
    COLOR.red,
    `Warning: The unit file, source configuration file or drop-ins of ${rt.name} changed on disk. Run 'systemctl daemon-reload' to reload units.`,
  );
}

function statusText(ctx: CmdCtx, rt: UnitRt, lines: number): string {
  const sh = ctx.sh;
  const info = unitInfo(rt);
  const en = enabledState(sh, rt);
  const out: string[] = [];
  out.push(`${dot(ctx, rt)} ${rt.name}${info.description ? ` - ${info.description}` : ''}`);
  out.push(`     Loaded: loaded (${rt.path}; ${en === 'static' ? 'static' : `${en}; preset: ${presetState(sh)}`})`);
  out.push(`     Active: ${activeText(ctx, rt)}`);
  if (rt.active !== 'active' && rt.startedAt !== undefined && rt.since !== undefined && rt.since > rt.startedAt) {
    out.push(`   Duration: ${span(rt.since - rt.startedAt)}`);
  }
  info.docs.forEach((doc, i) => out.push(`${i === 0 ? '       Docs: ' : '             '}${doc}`));
  if (rt.active === 'failed' && rt.lastPid !== undefined) {
    out.push(`    Process: ${rt.lastPid} ExecStart=${info.exec} (${rt.exitInfo})`);
  }
  if (rt.pid !== undefined) {
    const proc = sh.proc.procs.find((p) => p.pid === rt.pid);
    out.push(`   Main PID: ${rt.pid} (${proc ? procName(proc) : info.exec.split(' ')[0].split('/').pop()})`);
    out.push('      Tasks: 1 (limit: 9387)');
    out.push(`     Memory: ${((proc?.rss ?? 4096) / 1024).toFixed(1)}M`);
    out.push(`        CPU: ${proc?.time === '0:00' || !proc ? '23ms' : `${proc.time.replace(':', 'min ')}s`}`);
    out.push(`     CGroup: /system.slice/${rt.name}`);
    out.push(`             └─${rt.pid} ${proc?.cmd ?? info.exec}`);
  } else if (rt.lastPid !== undefined && rt.exitInfo) {
    out.push(`   Main PID: ${rt.lastPid} (${rt.exitInfo})`);
  }
  if (rt.active === 'active' && rt.sub === 'exited' && rt.lastPid !== undefined) {
    out.push(`    Process: ${rt.lastPid} ExecStart=${info.exec} (${rt.exitInfo})`);
  }
  if (changedOnDisk(sh, rt)) out.push('', changedWarning(ctx, rt));
  const boot = currentBoot(sh);
  // Som i nyare systemd: bara raderna från tjänstens senaste start (eller stopp).
  const from = rt.startedAt ?? 0;
  const entries = sh.services.journal.filter((e) => e.unit === rt.name && e.boot === boot && e.t >= from).slice(-lines);
  if (entries.length && lines > 0) {
    out.push('');
    for (const e of entries) out.push(journalLine(ctx, e));
  }
  return out.join('\n') + '\n';
}

function systemOverview(ctx: CmdCtx): string {
  const sh = ctx.sh;
  const units = Object.values(sh.services.units);
  const failed = units.filter((u) => u.active === 'failed').length;
  const boot = sh.services.boots.at(-1)!;
  const state = failed ? paint(ctx, COLOR.red, 'degraded') : paint(ctx, BOLD_GREEN, 'running');
  return (
    `${failed ? paint(ctx, COLOR.red, '×') : paint(ctx, BOLD_GREEN, '●')} ${sh.distro.hostname}\n` +
    `    State: ${state}\n` +
    `    Units: ${units.length + 230} loaded (incl. loaded aliases)\n` +
    `     Jobs: 0 queued\n` +
    `   Failed: ${failed} units\n` +
    `    Since: ${longTime(boot.start)}; ${span(Date.now() - boot.start)} ago\n` +
    `  systemd: ${systemdVersion(sh.distro).major}\n` +
    `   CGroup: /\n` +
    `           ├─init.scope\n` +
    `           │ └─1 /sbin/init\n` +
    `           ├─system.slice\n` +
    units
      .filter((u) => u.pid !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((u) => `           │ ├─${u.name}\n           │ │ └─${u.pid} ${unitInfo(u).exec}\n`)
      .join('') +
    `           └─user.slice\n`
  );
}

function table(rows: string[][]): string[] {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => (r[i] ?? '').length)));
  return rows.map((r) => r.map((cell, i) => (i === r.length - 1 ? cell : cell.padEnd(widths[i]))).join(' ').trimEnd());
}

interface ListOpts {
  all: boolean;
  states: string[];
  types: string[];
}

function listUnits(ctx: CmdCtx, o: ListOpts): number {
  const sh = ctx.sh;
  let units = Object.values(sh.services.units).sort((a, b) => a.name.localeCompare(b.name));
  if (o.types.length && !o.types.includes('service')) units = [];
  if (o.states.length) units = units.filter((u) => o.states.includes(u.active) || o.states.includes(u.sub));
  else if (!o.all) units = units.filter((u) => u.active !== 'inactive');
  const rows = [['UNIT', 'LOAD', 'ACTIVE', 'SUB', 'DESCRIPTION'], ...units.map((u) => [u.name, 'loaded', u.active, u.sub, unitInfo(u).description])];
  const lines = table(rows);
  ctx.out(`  ${lines[0]}\n`);
  units.forEach((u, i) => {
    const line = lines[i + 1];
    ctx.out(u.active === 'failed' ? `${paint(ctx, COLOR.red, '●')} ${paint(ctx, COLOR.red, line)}\n` : `  ${line}\n`);
  });
  if (units.length) {
    ctx.out(
      '\nLegend: LOAD   → Reflects whether the unit definition was properly loaded.\n' +
        '        ACTIVE → The high-level unit activation state, i.e. generalization of SUB.\n' +
        '        SUB    → The low-level unit activation state, values depend on unit type.\n',
    );
  }
  ctx.out(`\n${units.length} loaded units listed.${o.all || o.states.length ? '' : ' Pass --all to see loaded but inactive units, too.'}\n`);
  if (!o.states.length) ctx.out("To show all installed unit files use 'systemctl list-unit-files'.\n");
  return 0;
}

function listUnitFiles(ctx: CmdCtx, o: ListOpts): number {
  const sh = ctx.sh;
  const names = new Set<string>();
  for (const dir of [SYSTEM_UNIT_DIR, ADMIN_UNIT_DIR]) {
    const node = sh.vfs.tryLookup(dir, sh.rootUser());
    for (const [name, child] of Object.entries(node?.children ?? {})) if (child.type === 'file' && name.endsWith('.service')) names.add(name);
  }
  const rows: string[][] = [['UNIT FILE', 'STATE', 'PRESET']];
  for (const name of [...names].sort()) {
    const rt = resolveUnit(sh, name);
    if (!rt) continue;
    const state = enabledState(sh, rt);
    if (o.states.length && !o.states.includes(state)) continue;
    rows.push([name, state, state === 'static' ? '-' : presetState(sh)]);
    for (const alias of unitInfo(rt).alias) if (!o.states.length || o.states.includes('alias')) rows.push([alias, 'alias', '-']);
  }
  if (o.types.length && !o.types.includes('service')) rows.length = 1;
  for (const line of table(rows)) ctx.out(line + '\n');
  ctx.out(`\n${rows.length - 1} unit files listed.\n`);
  return 0;
}

function jobFailed(ctx: CmdCtx, rt: UnitRt): void {
  ctx.err(
    `Job for ${rt.name} failed because the control process exited with error code.\n` +
      `See "systemctl status ${rt.name}" and "journalctl -xeu ${rt.name}" for details.\n`,
  );
}

const SYSTEMCTL_HELP = `systemctl [OPTIONS...] COMMAND ...

Query or send control commands to the system manager.

Unit Commands:
  list-units [PATTERN...]             List units currently in memory
  status [PATTERN...|PID...]          Show runtime status of one or more units
  cat PATTERN...                      Show files and drop-ins of specified units
  start UNIT...                       Start (activate) one or more units
  stop UNIT...                        Stop (deactivate) one or more units
  reload UNIT...                      Reload one or more units
  restart UNIT...                     Start or restart one or more units
  is-active PATTERN...                Check whether units are active
  is-failed PATTERN...                Check whether units are failed
  reset-failed [PATTERN...]           Reset failed state for all, one, or more units

Unit File Commands:
  list-unit-files [PATTERN...]        List installed unit files
  enable [UNIT...|PATH...]            Enable one or more unit files
  disable UNIT...                     Disable one or more unit files
  is-enabled UNIT...                  Check whether unit files are enabled

Manager State Commands:
  daemon-reload                       Reload systemd manager configuration
  is-system-running                   Check whether system is fully running

System Commands:
  reboot                              Shut down and reboot the system

Options:
  -t --type=TYPE         List units of a particular type
     --state=STATE       List units with particular LOAD or SUB or ACTIVE state
     --failed            Shortcut for --state=failed
  -a --all               Show all units, including inactive ones
     --now               Start or stop unit after enabling or disabling it
  -q --quiet             Suppress output
     --no-pager          Do not pipe output into a pager
  -l --full              Don't ellipsize unit names on output
  -n --lines=INTEGER     Number of journal entries to show
`;

const VERB_NEEDS_ROOT = new Set(['start', 'stop', 'restart', 'try-restart', 'reload', 'reload-or-restart', 'enable', 'disable', 'daemon-reload', 'reset-failed', 'reboot']);

const systemctl: CommandDef = {
  name: 'systemctl',
  summary: 'Styr tjänster (systemd): status, start, stop, enable …',
  summaryEn: 'Control services (systemd): status, start, stop, enable …',
  man: `NAMN
       systemctl - styr systemd och tjänsterna på datorn

SYNOPSIS
       systemctl [FLAGGOR] KOMMANDO [TJÄNST]...

BESKRIVNING
       En tjänst (service) är ett program som körs i bakgrunden, t.ex.
       ssh-servern. systemd startar tjänsterna och håller koll på dem.
       Tjänstens namn kan skrivas med eller utan ".service".
       Kommandon som ändrar något kräver root (sudo).

KOMMANDON
       status [TJÄNST]      visa om tjänsten kör, dess PID och senaste loggrader
       start TJÄNST         starta nu
       stop TJÄNST          stoppa nu
       restart TJÄNST       stoppa och starta igen
       reload TJÄNST        be tjänsten läsa om sina inställningar
       enable TJÄNST        starta automatiskt vid uppstart (--now: starta också nu)
       disable TJÄNST       starta inte vid uppstart (--now: stoppa också nu)
       is-active TJÄNST     skriv ut active/inactive/failed
       is-enabled TJÄNST    skriv ut enabled/disabled/static
       list-units           lista tjänster som är laddade (--all: även stoppade)
       list-unit-files      lista alla installerade unit-filer
       cat TJÄNST           visa tjänstens unit-fil
       daemon-reload        läs om unit-filerna efter att du ändrat dem
       reset-failed         glöm att en tjänst har misslyckats
       reboot               starta om datorn

FLAGGOR
       --failed             bara tjänster som har misslyckats
       --type=service       bara tjänster (i simulatorn finns bara tjänster)
       --all, -a            även tjänster som inte kör
       --now                med enable/disable: starta/stoppa direkt också
       -q                   tyst (för is-active m.fl. i skript)

EXEMPEL
       systemctl status sshd
       sudo systemctl restart minserver
       sudo systemctl enable --now minserver
       systemctl --failed`,
  manEn: `NAME
       systemctl - control systemd and the services on the computer

SYNOPSIS
       systemctl [OPTIONS] COMMAND [UNIT]...

DESCRIPTION
       A service is a program that runs in the background, e.g. the ssh
       server. systemd starts the services and keeps track of them. The
       service name can be written with or without ".service". Commands
       that change something require root (sudo).

COMMANDS
       status [UNIT]        show whether it runs, its PID and recent log lines
       start UNIT           start now
       stop UNIT            stop now
       restart UNIT         stop and start again
       reload UNIT          ask the service to re-read its configuration
       enable UNIT          start automatically at boot (--now: also start now)
       disable UNIT         don't start at boot (--now: also stop now)
       is-active UNIT       print active/inactive/failed
       is-enabled UNIT      print enabled/disabled/static
       list-units           list loaded services (--all: also stopped ones)
       list-unit-files      list all installed unit files
       cat UNIT             show the unit file
       daemon-reload        re-read unit files after you changed them
       reset-failed         forget that a service has failed
       reboot               reboot the computer

OPTIONS
       --failed             only services that have failed
       --type=service       only services (the simulator only has services)
       --all, -a            also services that are not running
       --now                with enable/disable: start/stop right away too
       -q                   quiet (for is-active etc. in scripts)

EXAMPLES
       systemctl status sshd
       sudo systemctl restart minserver
       sudo systemctl enable --now minserver
       systemctl --failed`,
  run(ctx) {
    const sh = ctx.sh;
    const o: ListOpts = { all: false, states: [], types: [] };
    let now = false;
    let quiet = false;
    let lines = 10;
    const operands: string[] = [];
    const args = ctx.args;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      const eq = a.indexOf('=');
      const key = a.startsWith('--') && eq > 0 ? a.slice(0, eq) : a;
      const val = () => (a.startsWith('--') && eq > 0 ? a.slice(eq + 1) : args[++i] ?? '');
      if (a === '--') {
        operands.push(...args.slice(i + 1));
        break;
      } else if (key === '--type' || key === '-t') o.types.push(...val().split(','));
      else if (key === '--state') o.states.push(...val().split(','));
      else if (key === '--lines' || key === '-n') lines = Number(val()) || 0;
      else if (a === '--failed') o.states.push('failed');
      else if (a === '--all' || a === '-a') o.all = true;
      else if (a === '--now') now = true;
      else if (a === '--quiet' || a === '-q') quiet = true;
      else if (['--no-pager', '--full', '-l', '--no-block', '--system', '--no-legend', '--plain', '--no-ask-password', '--force', '-f'].includes(a)) continue;
      else if (a === '--user') {
        ctx.err('Failed to connect to user scope bus via local transport: No medium found\n');
        tip(ctx, { sv: '(Simulatorn har bara systemtjänster – skippa --user.)', en: '(The simulator only has system services – skip --user.)' });
        return 1;
      } else if (a === '-h' || a === '--help') {
        ctx.out(SYSTEMCTL_HELP);
        return 0;
      } else if (a === '--version') {
        const v = systemdVersion(sh.distro);
        ctx.out(`systemd ${v.major} (${v.full})\n+PAM +AUDIT +SELINUX +APPARMOR +SECCOMP +ACL +BLKID +KMOD +PCRE2 +ZSTD +BPF_FRAMEWORK\n`);
        return 0;
      } else if (a.startsWith('-') && a.length > 1) {
        ctx.err(`systemctl: unrecognized option '${a}'\n`);
        return 1;
      } else operands.push(a);
    }
    syncServices(sh);
    const verb = operands.shift() ?? 'list-units';
    const units = operands;

    if (VERB_NEEDS_ROOT.has(verb) && units.length === 0 && !['daemon-reload', 'reset-failed', 'reboot'].includes(verb)) {
      ctx.err(`Too few arguments.\n`);
      return 1;
    }

    // Finns tjänsterna? (Kontrolleras före behörigheten – ett felstavat namn är det vanligaste felet.)
    const resolved: UnitRt[] = [];
    if (['start', 'stop', 'restart', 'try-restart', 'reload', 'reload-or-restart', 'enable', 'disable'].includes(verb)) {
      for (const u of units) {
        const rt = resolveUnit(sh, u);
        if (!rt) {
          if (verb === 'enable' || verb === 'disable') ctx.err(`Failed to ${verb} unit: Unit file ${unitName(u)} does not exist.\n`);
          else ctx.err(`Failed to ${verb} ${unitName(u)}: Unit ${unitName(u)} not found.\n`);
          return verb === 'enable' || verb === 'disable' ? 1 : 5;
        }
        resolved.push(rt);
      }
    }

    if (VERB_NEEDS_ROOT.has(verb) && !isRoot(ctx)) {
      if (verb === 'enable' || verb === 'disable') ctx.err(`Failed to ${verb} unit: ${AUTH}\n`);
      else if (verb === 'daemon-reload') ctx.err(`Failed to reload daemon: ${AUTH}\n`);
      else if (verb === 'reboot') ctx.err(`Call to Reboot failed: ${AUTH}\n`);
      else if (verb === 'reset-failed') ctx.err(`Failed to reset failed state of unit ${unitName(units[0] ?? '')}: ${AUTH}\n`);
      else {
        const name = resolved[0]?.name ?? unitName(units[0]);
        ctx.err(`Failed to ${verb} ${name}: ${AUTH}\nSee system logs and 'systemctl status ${name}' for details.\n`);
      }
      sudoTip(ctx);
      return 1;
    }

    const t = Date.now();
    switch (verb) {
      case 'list-units':
        return listUnits(ctx, o);
      case 'list-unit-files':
        return listUnitFiles(ctx, o);
      case 'status': {
        if (!units.length) {
          ctx.out(systemOverview(ctx));
          return 0;
        }
        let code = 0;
        let first = true;
        for (const u of units) {
          const rt = resolveUnit(sh, u);
          if (!rt) {
            ctx.err(/^\d+$/.test(u) ? `Failed to get unit for PID ${u}: PID ${u} does not belong to any loaded unit.\n` : `Unit ${unitName(u)} could not be found.\n`);
            code = 4;
            continue;
          }
          if (!first) ctx.out('\n');
          first = false;
          ctx.out(statusText(ctx, rt, lines));
          if (rt.active !== 'active' && code === 0) code = 3;
        }
        return code;
      }
      case 'start':
      case 'restart':
      case 'try-restart':
      case 'reload-or-restart': {
        let code = 0;
        for (const rt of resolved) {
          if (verb === 'try-restart' && rt.active !== 'active') continue;
          if (changedOnDisk(sh, rt)) ctx.err(changedWarning(ctx, rt) + '\n');
          if (verb !== 'start') stopUnit(sh, rt, t);
          if (!startUnit(sh, rt, t).ok) {
            jobFailed(ctx, rt);
            code = 1;
          }
        }
        return code;
      }
      case 'stop':
        for (const rt of resolved) {
          if (changedOnDisk(sh, rt)) ctx.err(changedWarning(ctx, rt) + '\n');
          stopUnit(sh, rt, t);
        }
        return 0;
      case 'reload':
        for (const rt of resolved) {
          const info = unitInfo(rt);
          if (!info.reload) {
            ctx.err(`Failed to reload ${rt.name}: Job type reload is not applicable for unit ${rt.name}.\n`);
            return 1;
          }
          if (rt.active !== 'active') {
            ctx.err(`Failed to reload ${rt.name}: Unit ${rt.name} is not active.\n`);
            return 1;
          }
          const desc = `${rt.name} - ${info.description}`;
          log(sh, t, 'systemd', `Reloading ${desc}...`, { unit: rt.name });
          if (rt.pid !== undefined) log(sh, t, info.exec.split(' ')[0].split('/').pop()!, 'Received SIGHUP; reloading configuration.', { unit: rt.name, pid: rt.pid });
          log(sh, t, 'systemd', `Reloaded ${desc}.`, { unit: rt.name });
        }
        return 0;
      case 'enable':
      case 'disable': {
        let code = 0;
        for (const rt of resolved) {
          if (!unitInfo(rt).wantedBy.length) {
            ctx.err(
              'The unit files have no installation config (WantedBy=, RequiredBy=, UpheldBy=,\n' +
                'Also=, or Alias= settings in the [Install] section, and DefaultInstance= for\n' +
                'template units). This means they are not meant to be enabled or disabled using systemctl.\n',
            );
            continue;
          }
          const change = verb === 'enable' ? enableUnit(sh, rt) : disableUnit(sh, rt);
          for (const c of change.created) ctx.err(`Created symlink ${c}.\n`);
          for (const r of change.removed) ctx.err(`Removed "${r}".\n`);
          if (now) {
            if (verb === 'enable') {
              if (!startUnit(sh, rt, t).ok) {
                jobFailed(ctx, rt);
                code = 1;
              }
            } else stopUnit(sh, rt, t);
          }
        }
        return code;
      }
      case 'daemon-reload':
        daemonReload(sh);
        log(sh, t, 'systemd', 'Reloading requested from client PID ' + sh.proc.nextPid + ' (\'systemctl\')...');
        log(sh, t, 'systemd', 'Reloading finished in 112 ms.');
        return 0;
      case 'reset-failed': {
        const list = units.length ? units.map((u) => resolveUnit(sh, u)).filter((u): u is UnitRt => !!u) : Object.values(sh.services.units);
        for (const rt of list) if (rt.active === 'failed') Object.assign(rt, { active: 'inactive', sub: 'dead', result: undefined });
        return 0;
      }
      case 'is-active':
      case 'is-failed':
      case 'is-enabled': {
        if (!units.length) {
          ctx.err('Too few arguments.\n');
          return 1;
        }
        let code = verb === 'is-failed' ? 1 : 0;
        let anyOk = false;
        for (const u of units) {
          const rt = resolveUnit(sh, u);
          if (verb === 'is-enabled') {
            if (!rt) {
              if (!quiet) ctx.err(`Failed to get unit file state for ${unitName(u)}: No such file or directory\n`);
              code = 1;
              continue;
            }
            const state = enabledState(sh, rt, u);
            if (!quiet) ctx.out(state + '\n');
            if (state === 'disabled') code = 1;
            continue;
          }
          const state = rt?.active ?? 'inactive';
          if (!quiet) ctx.out(state + '\n');
          if (verb === 'is-active' && state !== 'active') code = rt ? 3 : 4;
          if (verb === 'is-failed' && state === 'failed') anyOk = true;
        }
        return verb === 'is-failed' ? (anyOk ? 0 : 1) : code;
      }
      case 'is-system-running': {
        const failed = Object.values(sh.services.units).some((u) => u.active === 'failed');
        if (!quiet) ctx.out(failed ? 'degraded\n' : 'running\n');
        return failed ? 1 : 0;
      }
      case 'cat': {
        if (!units.length) {
          ctx.err('Too few arguments.\n');
          return 1;
        }
        let code = 0;
        units.forEach((u, i) => {
          const rt = resolveUnit(sh, u);
          if (!rt) {
            ctx.err(`No files found for ${unitName(u)}.\n`);
            code = 1;
            return;
          }
          if (changedOnDisk(sh, rt)) ctx.err(changedWarning(ctx, rt) + '\n');
          const content = sh.vfs.tryLookup(rt.path, sh.rootUser())?.content ?? rt.loaded;
          ctx.out(`${i > 0 ? '\n' : ''}${paint(ctx, '\x1b[34m', `# ${rt.path}`)}\n${content}`);
        });
        return code;
      }
      case 'reboot':
        return doReboot(ctx);
      case 'poweroff':
      case 'halt':
        ctx.err(`Call to PowerOff failed: ${AUTH}\n`);
        tip(ctx, { sv: '(Simulatorn kan inte stängas av – prova sudo systemctl reboot i stället.)', en: "(The simulator can't be powered off – try sudo systemctl reboot instead.)" });
        return 1;
      default:
        ctx.err(`Unknown command verb '${verb}'.\n`);
        return 1;
    }
  },
};

function doReboot(ctx: CmdCtx): number {
  const sh = ctx.sh;
  reboot(sh);
  // Alla sessioner försvinner vid omstart: eleven loggar in på nytt i hemkatalogen.
  sh.userStack.splice(0, sh.userStack.length, 'elev');
  const home = '/home/elev';
  Object.assign(sh.env, { USER: 'elev', LOGNAME: 'elev', HOME: home, PWD: home });
  sh.cwd = home;
  ctx.out(
    `${COLOR.dim}${sh.msg({
      sv: '(Datorn startar om … klart! Du är inloggad som elev igen. Se vad som hände med journalctl -b -1 (förra uppstarten) och journalctl -b.)',
      en: "(The computer reboots … done! You're logged in as elev again. See what happened with journalctl -b -1 (previous boot) and journalctl -b.)",
    })}${COLOR.reset}\n`,
  );
  return 0;
}

const rebootCmd: CommandDef = {
  name: 'reboot',
  summary: 'Startar om datorn',
  summaryEn: 'Reboot the computer',
  man: `NAMN
       reboot - starta om datorn

SYNOPSIS
       sudo reboot

BESKRIVNING
       Samma sak som "systemctl reboot": alla tjänster stoppas och datorn
       startar om. Efter omstarten körs bara de tjänster som är aktiverade
       (enable). I simulatorn startar datorn om på ett ögonblick.`,
  manEn: `NAME
       reboot - reboot the computer

SYNOPSIS
       sudo reboot

DESCRIPTION
       Same as "systemctl reboot": all services are stopped and the
       computer restarts. After the reboot only enabled services run.
       In the simulator the reboot takes no time at all.`,
  run(ctx) {
    if (!isRoot(ctx)) {
      ctx.err(`Call to Reboot failed: ${AUTH}\n`);
      sudoTip(ctx);
      return 1;
    }
    return doReboot(ctx);
  },
};

// ---------- journalctl ----------

const PRIOS = ['emerg', 'alert', 'crit', 'err', 'warning', 'notice', 'info', 'debug'];

function parsePrio(s: string): [number, number] | null {
  const one = (x: string): number | null => {
    if (/^[0-7]$/.test(x)) return Number(x);
    const i = PRIOS.indexOf(x.toLowerCase() === 'error' ? 'err' : x.toLowerCase() === 'warn' ? 'warning' : x.toLowerCase());
    return i >= 0 ? i : null;
  };
  if (s.includes('..')) {
    const [a, b] = s.split('..');
    const lo = one(a || 'emerg');
    const hi = one(b || 'debug');
    return lo === null || hi === null ? null : [Math.min(lo, hi), Math.max(lo, hi)];
  }
  const p = one(s);
  return p === null ? null : [0, p];
}

/** Tolkar tider som "today", "yesterday", "10:00", "2026-10-30 08:00", "-1h", "1 hour ago". */
export function parseSince(s: string, now = Date.now()): number | null {
  const v = s.trim().toLowerCase();
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  if (v === 'now') return now;
  if (v === 'today') return midnight.getTime();
  if (v === 'yesterday') return midnight.getTime() - 86_400_000;
  if (v === 'tomorrow') return midnight.getTime() + 86_400_000;
  const units: Record<string, number> = { s: 1, sec: 1, second: 1, seconds: 1, m: 60, min: 60, minute: 60, minutes: 60, h: 3600, hour: 3600, hours: 3600, d: 86400, day: 86400, days: 86400 };
  let m = /^([+-])\s*(\d+)\s*([a-z]+)$/.exec(v);
  if (m && units[m[3]]) return now + (m[1] === '-' ? -1 : 1) * Number(m[2]) * units[m[3]] * 1000;
  m = /^(\d+)\s*([a-z]+)\s+ago$/.exec(v);
  if (m && units[m[2]]) return now - Number(m[1]) * units[m[2]] * 1000;
  m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(v);
  if (m) return midnight.getTime() + (Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0)) * 1000;
  m = /^(\d{4})-(\d{2})-(\d{2})(?:[ t](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(v);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0)).getTime();
  return null;
}

const journalctl: CommandDef = {
  name: 'journalctl',
  summary: 'Läser systemloggen (journalen)',
  summaryEn: 'Read the system log (the journal)',
  man: `NAMN
       journalctl - läs systemd:s logg, journalen

SYNOPSIS
       journalctl [FLAGGOR]

BESKRIVNING
       Allt som tjänsterna, kärnan och systemd skriver hamnar i journalen.
       Utan flaggor visas hela journalen, äldst först. Fel visas i rött och
       varningar i gult.

FLAGGOR
       -u TJÄNST        bara rader från tjänsten (t.ex. -u ssh)
       -n N             bara de N senaste raderna (-n utan tal: 10)
       -p PRIORITET     bara rader med den prioriteten eller allvarligare:
                        emerg alert crit err warning notice info debug
                        (eller 0–7). -p err visar bara fel.
       -b [N]           bara den här uppstarten; -b -1 = förra uppstarten
       --since TID      från och med TID: today, yesterday, "10:00",
                        "2026-10-30 08:00", "1 hour ago"
       --until TID      till och med TID
       -f               följ loggen: visa nya rader när de kommer (Ctrl+C)
       -e               hoppa till slutet
       -x               lägg till förklaringar till vissa rader
       -r               nyast först
       -k               bara kärnans meddelanden (som dmesg)
       -g MÖNSTER       bara rader som matchar MÖNSTER (reguljärt uttryck)
       -t NAMN          bara rader från programmet NAMN
       -o FORMAT        short (standard), short-iso eller cat
       --list-boots     lista uppstarterna som finns i journalen
       --disk-usage     visa hur mycket plats journalen tar

EXEMPEL
       journalctl -u minserver
       journalctl -xeu rapportd
       journalctl -p err -b
       journalctl --since today -u ssh
       journalctl -f`,
  manEn: `NAME
       journalctl - read the systemd log, the journal

SYNOPSIS
       journalctl [OPTIONS]

DESCRIPTION
       Everything the services, the kernel and systemd log ends up in the
       journal. Without options the whole journal is shown, oldest first.
       Errors are shown in red and warnings in yellow.

OPTIONS
       -u UNIT          only lines from the service (e.g. -u ssh)
       -n N             only the N most recent lines (-n without a number: 10)
       -p PRIORITY      only lines with that priority or more severe:
                        emerg alert crit err warning notice info debug
                        (or 0–7). -p err shows only errors.
       -b [N]           only this boot; -b -1 = the previous boot
       --since TIME     from TIME: today, yesterday, "10:00",
                        "2026-10-30 08:00", "1 hour ago"
       --until TIME     up to TIME
       -f               follow the log: show new lines as they arrive (Ctrl+C)
       -e               jump to the end
       -x               add explanations to some lines
       -r               newest first
       -k               only kernel messages (like dmesg)
       -g PATTERN       only lines matching PATTERN (regular expression)
       -t NAME          only lines from the program NAME
       -o FORMAT        short (default), short-iso or cat
       --list-boots     list the boots in the journal
       --disk-usage     show how much space the journal uses

EXAMPLES
       journalctl -u minserver
       journalctl -xeu rapportd
       journalctl -p err -b
       journalctl --since today -u ssh
       journalctl -f`,
  run(ctx) {
    const sh = ctx.sh;
    syncServices(sh);
    const st = sh.services;
    const args = ctx.args;
    const units: string[] = [];
    const idents: string[] = [];
    let lines: number | undefined;
    let prio: [number, number] | undefined;
    let boot: number | undefined;
    let since: number | undefined;
    let until: number | undefined;
    let follow = false;
    let catalog = false;
    let end = false;
    let reverse = false;
    let kernel = false;
    let output = 'short';
    let grep: RegExp | undefined;
    let listBoots = false;
    let diskUsage = false;

    const fail = (msg: string) => {
      ctx.err(msg + '\n');
      return 1;
    };
    const setTime = (which: 'since' | 'until', v: string | undefined): string | null => {
      if (v === undefined) return `option '--${which}' requires an argument`;
      const t = parseSince(v);
      if (t === null) return `Failed to parse timestamp: ${v}`;
      if (which === 'since') since = t;
      else until = t;
      return null;
    };

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a.startsWith('--')) {
        const eq = a.indexOf('=');
        const key = eq > 0 ? a.slice(2, eq) : a.slice(2);
        const attached = eq > 0 ? a.slice(eq + 1) : undefined;
        const value = () => attached ?? args[++i];
        const optional = (re: RegExp) => attached ?? (args[i + 1] !== undefined && re.test(args[i + 1]) ? args[++i] : undefined);
        let err: string | null = null;
        switch (key) {
          case 'unit': {
            const v = value();
            if (v === undefined) return fail("journalctl: option '--unit' requires an argument");
            units.push(v);
            break;
          }
          case 'identifier': {
            const v = value();
            if (v === undefined) return fail("journalctl: option '--identifier' requires an argument");
            idents.push(v);
            break;
          }
          case 'lines': {
            const v = optional(/^(\+?\d+|all)$/);
            lines = v === undefined ? 10 : v === 'all' ? Infinity : Number(v.replace('+', ''));
            break;
          }
          case 'priority': {
            const p = parsePrio(value() ?? '');
            if (!p) return fail(`Failed to parse priority value: ${attached ?? args[i]}`);
            prio = p;
            break;
          }
          case 'boot': {
            const v = optional(/^[+-]?\d+$/);
            boot = v === undefined ? 0 : Number(v);
            break;
          }
          case 'since':
            err = setTime('since', value());
            break;
          case 'until':
            err = setTime('until', value());
            break;
          case 'follow':
            follow = true;
            break;
          case 'catalog':
            catalog = true;
            break;
          case 'pager-end':
            end = true;
            break;
          case 'reverse':
            reverse = true;
            break;
          case 'dmesg':
            kernel = true;
            break;
          case 'output':
            output = value() ?? '';
            break;
          case 'grep': {
            const v = value() ?? '';
            try {
              grep = new RegExp(v, v === v.toLowerCase() ? 'i' : '');
            } catch {
              return fail(`Bad pattern "${v}"`);
            }
            break;
          }
          case 'list-boots':
            listBoots = true;
            break;
          case 'disk-usage':
            diskUsage = true;
            break;
          case 'no-pager':
          case 'full':
          case 'all':
          case 'quiet':
          case 'utc':
          case 'no-hostname':
          case 'system':
          case 'merge':
            break;
          case 'help':
            ctx.out('journalctl [OPTIONS...] [MATCHES...]\n\nQuery the journal.\n\nSee "man journalctl" for the options.\n');
            return 0;
          default:
            return fail(`journalctl: unrecognized option '${a}'`);
        }
        if (err) return fail(err);
        continue;
      }
      if (a.startsWith('-') && a.length > 1) {
        for (let j = 1; j < a.length; j++) {
          const c = a[j];
          const rest = a.slice(j + 1);
          const value = () => (rest ? rest : args[++i]);
          const optional = (re: RegExp) => (rest ? rest : args[i + 1] !== undefined && re.test(args[i + 1]) ? args[++i] : undefined);
          let stop = false;
          let err: string | null = null;
          switch (c) {
            case 'u':
            case 't': {
              const v = value();
              if (v === undefined) return fail(`journalctl: option requires an argument -- '${c}'`);
              (c === 'u' ? units : idents).push(v);
              stop = true;
              break;
            }
            case 'n': {
              const v = optional(/^(\+?\d+|all)$/);
              lines = v === undefined ? 10 : v === 'all' ? Infinity : Number(v.replace('+', ''));
              if (Number.isNaN(lines)) return fail(`Failed to parse lines '${v}'`);
              stop = true;
              break;
            }
            case 'p': {
              const v = value();
              const p = parsePrio(v ?? '');
              if (!p) return fail(`Failed to parse priority value: ${v ?? ''}`);
              prio = p;
              stop = true;
              break;
            }
            case 'b': {
              const v = optional(/^[+-]?\d+$/);
              boot = v === undefined ? 0 : Number(v);
              if (Number.isNaN(boot)) return fail(`Failed to parse boot descriptor '${v}'`);
              stop = true;
              break;
            }
            case 'S':
            case 'U':
              err = setTime(c === 'S' ? 'since' : 'until', value());
              stop = true;
              break;
            case 'o':
              output = value() ?? '';
              stop = true;
              break;
            case 'g': {
              const v = value() ?? '';
              try {
                grep = new RegExp(v, v === v.toLowerCase() ? 'i' : '');
              } catch {
                return fail(`Bad pattern "${v}"`);
              }
              stop = true;
              break;
            }
            case 'f':
              follow = true;
              break;
            case 'x':
              catalog = true;
              break;
            case 'e':
              end = true;
              break;
            case 'r':
              reverse = true;
              break;
            case 'k':
              kernel = true;
              break;
            case 'q':
            case 'a':
            case 'l':
              break;
            case 'h':
              ctx.out('journalctl [OPTIONS...] [MATCHES...]\n\nQuery the journal.\n\nSee "man journalctl" for the options.\n');
              return 0;
            default:
              return fail(`journalctl: invalid option -- '${c}'`);
          }
          if (err) return fail(err);
          if (stop) break;
        }
        continue;
      }
      // Matchningar som _SYSTEMD_UNIT=ssh.service eller _PID=733.
      const m = /^(_SYSTEMD_UNIT|UNIT|SYSLOG_IDENTIFIER|_COMM)=(.+)$/.exec(a);
      if (m) {
        if (m[1].endsWith('UNIT')) units.push(m[2]);
        else idents.push(m[2]);
        continue;
      }
      return fail(`Failed to add match '${a}': Invalid argument`);
    }

    if (!['short', 'short-iso', 'cat'].includes(output)) return fail(`Unknown output format '${output}'.`);

    const cur = currentBoot(sh);
    if (listBoots) {
      const rows = [['IDX', 'BOOT ID', 'FIRST ENTRY', 'LAST ENTRY']];
      st.boots.forEach((b, i) => {
        const entries = st.journal.filter((e) => e.boot === i);
        const first = entries[0]?.t ?? b.start;
        const last = entries.at(-1)?.t ?? b.start;
        rows.push([String(i - cur).padStart(3), b.id, longTime(first), longTime(last)]);
      });
      for (const line of table(rows)) ctx.out(line + '\n');
      return 0;
    }
    if (diskUsage) {
      ctx.out(`Archived and active journals take up ${(8 + st.boots.length * 8).toFixed(1)}M in the file system.\n`);
      return 0;
    }

    let entries = st.journal;
    if (boot !== undefined || kernel) {
      const b = boot === undefined ? 0 : boot;
      const idx = b <= 0 ? cur + b : b - 1;
      if (idx < 0 || idx > cur) return fail(`Data from the specified boot (${b > 0 ? '+' : ''}${b}) is not available: No such boot ID in journal`);
      entries = entries.filter((e) => e.boot === idx);
    }
    if (kernel) entries = entries.filter((e) => e.ident === 'kernel');
    if (units.length) {
      const names = units.map((u) => resolveUnit(sh, u)?.name ?? unitName(u));
      entries = entries.filter((e) => e.unit !== undefined && names.includes(e.unit));
    }
    if (idents.length) entries = entries.filter((e) => idents.includes(e.ident));
    if (prio) entries = entries.filter((e) => e.prio >= prio![0] && e.prio <= prio![1]);
    if (since !== undefined) entries = entries.filter((e) => e.t >= since!);
    if (until !== undefined) entries = entries.filter((e) => e.t <= until!);
    if (grep) entries = entries.filter((e) => grep!.test(e.msg));
    const n = lines ?? (follow ? 10 : end ? 1000 : Infinity);
    if (Number.isFinite(n)) entries = entries.slice(Math.max(0, entries.length - n));
    if (reverse) entries = [...entries].reverse();

    if (!entries.length) {
      if (!follow) ctx.out('-- No entries --\n');
    }
    let prevBoot: number | undefined;
    for (const e of entries) {
      if (prevBoot !== undefined && e.boot !== prevBoot) ctx.out(`-- Boot ${st.boots[e.boot]?.id ?? '?'} --\n`);
      prevBoot = e.boot;
      ctx.out(journalLine(ctx, e, output) + '\n');
      if (catalog) for (const l of catalogLines(ctx, e)) ctx.out(l + '\n');
    }
    if (follow) {
      tip(ctx, {
        sv: '(journalctl -f fortsätter att visa nya rader tills du trycker Ctrl+C. Simulatorn visar bara de senaste raderna.)',
        en: '(journalctl -f keeps showing new lines until you press Ctrl+C. The simulator only shows the latest lines.)',
      });
    }
    return 0;
  },
};

// ---------- hostnamectl ----------

const hostnamectl: CommandDef = {
  name: 'hostnamectl',
  summary: 'Visar eller ändrar datorns namn och systeminformation',
  summaryEn: "Show or change the computer's hostname and system information",
  man: `NAMN
       hostnamectl - visa eller ändra datorns namn

SYNOPSIS
       hostnamectl [status]
       sudo hostnamectl set-hostname NAMN

BESKRIVNING
       Utan argument visas datorns namn, operativsystem, kärna och
       arkitektur. set-hostname skriver det nya namnet till /etc/hostname.`,
  manEn: `NAME
       hostnamectl - show or change the computer's hostname

SYNOPSIS
       hostnamectl [status]
       sudo hostnamectl set-hostname NAME

DESCRIPTION
       Without arguments the hostname, operating system, kernel and
       architecture are shown. set-hostname writes the new name to
       /etc/hostname.`,
  run(ctx) {
    const sh = ctx.sh;
    const ops = ctx.args.filter((a) => !a.startsWith('-'));
    const verb = ops[0] ?? 'status';
    const root = sh.rootUser();
    const hostname = (sh.vfs.tryLookup('/etc/hostname', root)?.content ?? sh.distro.hostname).trim();
    if (verb === 'hostname' && !ops[1]) {
      ctx.out(hostname + '\n');
      return 0;
    }
    if (verb === 'set-hostname' || verb === 'hostname') {
      const name = ops[1];
      if (!name) {
        ctx.err('Too few arguments.\n');
        return 1;
      }
      if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,62})$/.test(name)) {
        ctx.err(`Invalid static hostname '${name}'\n`);
        return 1;
      }
      if (!isRoot(ctx)) {
        ctx.err(`Could not set static hostname: ${AUTH}\n`);
        sudoTip(ctx);
        return 1;
      }
      sh.vfs.writeFile('/etc/hostname', name + '\n', root);
      tip(ctx, {
        sv: '(Namnet är sparat i /etc/hostname. I simulatorn visar prompten fortfarande det gamla namnet.)',
        en: '(The name is saved in /etc/hostname. In the simulator the prompt still shows the old name.)',
      });
      return 0;
    }
    if (verb !== 'status') {
      ctx.err(`Unknown command verb '${verb}'.\n`);
      return 1;
    }
    const pretty = /PRETTY_NAME="([^"]+)"/.exec(sh.distro.osRelease)?.[1] ?? sh.distro.name;
    const boot = sh.services.boots.at(-1);
    ctx.out(
      ` Static hostname: ${hostname}\n` +
        `       Icon name: computer-vm\n` +
        `         Chassis: vm\n` +
        `      Machine ID: ${sh.services.machineId}\n` +
        `         Boot ID: ${boot?.id ?? ''}\n` +
        `  Virtualization: kvm\n` +
        `Operating System: ${pretty}\n` +
        `          Kernel: Linux ${sh.distro.kernel}\n` +
        `    Architecture: x86-64\n` +
        ` Hardware Vendor: QEMU\n` +
        `  Hardware Model: Standard PC _Q35 + ICH9, 2009_\n`,
    );
    return 0;
  },
};

// ---------- systemd-analyze ----------

function fakeMs(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 20 + (h % 1800);
}

const analyze: CommandDef = {
  name: 'systemd-analyze',
  summary: 'Visar hur lång tid uppstarten tog',
  summaryEn: 'Show how long the boot took',
  man: `NAMN
       systemd-analyze - analysera uppstarten

SYNOPSIS
       systemd-analyze [time]
       systemd-analyze blame

BESKRIVNING
       Utan argument (eller med time) visas hur lång tid kärnan och
       tjänsterna tog att starta. blame listar tjänsterna med den som tog
       längst tid först – bra för att hitta varför datorn startar långsamt.`,
  manEn: `NAME
       systemd-analyze - analyze the boot

SYNOPSIS
       systemd-analyze [time]
       systemd-analyze blame

DESCRIPTION
       Without arguments (or with time) it shows how long the kernel and
       the services took to start. blame lists the services with the
       slowest first – useful for finding out why the computer boots slowly.`,
  run(ctx) {
    const sh = ctx.sh;
    const verb = ctx.args.filter((a) => !a.startsWith('-'))[0] ?? 'time';
    const cur = currentBoot(sh);
    if (verb === 'time') {
      const line = sh.services.journal.find((e) => e.boot === cur && e.msg.startsWith('Startup finished'))?.msg;
      const m = /in (\S+) \(kernel\) \+ (\S+) \(userspace\) = (\S+)\./.exec(line ?? '');
      const [k, u, total] = m ? [m[1], m[2], m[3]] : ['2.153s', '4.871s', '7.024s'];
      ctx.out(`Startup finished in ${k} (kernel) + ${u} (userspace) = ${total} \nmulti-user.target reached after ${u} in userspace.\n`);
      return 0;
    }
    if (verb === 'blame') {
      const started = new Set(sh.services.journal.filter((e) => e.boot === cur && e.unit && e.ident === 'systemd').map((e) => e.unit!));
      const rows = [...started].map((name) => ({ name, ms: fakeMs(name) })).sort((a, b) => b.ms - a.ms);
      for (const r of rows) ctx.out(`${(r.ms >= 1000 ? `${(r.ms / 1000).toFixed(3)}s` : `${r.ms}ms`).padStart(7)} ${r.name}\n`);
      return 0;
    }
    ctx.err(`Unknown command verb '${verb}'.\n`);
    return 1;
  },
};

export const SYSTEMD_COMMANDS: CommandDef[] = [systemctl, journalctl, hostnamectl, analyze, rebootCmd];
