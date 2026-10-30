// Kommandon för processer och jobb: ps, top, kill, killall, pkill, pgrep,
// jobs, fg, bg, wait, uptime och free.

import { procName, SHELL_PID, type Job, type Proc } from '../procs';
import type { CmdCtx, CommandDef } from '../types';
import { badOption, COLOR, parseOpts } from './util';

const SIGNALS: Record<string, number> = { HUP: 1, INT: 2, QUIT: 3, KILL: 9, TERM: 15, STOP: 19, CONT: 18, USR1: 10, USR2: 12 };

/** Alla processer just nu, inklusive kommandot som körs (t.ex. ps själv). */
function snapshot(ctx: CmdCtx, self?: string): Proc[] {
  const sh = ctx.sh;
  sh.refreshJobs();
  const procs = [...sh.proc.procs];
  if (self) {
    procs.push({
      pid: sh.proc.nextPid++,
      ppid: SHELL_PID,
      user: sh.currentUser().name,
      cmd: self,
      cpu: 0,
      mem: 0.1,
      vsz: 11_200,
      rss: 4_100,
      tty: 'pts/0',
      stat: 'R+',
      start: new Date().toTimeString().slice(0, 5),
      time: '0:00',
    });
  }
  return procs;
}

function fmtTime(t: string): string {
  const [m, s] = t.split(':').map(Number);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const ps: CommandDef = {
  name: 'ps',
  summary: 'Visar processer',
  man: `NAMN
       ps - visa en ögonblicksbild av processerna

SYNOPSIS
       ps [FLAGGOR]

BESKRIVNING
       Utan flaggor visas bara processerna i din egen terminal.

FLAGGOR
       aux              alla processer, med användare, CPU och minne (BSD-stil)
       -ef              alla processer med förälderns PID (PPID)
       -u ANVÄNDARE     bara processer som tillhör ANVÄNDARE
       -p PID           bara processen med PID
       --sort=-%cpu     sortera efter CPU-användning, störst först
                        (även -%mem, pid, -pid)

KOLUMNER
       PID   processens id-nummer
       %CPU  hur mycket av processorn processen använder
       STAT  R = kör, S = sover, s = sessionsledare, + = i förgrunden
       TTY   terminalen processen hör till (? = ingen)

EXEMPEL
       ps aux | grep sshd
       ps aux --sort=-%cpu | head -5`,
  run(ctx) {
    const args = [...ctx.args];
    let style: 'short' | 'bsd' | 'full' = 'short';
    let user: string | undefined;
    let pid: number | undefined;
    let sort: string | undefined;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-u' || a === 'U') user = args[++i];
      else if (/^-?[aux]+$/.test(a) && /[ax]/.test(a)) style = a.includes('u') ? 'bsd' : 'full';
      else if (['-ef', '-e', '-A', '-f', '-eF'].includes(a)) style = 'full';
      else if (a === '-p' || a === 'p') pid = Number(args[++i]);
      else if (a.startsWith('--sort=')) sort = a.slice(7);
      else if (a === '--sort') sort = args[++i];
      else return badOption(ctx, `unsupported option (BSD syntax) '${a}'`);
    }
    let procs = snapshot(ctx, `ps ${ctx.args.join(' ')}`.trim());
    if (style === 'short' && user === undefined && pid === undefined) procs = procs.filter((p) => p.tty === 'pts/0');
    if (user !== undefined) procs = procs.filter((p) => p.user === user);
    if (pid !== undefined) procs = procs.filter((p) => p.pid === pid);
    if (sort) {
      const desc = sort.startsWith('-');
      const key = sort.replace(/^[-+]/, '');
      const val = (p: Proc) => (key === '%cpu' || key === 'pcpu' ? p.cpu : key === '%mem' || key === 'pmem' ? p.mem : p.pid);
      procs.sort((a, b) => (desc ? val(b) - val(a) : val(a) - val(b)));
    }
    if (style === 'short' && user === undefined && pid === undefined) {
      ctx.out('    PID TTY          TIME CMD\n');
      for (const p of procs) ctx.out(`${String(p.pid).padStart(7)} ${p.tty.padEnd(8)} ${fmtTime(p.time)} ${procName(p)}\n`);
    } else if (style === 'full' || (style === 'short' && (user !== undefined || pid !== undefined))) {
      ctx.out('UID          PID    PPID  C STIME TTY          TIME CMD\n');
      for (const p of procs) {
        ctx.out(
          `${p.user.padEnd(8)} ${String(p.pid).padStart(7)} ${String(p.ppid).padStart(7)} ${String(Math.round(p.cpu)).padStart(2)} ${p.start} ${p.tty.padEnd(8)} ${fmtTime(p.time)} ${p.cmd}\n`,
        );
      }
    } else {
      ctx.out('USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n');
      for (const p of procs) {
        ctx.out(
          `${p.user.padEnd(10)} ${String(p.pid).padStart(5)} ${p.cpu.toFixed(1).padStart(4)} ${p.mem.toFixed(1).padStart(4)} ${String(p.vsz).padStart(6)} ${String(p.rss).padStart(5)} ${p.tty.padEnd(8)} ${p.stat.padEnd(4)} ${p.start} ${p.time.padStart(6)} ${p.cmd}\n`,
        );
      }
    }
    return 0;
  },
};

