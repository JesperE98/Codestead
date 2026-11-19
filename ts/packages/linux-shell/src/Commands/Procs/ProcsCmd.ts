// Port of Commands/Procs/ProcsCmd.cs (src/shell/commands/procs.ts) – commands for processes and jobs: ps, top, kill,
// killall, pkill, pgrep, jobs, fg, bg, wait, uptime and free. This is the group's root file: the shared helpers and
// the list of the group's commands. The commands themselves are ProcsCmd.<Name>.ts.

import { Js } from "../../Js.js";
import type { Job } from "../../Procs/Job.js";
import type { Proc } from "../../Procs/Proc.js";
import * as ProcsLib from "../../Procs/ProcsLib.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { bg } from "./ProcsCmd.Bg.js";
import { fg } from "./ProcsCmd.Fg.js";
import { free } from "./ProcsCmd.Free.js";
import { jobs } from "./ProcsCmd.Jobs.js";
import { kill } from "./ProcsCmd.Kill.js";
import { byName } from "./ProcsCmd.KillByName.js";
import { ps } from "./ProcsCmd.Ps.js";
import { top } from "./ProcsCmd.Top.js";
import { uptime } from "./ProcsCmd.Uptime.js";
import { wait } from "./ProcsCmd.Wait.js";

export * from "./ProcsCmd.Bg.js";
export * from "./ProcsCmd.Fg.js";
export * from "./ProcsCmd.Free.js";
export * from "./ProcsCmd.Jobs.js";
export * from "./ProcsCmd.Kill.js";
export * from "./ProcsCmd.KillByName.js";
export * from "./ProcsCmd.Ps.js";
export * from "./ProcsCmd.Top.js";
export * from "./ProcsCmd.Uptime.js";
export * from "./ProcsCmd.Wait.js";

/** Signal names and numbers (an ordered dictionary in C#). */
const signals = new Map<string, number>([
  ["HUP", 1],
  ["INT", 2],
  ["QUIT", 3],
  ["KILL", 9],
  ["TERM", 15],
  ["STOP", 19],
  ["CONT", 18],
  ["USR1", 10],
  ["USR2", 12],
]);

export const digitsRe = /^[0-9]+$/;

/** args[i], or null (undefined) when i is out of range. */
export function arg(args: readonly string[], i: number): string | null {
  return i >= 0 && i < args.length ? args[i]! : null;
}

/** Math.round in JavaScript (halves round up). */
export function jsRound(x: number): number {
  return Math.floor(x + 0.5);
}

export function sign(d: number): number {
  return d > 0 ? 1 : d < 0 ? -1 : 0;
}

export function timeString(length: number): string {
  return Js.hhmmss(Js.localNow()).slice(0, length);
}

/** Every process right now, including the command that is running (e.g. ps itself). */
export function snapshot(ctx: CmdCtx, self: string | null = null): Proc[] {
  const sh = ctx.sh;
  sh.refreshJobs();
  const procs = [...sh.proc.procs];
  if (self !== null && self !== "") {
    procs.push({
      pid: sh.proc.nextPid++,
      ppid: ProcsLib.ShellPid,
      user: sh.currentUser().name,
      cmd: self,
      cpu: 0,
      mem: 0.1,
      vsz: 11_200,
      rss: 4_100,
      tty: "pts/0",
      stat: "R+",
      start: timeString(5),
      time: "0:00",
    });
  }
  return procs;
}

/** Every process right now (exported as currentProcs). */
export function currentProcs(ctx: CmdCtx, self: string | null = null): Proc[] {
  return snapshot(ctx, self);
}

