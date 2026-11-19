// Port of Commands/Systemd/SystemdCmd.cs (src/shell/commands/systemd.ts) – commands for services and logs: systemctl,
// journalctl, hostnamectl, systemd-analyze and reboot. The model (services, journal, boots) is in Services/
// (ServicesLib). This is the group's root file: the shared helpers and the list of the group's commands.

import { Js } from "../../Js.js";
import * as ServicesLib from "../../Services/ServicesLib.js";
import type { JournalEntry } from "../../Services/JournalEntry.js";
import type { MsgArgs } from "../../ShellI18n.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { analyze } from "./SystemdCmd.Analyze.js";
import { hostnamectl } from "./SystemdCmd.Hostnamectl.js";
import { journalctl } from "./SystemdCmd.Journalctl.js";
import { rebootCmd } from "./SystemdCmd.Reboot.js";
import { systemctl } from "./SystemdCmd.Systemctl.js";

export * from "./SystemdCmd.Analyze.js";
export * from "./SystemdCmd.Hostnamectl.js";
export * from "./SystemdCmd.Journalctl.js";
export * from "./SystemdCmd.Reboot.js";
export * from "./SystemdCmd.Systemctl.js";
export * from "./SystemdCmd.SystemctlOutput.js";

export const Months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const Days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const BoldYellow = "\x1b[1;33m";

export function pad2(n: number): string {
  return Js.pad2(n);
}

export function clock(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function tzName(d: Date): string {
  try {
    return UtilCmd.timeZoneAbbreviation(d);
  } catch {
    return "UTC";
  }
}

/** "Oct 30 08:00:03" – as in the journal. */
export function shortTime(t: number): string {
  const d = Js.localDate(t);
  return `${Months[d.getMonth()]} ${pad2(d.getDate())} ${clock(d)}`;
}

/** "Fri 2026-10-30 08:00:03 CET" – as in systemctl status. */
export function longTime(t: number): string {
  const d = Js.localDate(t);
  return `${Days[d.getDay()]} ${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${clock(d)} ${tzName(d)}`;
}

export function isoTime(t: number): string {
  const d = Js.localDate(t);
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${clock(d)}${sign}${pad2(Math.trunc(Math.abs(off) / 60))}${pad2(Math.abs(off) % 60)}`;
}

export function paint(ctx: CmdCtx, code: string, s: string): string {
  return ctx.isTTY ? `${code}${s}${UtilCmd.Color.reset}` : s;
}

export function tip(ctx: CmdCtx, key: string, args?: MsgArgs): void {
  ctx.err(`${UtilCmd.Color.dim}${ctx.sh.msg(key, args)}${UtilCmd.Color.reset}\n`);
}

export function journalLine(ctx: CmdCtx, e: JournalEntry, output = "short"): string {
  if (output === "cat") return e.msg;
  const time = output === "short-iso" ? isoTime(e.t) : shortTime(e.t);
  const who = e.ident === "kernel" || e.pid === null || e.pid === undefined ? e.ident : `${e.ident}[${e.pid}]`;
  const msg =
    e.prio <= 3 ? paint(ctx, UtilCmd.Color.red, e.msg) : e.prio === 4 ? paint(ctx, BoldYellow, e.msg) : e.prio === 5 ? paint(ctx, UtilCmd.Color.bold, e.msg) : e.msg;
  return `${time} ${ctx.sh.distro.hostname} ${who}: ${msg}`;
}

export const Auth = "Interactive authentication required.";

export function sudoTip(ctx: CmdCtx): void {
  tip(ctx, "systemd.needsRoot");
}

export function isRoot(ctx: CmdCtx): boolean {
  return ctx.sh.currentUser().uid === 0;
}

export function replaceFirst(s: string, find: string, repl: string): string {
  const i = s.indexOf(find);
  return i < 0 ? s : s.slice(0, i) + repl + s.slice(i + find.length);
}

export function table(rows: string[][]): string[] {
  const widths = rows[0]!.map((_, i) => Math.max(...rows.map((r) => (i < r.length ? r[i]! : "").length)));
  return rows.map((r) => r.map((cell, i) => (i === r.length - 1 ? cell : cell.padEnd(widths[i]!))).join(" ").trimEnd());
}

export function doReboot(ctx: CmdCtx): number {
  const sh = ctx.sh;
  ServicesLib.reboot(sh);
  // Every session disappears at reboot: the student logs in again in the home directory.
  sh.userStack.length = 0;
  sh.userStack.push(sh.world.user);
  const home = sh.world.home;
  sh.env.set("USER", sh.world.user);
  sh.env.set("LOGNAME", sh.world.user);
  sh.env.set("HOME", home);
  sh.env.set("PWD", home);
  sh.cwd = home;
  ctx.out(`${UtilCmd.Color.dim}${sh.msg("systemd.rebooted", { user: sh.world.user })}${UtilCmd.Color.reset}\n`);
  return 0;
}

const relativeRe = /^([+-])\s*([0-9]+)\s*([a-z]+)$/;
const agoRe = /^([0-9]+)\s*([a-z]+)\s+ago$/;
const clockRe = /^([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?$/;
const dateRe = /^([0-9]{4})-([0-9]{2})-([0-9]{2})(?:[ t]([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?)?$/;

const timeUnits = new Map<string, number>([
  ["s", 1],
  ["sec", 1],
  ["second", 1],
  ["seconds", 1],
  ["m", 60],
  ["min", 60],
  ["minute", 60],
  ["minutes", 60],
  ["h", 3600],
  ["hour", 3600],
  ["hours", 3600],
  ["d", 86400],
  ["day", 86400],
  ["days", 86400],
]);

/** Parses times such as "today", "yesterday", "10:00", "2026-10-30 08:00", "-1h", "1 hour ago". */
export function parseSince(s: string, now: number | null = null): number | null {
  const nowMs = now ?? Js.now();
  const v = s.trim().toLowerCase();
  const day = Js.localDate(nowMs);
  day.setHours(0, 0, 0, 0);
  const midnight = day.getTime();
  if (v === "now") return nowMs;
  if (v === "today") return midnight;
  if (v === "yesterday") return midnight - 86_400_000;
  if (v === "tomorrow") return midnight + 86_400_000;
  let m = relativeRe.exec(v);
  const u1 = m !== null ? timeUnits.get(m[3]!) : undefined;
  if (m !== null && u1 !== undefined) return nowMs + (m[1] === "-" ? -1 : 1) * Math.trunc(Js.number(m[2]!)) * u1 * 1000;
  m = agoRe.exec(v);
  const u2 = m !== null ? timeUnits.get(m[2]!) : undefined;
  if (m !== null && u2 !== undefined) return nowMs - Math.trunc(Js.number(m[1]!)) * u2 * 1000;
  m = clockRe.exec(v);
  if (m !== null) {
    const sec = m[3] !== undefined ? Js.number(m[3]) : 0;
    return midnight + Math.trunc((Js.number(m[1]!) * 3600 + Js.number(m[2]!) * 60 + sec) * 1000);
  }
  m = dateRe.exec(v);
  if (m !== null) {
    const mm = m;
    const g = (i: number): number => (mm[i] !== undefined ? Js.number(mm[i]) : 0);
    // new Date(y, m, d, h, mi, s) in local time, with JS's overflow of the fields (month 13 → next year).
    return new Date(g(1), g(2) - 1, g(3), g(4), g(5), g(6)).getTime();
  }
  return null;
}

/** The group's commands, in the C# order. */
export function all(): CommandDef[] {
  return [systemctl, journalctl, hostnamectl, analyze, rebootCmd];
}