function topScreen(ctx: CmdCtx, name: string): void {
  const procs = snapshot(ctx, name).sort((a, b) => b.cpu - a.cpu || a.pid - b.pid);
  const total = procs.length;
  const running = procs.filter((p) => p.stat.startsWith('R')).length;
  const load = procs.reduce((s, p) => s + p.cpu, 0) / 100;
  const time = new Date().toTimeString().slice(0, 8);
  ctx.out(
    `top - ${time} up  2:14,  1 user,  load average: ${load.toFixed(2)}, ${(load * 0.9).toFixed(2)}, ${(load * 0.8).toFixed(2)}\n` +
      `Tasks: ${String(total).padStart(3)} total, ${String(running).padStart(3)} running, ${String(total - running).padStart(3)} sleeping,   0 stopped,   0 zombie\n` +
      `%Cpu(s): ${Math.min(99.9, load * 50).toFixed(1).padStart(4)} us,  0.7 sy,  0.0 ni, ${Math.max(0, 100 - load * 50 - 0.7).toFixed(1).padStart(4)} id,  0.0 wa\n` +
      `MiB Mem :   7884.2 total,   5203.1 free,   1884.6 used,    796.5 buff/cache\n` +
      `MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   5999.6 avail Mem\n\n`,
  );
  const header = '    PID USER      PR  NI    VIRT    RES S  %CPU  %MEM     TIME+ COMMAND';
  ctx.out(ctx.isTTY ? `\x1b[30;42m${header}${COLOR.reset}\n` : header + '\n');
  for (const p of procs) {
    ctx.out(
      `${String(p.pid).padStart(7)} ${p.user.slice(0, 8).padEnd(8)}  20   0 ${String(p.vsz).padStart(7)} ${String(p.rss).padStart(6)} ${p.stat[0]} ${p.cpu.toFixed(1).padStart(5)} ${p.mem.toFixed(1).padStart(5)} ${(p.time + '.00').padStart(9)} ${procName(p)}\n`,
    );
  }
}

const top: CommandDef = {
  name: 'top',
  summary: 'Visar processerna som använder mest resurser',
  man: `NAMN
       top - visa processer och resursanvändning, uppdateras hela tiden

BESKRIVNING
       Överst visas belastning (load average), antal processer, CPU och
       minne. Sedan alla processer, sorterade efter CPU-användning.
       I en riktig terminal uppdateras top varje sekund: tryck M för att
       sortera på minne, k för att döda en process och q för att avsluta.
       I simulatorn visas en ögonblicksbild.

FLAGGOR
       -b -n 1   skriv ut en gång (bra i skript)`,
  run(ctx) {
    topScreen(ctx, 'top');
    if (ctx.isTTY) ctx.out(`${COLOR.dim}(${ctx.sh.msg({ sv: 'Ögonblicksbild. I en riktig terminal uppdateras top hela tiden – avsluta med q.', en: 'Snapshot. In a real terminal top updates continuously – quit with q.' })})${COLOR.reset}\n`);
    return 0;
  },
};