export function topScreen(ctx: CmdCtx, name: string): void {
  const procs = snapshot(ctx, name).sort((a, b) => {
    const d = sign(b.cpu - a.cpu);
    return d !== 0 ? d : sign(a.pid - b.pid);
  });
  const total = procs.length;
  const running = procs.filter((p) => p.stat.startsWith("R")).length;
  const load = procs.reduce((s, p) => s + p.cpu, 0) / 100;
  const time = timeString(8);
  ctx.out(
    `top - ${time} up  2:14,  1 user,  load average: ${Js.toFixed(load, 2)}, ${Js.toFixed(load * 0.9, 2)}, ${Js.toFixed(load * 0.8, 2)}\n` +
      `Tasks: ${Js.num(total).padStart(3)} total, ${Js.num(running).padStart(3)} running, ${Js.num(total - running).padStart(3)} sleeping,   0 stopped,   0 zombie\n` +
      `%Cpu(s): ${Js.toFixed(Math.min(99.9, load * 50), 1).padStart(4)} us,  0.7 sy,  0.0 ni, ${Js.toFixed(Math.max(0, 100 - load * 50 - 0.7), 1).padStart(4)} id,  0.0 wa\n` +
      "MiB Mem :   7884.2 total,   5203.1 free,   1884.6 used,    796.5 buff/cache\n" +
      "MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   5999.6 avail Mem\n\n",
  );
  const header = "    PID USER      PR  NI    VIRT    RES S  %CPU  %MEM     TIME+ COMMAND";
  ctx.out(ctx.isTTY ? `\x1b[30;42m${header}${UtilCmd.Color.reset}\n` : header + "\n");
  for (const p of procs) {
    ctx.out(
      `${Js.num(p.pid).padStart(7)} ${p.user.slice(0, 8).padEnd(8)}  20   0 ${Js.num(p.vsz).padStart(7)} ${Js.num(p.rss).padStart(6)} ${p.stat[0] ?? ""} ${Js.toFixed(p.cpu, 1).padStart(5)} ${Js.toFixed(p.mem, 1).padStart(5)} ${(p.time + ".00").padStart(9)} ${ProcsLib.procName(p)}\n`,
    );
  }
}

/** Shared logic for kill, killall and pkill. Returns true on success. */
export function signalProc(ctx: CmdCtx, proc: Proc, signal: number, report: (msg: string) => void): boolean {
  const sh = ctx.sh;
  const user = sh.currentUser();
  if (user.uid !== 0 && proc.user !== user.name) {
    report("Operation not permitted");
    return false;
  }
  if (proc.pid === 1 || proc.pid === 2) return true; // init ignores ordinary signals
  if (proc.pid === ProcsLib.ShellPid) {
    ctx.err(`${UtilCmd.Color.dim}(${ctx.sh.msg("procs.killOwnShell")})${UtilCmd.Color.reset}\n`);
    return true;
  }
  if (signal === 0 || signal === 18 || signal === 19) return true;
  const job = sh.proc.jobs.find((j) => j.pid === proc.pid) ?? null;
  if (job !== null) sh.finishJob(job, signal === 9 ? "Killed" : "Terminated");
  else sh.proc.procs = sh.proc.procs.filter((p) => p.pid !== proc.pid);
  return true;
}

export function parseSignal(a: string): number | null {
  const s = a.replace(/^-/, "").replace(/^SIG/i, "").toUpperCase();
  if (digitsRe.test(s)) return Js.number(s);
  return signals.get(s) ?? null;
}

export function pickJob(ctx: CmdCtx): Job | null {
  const sh = ctx.sh;
  sh.refreshJobs();
  const spec = (arg(ctx.args, 0) ?? "%+").replace(/^%/, "");
  const job = spec === "" || spec === "+" || spec === "%" ? (sh.proc.jobs.at(-1) ?? null) : (sh.proc.jobs.find((j) => Js.num(j.id) === spec) ?? null);
  if (job === null) ctx.err(`bash: ${ctx.name}: ${arg(ctx.args, 0) ?? "current"}: no such job\n`);
  return job;
}

/** The group's commands, in the C# order. */
export function all(): CommandDef[] {
  return [ps, top, kill, byName("killall"), byName("pkill"), byName("pgrep"), jobs, fg, bg, wait, uptime, free];
}
