// Port of Commands/Cron/CronCmd.cs – scheduled jobs: crontab, and the cron daemon that runs them. Jobs really run
// while the app is open: before each command line, every minute that has passed since the last one is checked
// (see tick). When the app is closed, the computer is "off" – like a real computer, cron does not catch up
// afterwards. This is the group's root file (the core calls tick); the crontab command is CronCmd.Crontab.ts.

import { Js } from "../../Js.js";
import * as ServicesLib from "../../Services/ServicesLib.js";
import type { Shell } from "../../Shell/Shell.js";
import { LimitError } from "../../Signals/LimitError.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { IO } from "../../Types/IO.js";
import * as UsersLib from "../../Users/UsersLib.js";
import { FsError } from "../../Vfs/FsError.js";
import { crontab } from "./CronCmd.Crontab.js";

export * from "./CronCmd.Crontab.js";

// ---------- Schedules ----------

const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const specials = new Map<string, string>([
  ["@yearly", "0 0 1 1 *"],
  ["@annually", "0 0 1 1 *"],
  ["@monthly", "0 0 1 * *"],
  ["@weekly", "0 0 * * 0"],
  ["@daily", "0 0 * * *"],
  ["@midnight", "0 0 * * *"],
  ["@hourly", "0 * * * *"],
]);

/** A job: when it runs (five sets of allowed values) and what it runs. */
export interface Job {
  when: Set<number>[];
  /** Day of month and day of week both restricted: either one is enough (as in cron). */
  eitherDay: boolean;
  atReboot: boolean;
  user: string;
  command: string;
}

/** int.TryParse(text, NumberStyles.None): only ASCII digits that fit in an int. */
function tryParseInt(text: string): number | null {
  if (!/^[0-9]+$/.test(text)) return null;
  const n = Number(text);
  return n <= 2147483647 ? n : null;
}

/** The allowed values of one field (e.g. "*\/15", "1-5", "mon,wed"), or null if it is wrong. */
function parseField(field: string, min: number, max: number, names: string[] | null): Set<number> | null {
  const set = new Set<number>();
  for (const part of field.split(",")) {
    let p = part;
    let step = 1;
    const slash = p.indexOf("/");
    if (slash >= 0) {
      const s = tryParseInt(p.slice(slash + 1));
      if (s === null || s < 1) return null;
      step = s;
      p = p.slice(0, slash);
    }
    let lo: number;
    let hi: number;
    if (p === "*") {
      lo = min;
      hi = max;
    } else {
      const dash = p.indexOf("-");
      const a = value(dash >= 0 ? p.slice(0, dash) : p, names, min);
      const b = dash >= 0 ? value(p.slice(dash + 1), names, min) : a;
      if (a === null || b === null) return null;
      lo = a;
      hi = b;
      // "5/10" means 5-max in steps of 10.
      if (slash >= 0 && dash < 0) hi = max;
    }
    if (lo < min || hi > max || lo > hi) return null;
    // Sunday can be written 7 as well as 0.
    for (let v = lo; v <= hi; v += step) set.add(max === 7 && v === 7 ? 0 : v);
  }
  return set;
}

function value(text: string, names: string[] | null, min: number): number | null {
  const n = tryParseInt(text);
  if (n !== null) return n;
  if (names === null) return null;
  const i = names.indexOf(text.toLowerCase());
  return i < 0 ? null : i + min;
}

const fieldNames = ["minute", "hour", "day-of-month", "month", "day-of-week"];

const envLineRe = /^[A-Za-z_][A-Za-z0-9_]*\s*=/;

/**
 * Parses a crontab. withUser: /etc/crontab and /etc/cron.d have a user name after the
 * five time fields. Returns the jobs, or an error like "bad minute" with its line number.
 */
export function parse(text: string, owner: string, withUser = false): { jobs: Job[]; error: string | null; line: number } {
  const jobs: Job[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line === "" || line.startsWith("#") || envLineRe.test(line)) continue;
    const words = line.split(/\s+/).filter((w) => w !== "");
    let reboot = false;
    let timeWords = 5;
    let fields: string[];
    if (words[0]!.startsWith("@")) {
      timeWords = 1;
      const expanded = specials.get(words[0]!);
      if (words[0] === "@reboot") {
        reboot = true;
        fields = ["*", "*", "*", "*", "*"];
      } else if (expanded !== undefined) fields = expanded.split(" ");
      else return { jobs, error: "bad minute", line: i + 1 };
    } else fields = words.slice(0, 5);
    const need = timeWords + (withUser ? 1 : 0) + 1;
    if (words.length < need) {
      if (fields.length < 5) return { jobs, error: `bad ${fieldNames[fields.length]}`, line: i + 1 };
      return { jobs, error: withUser && words.length === timeWords ? "bad username" : "bad command", line: i + 1 };
    }
    const sets: Set<number>[] = [];
    const ranges: [number, number, string[] | null][] = [
      [0, 59, null],
      [0, 23, null],
      [1, 31, null],
      [1, 12, months],
      [0, 7, days],
    ];
    for (let f = 0; f < 5; f++) {
      const [min, max, names] = ranges[f]!;
      const set = parseField(fields[f]!, min, max, names);
      if (set === null) return { jobs, error: `bad ${fieldNames[f]}`, line: i + 1 };
      sets.push(set);
    }
    const user = withUser ? words[timeWords]! : owner;
    // The command is the rest of the line, as written (spaces kept).
    let rest = line;
    for (let w = 0; w < timeWords + (withUser ? 1 : 0); w++) {
      rest = rest.trimStart();
      const sp = rest.search(/[ \t]/);
      rest = sp < 0 ? "" : rest.slice(sp);
    }
    jobs.push({
      when: sets,
      eitherDay: fields[2] !== "*" && fields[4] !== "*",
      atReboot: reboot,
      user,
      command: rest.trim(),
    });
  }
  return { jobs, error: null, line: 0 };
}