/** Gemensam logik för kill, killall och pkill. Returnerar true om det lyckades. */
function signalProc(ctx: CmdCtx, proc: Proc, signal: number, report: (msg: string) => void): boolean {
  const sh = ctx.sh;
  const user = sh.currentUser();
  if (user.uid !== 0 && proc.user !== user.name) {
    report('Operation not permitted');
    return false;
  }
  if (proc.pid === 1 || proc.pid === 2) return true; // init ignorerar vanliga signaler
  if (proc.pid === SHELL_PID) {
    ctx.err(`${COLOR.dim}(${ctx.sh.msg({ sv: 'Simulatorn låter dig inte avsluta ditt eget skal.', en: "The simulator won't let you kill your own shell." })})${COLOR.reset}\n`);
    return true;
  }
  if (signal === 0 || signal === 18 || signal === 19) return true;
  const job = sh.proc.jobs.find((j) => j.pid === proc.pid);
  if (job) sh.finishJob(job, signal === 9 ? 'Killed' : 'Terminated');
  else sh.proc.procs = sh.proc.procs.filter((p) => p.pid !== proc.pid);
  return true;
}

function parseSignal(arg: string): number | null {
  const s = arg.replace(/^-/, '').replace(/^SIG/i, '').toUpperCase();
  if (/^\d+$/.test(s)) return Number(s);
  return SIGNALS[s] ?? null;
}

const kill: CommandDef = {
  name: 'kill',
  builtin: true,
  summary: 'Skickar en signal till en process (avslutar den)',
  man: `NAMN
       kill - skicka en signal till en process

SYNOPSIS
       kill [-SIGNAL] PID...
       kill %JOBB
       kill -l

BESKRIVNING
       Som standard skickas SIGTERM (15), som ber processen avsluta sig
       snyggt. Om den inte lyssnar kan du skicka SIGKILL (9), som tvingar
       den att sluta direkt – men då hinner den inte städa efter sig.

       Du kan bara skicka signaler till dina egna processer. För andra
       användares processer behövs sudo.

SIGNALER
       1  HUP    läs om inställningarna (för många tjänster)
       2  INT    samma som Ctrl+C
       9  KILL   tvinga processen att avsluta
       15 TERM   be processen avsluta (standard)

EXEMPEL
       kill 3141
       kill -9 3141
       kill %1`,
  run(ctx) {
    const args = [...ctx.args];
    if (args[0] === '-l' || args[0] === '-L') {
      ctx.out(' 1) SIGHUP\t 2) SIGINT\t 3) SIGQUIT\t 9) SIGKILL\n10) SIGUSR1\t12) SIGUSR2\t15) SIGTERM\t18) SIGCONT\n19) SIGSTOP\n');
      return 0;
    }
    let signal = 15;
    if (args[0] === '-s' || args[0] === '-n') {
      args.shift();
      const s = parseSignal(args.shift() ?? '');
      if (s === null) return badOption(ctx, 'invalid signal specification');
      signal = s;
    } else if (args[0]?.startsWith('-') && args[0] !== '--') {
      const s = parseSignal(args.shift()!);
      if (s === null) {
        ctx.err(`bash: kill: ${ctx.args[0].slice(1)}: invalid signal specification\n`);
        return 1;
      }
      signal = s;
    }
    if (args[0] === '--') args.shift();
    if (!args.length) {
      ctx.err('kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]\n');
      return 2;
    }
    const sh = ctx.sh;
    sh.refreshJobs();
    let code = 0;
    for (const target of args) {
      let pid: number;
      if (target.startsWith('%')) {
        const spec = target.slice(1);
        const job =
          spec === '' || spec === '%' || spec === '+' ? sh.proc.jobs.at(-1) : sh.proc.jobs.find((j) => String(j.id) === spec);
        if (!job || job.state !== 'Running') {
          ctx.err(`bash: kill: ${target}: no such job\n`);
          code = 1;
          continue;
        }
        pid = job.pid;
      } else if (/^\d+$/.test(target)) {
        pid = Number(target);
      } else {
        ctx.err(`bash: kill: ${target}: arguments must be process or job IDs\n`);
        code = 1;
        continue;
      }
      const proc = sh.proc.procs.find((p) => p.pid === pid);
      if (!proc) {
        ctx.err(`bash: kill: (${pid}) - No such process\n`);
        code = 1;
        continue;
      }
      if (!signalProc(ctx, proc, signal, (msg) => ctx.err(`bash: kill: (${pid}) - ${msg}\n`))) code = 1;
    }
    return code;
  },
};

function byName(name: 'killall' | 'pkill' | 'pgrep'): CommandDef {
  const summaries = {
    killall: 'Avslutar alla processer med ett visst namn',
    pkill: 'Avslutar processer vars namn matchar ett mönster',
    pgrep: 'Visar PID för processer vars namn matchar ett mönster',
  };
  return {
    name,
    summary: summaries[name],
    man: `NAMN
       ${name} - ${summaries[name].toLowerCase()}

SYNOPSIS
       ${name} [-SIGNAL] ${name === 'killall' ? 'NAMN' : 'MÖNSTER'}

FLAGGOR${name === 'pgrep' ? '\n       -l        visa även processens namn\n       -a        visa hela kommandoraden' : '\n       -9        skicka SIGKILL i stället för SIGTERM'}
       -u ANV    bara processer som tillhör ANV

EXEMPEL
       ${name} ${name === 'killall' ? 'firefox' : 'minserver'}`,
    run(ctx) {
      const args = [...ctx.args];
      let signal = 15;
      let user: string | undefined;
      let list = false;
      let full = false;
      const rest: string[] = [];
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-u') user = args[++i];
        else if (a === '-l' && name === 'pgrep') list = true;
        else if (a === '-a' && name === 'pgrep') full = true;
        else if (a.startsWith('-') && name !== 'pgrep') {
          const s = parseSignal(a);
          if (s === null) return badOption(ctx, `invalid option -- '${a.slice(1)}'`);
          signal = s;
        } else rest.push(a);
      }
      const pattern = rest[0];
      if (!pattern) {
        ctx.err(name === 'killall' ? 'Usage: killall [OPTION]... [--] NAME...\n' : `${name}: no matching criteria specified\n`);
        return 2;
      }
      let re: RegExp;
      try {
        re = name === 'killall' ? new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) : new RegExp(pattern);
      } catch {
        ctx.err(`${name}: invalid regular expression\n`);
        return 2;
      }
      const matches = snapshot(ctx).filter((p) => re.test(procName(p)) && (user === undefined || p.user === user) && p.pid !== SHELL_PID);
      if (name === 'pgrep') {
        for (const p of matches) ctx.out(full ? `${p.pid} ${p.cmd}\n` : list ? `${p.pid} ${procName(p)}\n` : `${p.pid}\n`);
        return matches.length ? 0 : 1;
      }
      if (!matches.length) {
        if (name === 'killall') ctx.err(`${pattern}: no process found\n`);
        return 1;
      }
      let ok = false;
      for (const p of matches) {
        const report =
          name === 'killall' ? (msg: string) => ctx.err(`${procName(p)}(${p.pid}): ${msg}\n`) : (msg: string) => ctx.err(`pkill: killing pid ${p.pid} failed: ${msg}\n`);
        if (signalProc(ctx, p, signal, report)) ok = true;
      }
      return ok ? 0 : 1;
    },
  };
}

function jobLine(job: Job, last: boolean, long: boolean): string {
  const state = job.state === 'Running' ? 'Running' : job.state;
  return `[${job.id}]${last ? '+' : '-'}  ${long ? job.pid + ' ' : ''}${state.padEnd(24)}${job.cmd}${job.state === 'Running' ? ' &' : ''}\n`;
}

const jobs: CommandDef = {
  name: 'jobs',
  builtin: true,
  summary: 'Visar bakgrundsjobb i den här terminalen',
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
  run(ctx) {
    const sh = ctx.sh;
    sh.refreshJobs();
    const list = sh.proc.jobs;
    list.forEach((j, i) => ctx.out(jobLine(j, i === list.length - 1, ctx.args.includes('-l'))));
    return 0;
  },
};

function pickJob(ctx: CmdCtx): Job | undefined {
  const sh = ctx.sh;
  sh.refreshJobs();
  const spec = (ctx.args[0] ?? '%+').replace(/^%/, '');
  const job = spec === '' || spec === '+' || spec === '%' ? sh.proc.jobs.at(-1) : sh.proc.jobs.find((j) => String(j.id) === spec);
  if (!job) ctx.err(`bash: ${ctx.name}: ${ctx.args[0] ?? 'current'}: no such job\n`);
  return job;
}