export function due(job: Job, t: Date): boolean {
  if (job.atReboot) return false;
  const dom = job.when[2]!.has(t.getDate());
  const dow = job.when[4]!.has(t.getDay());
  const day = job.eitherDay ? dom || dow : dom && dow;
  return job.when[0]!.has(t.getMinutes()) && job.when[1]!.has(t.getHours()) && job.when[3]!.has(t.getMonth() + 1) && day;
}

// ---------- Where crontabs live ----------

/** The users' crontabs: /var/spool/cron/crontabs on Debian/Ubuntu, /var/spool/cron elsewhere. */
export function spoolDir(sh: Shell): string {
  return sh.distro.family === "debian" ? "/var/spool/cron/crontabs" : "/var/spool/cron";
}

/** Whether the cron daemon runs (cron, crond or cronie depending on the distribution). */
export function daemonRuns(sh: Shell): boolean {
  const rt = ServicesLib.resolveUnit(sh, ServicesLib.cronUnit(sh.distro));
  return rt?.active === "active";
}

// ---------- The daemon ----------

/** When the jobs were last checked, per computer (not saved: a closed app is a computer that is off). */
const lastCheck = new WeakMap<Shell, { value: number }>();

let running = false;

/** All jobs on the computer: the users' crontabs, /etc/crontab and /etc/cron.d/*. */
export function allJobs(sh: Shell): Job[] {
  const root = sh.rootUser();
  const jobs: Job[] = [];
  const spool = sh.vfs.tryLookup(spoolDir(sh), root);
  for (const [user, node] of spool?.children ?? []) if (node.type === "file" && UsersLib.userExists(sh, user)) jobs.push(...parse(node.content ?? "", user).jobs);
  const etc = sh.vfs.tryLookup("/etc/crontab", root);
  if (etc?.type === "file") jobs.push(...parse(etc.content ?? "", "root", true).jobs);
  const d = sh.vfs.tryLookup("/etc/cron.d", root);
  for (const [, node] of d?.children ?? []) if (node.type === "file") jobs.push(...parse(node.content ?? "", "root", true).jobs);
  return jobs;
}

/**
 * Runs the jobs that were due since the last check (at most the last hour). Called before every command
 * line the student runs.
 */
export function tick(sh: Shell): void {
  if (running) return;
  const now = Js.now();
  let box = lastCheck.get(sh);
  if (!box) lastCheck.set(sh, (box = { value: now }));
  const from = Math.max(box.value, now - 3_600_000);
  box.value = now;
  // Whole minutes between the last check and now (long division in C#).
  const firstMinute = Math.floor(from / 60_000) + 1;
  const lastMinute = Math.floor(now / 60_000);
  if (lastMinute < firstMinute) return;
  if (!sh.installed.has("cron") || !daemonRuns(sh)) return;
  let jobs: Job[];
  try {
    jobs = allJobs(sh);
  } catch (e) {
    if (e instanceof FsError) return;
    throw e;
  }
  if (jobs.length === 0) return;
  running = true;
  try {
    for (let m = firstMinute; m <= lastMinute; m++) {
      const t = Js.localDate(m * 60_000);
      for (const job of jobs.filter((j) => due(j, t))) runJob(sh, job, m * 60_000);
    }
  } finally {
    running = false;
  }
}

function runJob(sh: Shell, job: Job, t: number): void {
  if (!UsersLib.userExists(sh, job.user)) return;
  // The system's own jobs (run-parts /etc/cron.daily ...) are only logged: their programs are not simulated.
  const systemJob = job.command.includes("run-parts");
  const user = sh.getUser(job.user);
  const pid = sh.proc.nextPid++;
  const ident = sh.distro.family === "debian" ? "CRON" : "CROND";
  const unit = ServicesLib.cronUnit(sh.distro);
  ServicesLib.log(sh, t, ident, `(${job.user}) CMD (${job.command})`, { pid, unit });
  if (systemJob) return;
  let output = "";
  // cron's environment: the home directory, /bin/sh, a short PATH and the system's language – not the student's
  // variables (exported or not) or shell settings.
  const env = Js.obj<string>();
  env.set("HOME", user.home);
  env.set("LOGNAME", user.name);
  env.set("USER", user.name);
  env.set("SHELL", "/bin/sh");
  env.set("PATH", "/usr/bin:/bin");
  env.set("PWD", user.home);
  env.set("LANG", sh.world.locale);
  try {
    const io = new IO(
      (s) => (output += s),
      (s) => (output += s),
      null,
      false,
    );
    // The command's % signs would be newlines in real cron; they are rare in exercises and are kept.
    sh.asChild(() => {
      sh.cwd = user.home;
      return sh.runAs(job.user, () => sh.runScript(job.command, "sh", [], io));
    }, env);
  } catch (e) {
    // A job that runs away is stopped, as a real one would be killed eventually.
    if (!(e instanceof LimitError || e instanceof FsError)) throw e;
  }
  if (output.length > 0)
    ServicesLib.log(sh, t, ident, `(${job.user}) MAIL (mailed ${Js.num(output.length)} bytes of output but got status 0x007f from MTA)`, { pid, prio: 3, unit });
  if (sh.distro.family === "debian" && output.length > 0) ServicesLib.log(sh, t, "cron", "(CRON) info (No MTA installed, discarding output)", { pid: 530, unit });
}

/** The group's commands, in the C# order. */
export function all(): CommandDef[] {
  return [crontab];
}