const fg: CommandDef = {
  name: 'fg',
  builtin: true,
  summary: 'Flyttar ett bakgrundsjobb till förgrunden',
  man: `NAMN
       fg - flytta ett jobb till förgrunden

SYNOPSIS
       fg [%JOBB]

BESKRIVNING
       Jobbet tar över terminalen tills det är klart. I en riktig terminal
       kan du skicka tillbaka det till bakgrunden med Ctrl+Z följt av bg.`,
  run(ctx) {
    const job = pickJob(ctx);
    if (!job) return 1;
    ctx.out(job.cmd + '\n');
    if (job.state === 'Running') {
      ctx.out(`${COLOR.dim}(${ctx.sh.msg({ sv: 'Simulatorn väntar inte – jobbet räknas som klart.', en: "The simulator doesn't wait – the job counts as done." })})${COLOR.reset}\n`);
      ctx.sh.finishJob(job, 'Done');
    }
    ctx.sh.proc.jobs = ctx.sh.proc.jobs.filter((j) => j !== job);
    return 0;
  },
};

const bg: CommandDef = {
  name: 'bg',
  builtin: true,
  summary: 'Fortsätter ett stoppat jobb i bakgrunden',
  man: `NAMN
       bg - låt ett stoppat jobb fortsätta i bakgrunden

SYNOPSIS
       bg [%JOBB]

BESKRIVNING
       Används efter att ett program stoppats med Ctrl+Z.`,
  run(ctx) {
    const job = pickJob(ctx);
    if (!job) return 1;
    ctx.err(`bash: bg: job ${job.id} already in background\n`);
    return 0;
  },
};

const wait: CommandDef = {
  name: 'wait',
  builtin: true,
  summary: 'Väntar tills bakgrundsjobben är klara',
  man: `NAMN
       wait - vänta på att bakgrundsjobb blir klara

BESKRIVNING
       Används i skript som startar flera saker parallellt med & och
       sedan behöver vänta in dem. I simulatorn blir jobben klara direkt.`,
  run(ctx) {
    for (const job of ctx.sh.proc.jobs) if (job.state === 'Running') ctx.sh.finishJob(job, 'Done');
    ctx.sh.proc.jobs = [];
    return 0;
  },
};

const uptime: CommandDef = {
  name: 'uptime',
  summary: 'Visar hur länge datorn varit igång och belastningen',
  man: `NAMN
       uptime - visa hur länge systemet varit igång

BESKRIVNING
       Load average är det genomsnittliga antalet processer som vill ha
       processorn under senaste 1, 5 och 15 minuterna.`,
  run(ctx) {
    const load = snapshot(ctx).reduce((s, p) => s + p.cpu, 0) / 100;
    ctx.out(` ${new Date().toTimeString().slice(0, 8)} up  2:14,  1 user,  load average: ${load.toFixed(2)}, ${(load * 0.9).toFixed(2)}, ${(load * 0.8).toFixed(2)}\n`);
    return 0;
  },
};

const free: CommandDef = {
  name: 'free',
  summary: 'Visar hur mycket minne som används',
  man: `NAMN
       free - visa använt och ledigt minne

FLAGGOR
       -h    läsbara enheter (Mi, Gi)
       -m    i mebibyte`,
  run(ctx) {
    const o = parseOpts(ctx.args, { flags: 'hmgk', long: { human: 'h' } });
    if (o.error) return badOption(ctx, o.error);
    const kb = { total: 8_073_420, used: 1_929_820, free: 5_327_976, shared: 102_400, cache: 815_624, avail: 6_143_600, swap: 2_097_148 };
    const f = (n: number) => (o.flags.has('h') ? (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)}Gi` : `${Math.round(n / 1024)}Mi`) : o.flags.has('m') ? String(Math.round(n / 1024)) : String(n));
    const c = (n: number) => f(n).padStart(12);
    ctx.out(`${''.padEnd(7)}${'total'.padStart(12)}${'used'.padStart(12)}${'free'.padStart(12)}${'shared'.padStart(12)}${'buff/cache'.padStart(12)}${'available'.padStart(12)}\n`);
    ctx.out(`Mem:   ${c(kb.total)}${c(kb.used)}${c(kb.free)}${c(kb.shared)}${c(kb.cache)}${c(kb.avail)}\n`);
    ctx.out(`Swap:  ${c(kb.swap)}${c(0)}${c(kb.swap)}\n`);
    return 0;
  },
};

export const PROC_COMMANDS: CommandDef[] = [ps, top, kill, byName('killall'), byName('pkill'), byName('pgrep'), jobs, fg, bg, wait, uptime, free];

export { snapshot as currentProcs, topScreen };
