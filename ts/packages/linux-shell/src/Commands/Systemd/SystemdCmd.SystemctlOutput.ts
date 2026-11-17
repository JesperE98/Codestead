// Port of Commands/Systemd/SystemdCmd.SystemctlOutput.cs – what systemctl prints: unit status, the system overview
// and the list-* tables.

import type { Distro } from "../../Distros/Distro.js";
import { Js } from "../../Js.js";
import * as ProcsLib from "../../Procs/ProcsLib.js";
import * as ServicesLib from "../../Services/ServicesLib.js";
import type { UnitRt } from "../../Services/UnitRt.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import * as UtilCmd from "../Util/UtilCmd.js";
import { clock, Days, journalLine, longTime, pad2, paint, replaceFirst, table, tzName } from "./SystemdCmd.js";

const BoldGreen = "\x1b[1;32m";

/** "2h 14min" / "5s" / "1 day 3h". */
export function span(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000.0));
  if (s < 60) return `${s}s`;
  const m = Math.trunc(s / 60);
  if (m < 60) return `${m}min ${s % 60}s`;
  const h = Math.trunc(m / 60);
  if (h < 24) return `${h}h ${m % 60}min`;
  const days = Math.trunc(h / 24);
  return `${days} day${days === 1 ? "" : "s"} ${h % 24}h`;
}

function activeText(ctx: CmdCtx, rt: UnitRt): string {
  const now = Js.now();
  const s = rt.since ?? null;
  const since = s !== null ? ` since ${longTime(s)}; ${span(now - s)} ago` : "";
  if (rt.active === "active") return `${paint(ctx, BoldGreen, `active (${rt.sub})`)}${since}`;
  if (rt.active === "failed") return `${paint(ctx, UtilCmd.Color.red, `failed (Result: ${rt.result ?? "exit-code"})`)}${since}`;
  return `inactive (dead)${since}`;
}

function dot(ctx: CmdCtx, rt: UnitRt): string {
  if (rt.active === "active") return paint(ctx, BoldGreen, "●");
  if (rt.active === "failed") return paint(ctx, UtilCmd.Color.red, "×");
  return "○";
}

export function changedWarning(ctx: CmdCtx, rt: UnitRt): string {
  return paint(
    ctx,
    UtilCmd.Color.red,
    `Warning: The unit file, source configuration file or drop-ins of ${rt.name} changed on disk. Run 'systemctl daemon-reload' to reload units.`,
  );
}

export function statusText(ctx: CmdCtx, rt: UnitRt, lines: number): string {
  const sh = ctx.sh;
  const info = ServicesLib.unitInfo(rt);
  const en = ServicesLib.enabledState(sh, rt);
  const out: string[] = [];
  out.push(`${dot(ctx, rt)} ${rt.name}${info.description !== "" ? ` - ${info.description}` : ""}`);
  out.push(`     Loaded: loaded (${rt.path}; ${en === "static" ? "static" : `${en}; preset: ${ServicesLib.presetState(sh)}`})`);
  out.push(`     Active: ${activeText(ctx, rt)}`);
  const startedAt = rt.startedAt ?? null;
  const since = rt.since ?? null;
  if (rt.active !== "active" && startedAt !== null && since !== null && since > startedAt) {
    out.push(`   Duration: ${span(since - startedAt)}`);
  }
  for (let i = 0; i < info.docs.length; i++) out.push(`${i === 0 ? "       Docs: " : "             "}${info.docs[i]}`);
  const lastPid = rt.lastPid ?? null;
  if (rt.active === "failed" && lastPid !== null) {
    out.push(`    Process: ${lastPid} ExecStart=${info.exec} (${rt.exitInfo ?? ""})`);
  }
  const pid = rt.pid ?? null;
  if (pid !== null) {
    const proc = sh.proc.procs.find((p) => p.pid === pid) ?? null;
    out.push(`   Main PID: ${pid} (${proc !== null ? ProcsLib.procName(proc) : info.exec.split(" ")[0]!.split("/").at(-1)!})`);
    out.push("      Tasks: 1 (limit: 9387)");
    out.push(`     Memory: ${Js.toFixed((proc?.rss ?? 4096) / 1024.0, 1)}M`);
    out.push(`        CPU: ${proc === null || proc.time === "0:00" ? "23ms" : `${replaceFirst(proc.time, ":", "min ")}s`}`);
    out.push(`     CGroup: /system.slice/${rt.name}`);
    out.push(`             └─${pid} ${proc?.cmd ?? info.exec}`);
  } else if (lastPid !== null && rt.exitInfo !== null && rt.exitInfo !== undefined && rt.exitInfo !== "") {
    out.push(`   Main PID: ${lastPid} (${rt.exitInfo})`);
  }
  if (rt.active === "active" && rt.sub === "exited" && lastPid !== null) {
    out.push(`    Process: ${lastPid} ExecStart=${info.exec} (${rt.exitInfo ?? ""})`);
  }
  if (ServicesLib.changedOnDisk(sh, rt)) {
    out.push("");
    out.push(changedWarning(ctx, rt));
  }
  const boot = ServicesLib.currentBoot(sh);
  // As in newer systemd: only the lines since the service's latest start (or stop).
  const from = startedAt ?? 0;
  const entries = sh.services.journal.filter((e) => e.unit === rt.name && e.boot === boot && e.t >= from).slice(-lines);
  if (entries.length > 0 && lines > 0) {
    out.push("");
    for (const e of entries) out.push(journalLine(ctx, e));
  }
  return out.join("\n") + "\n";
}

export function systemOverview(ctx: CmdCtx): string {
  const sh = ctx.sh;
  const units = [...sh.services.units.values()];
  const failed = units.filter((u) => u.active === "failed").length;
  const boot = sh.services.boots.at(-1)!;
  const state = failed > 0 ? paint(ctx, UtilCmd.Color.red, "degraded") : paint(ctx, BoldGreen, "running");
  const running = units
    .filter((u) => u.pid !== null && u.pid !== undefined)
    .sort((a, b) => Js.localeCompare(a.name, b.name))
    .map((u) => `           │ ├─${u.name}\n           │ │ └─${u.pid} ${ServicesLib.unitInfo(u).exec}\n`);
  return (
    `${failed > 0 ? paint(ctx, UtilCmd.Color.red, "×") : paint(ctx, BoldGreen, "●")} ${sh.distro.hostname}\n` +
    `    State: ${state}\n` +
    `    Units: ${units.length + 230} loaded (incl. loaded aliases)\n` +
    "     Jobs: 0 queued\n" +
    `   Failed: ${failed} units\n` +
    `    Since: ${longTime(boot.start)}; ${span(Js.now() - boot.start)} ago\n` +
    `  systemd: ${ServicesLib.systemdVersion(sh.distro).major}\n` +
    "   CGroup: /\n" +
    "           ├─init.scope\n" +
    "           │ └─1 /sbin/init\n" +
    "           ├─system.slice\n" +
    running.join("") +
    "           └─user.slice\n"
  );
}

export interface ListOpts {
  all: boolean;
  states: string[];
  types: string[];
}

export function listUnits(ctx: CmdCtx, o: ListOpts): number {
  const sh = ctx.sh;
  let units = [...sh.services.units.values()].sort((a, b) => Js.localeCompare(a.name, b.name));
  if (o.types.length > 0 && !o.types.includes("service")) units = [];
  if (o.states.length > 0) units = units.filter((u) => o.states.includes(u.active) || o.states.includes(u.sub));
  else if (!o.all) units = units.filter((u) => u.active !== "inactive");
  const rows: string[][] = [["UNIT", "LOAD", "ACTIVE", "SUB", "DESCRIPTION"]];
  rows.push(...units.map((u) => [u.name, "loaded", u.active, u.sub, ServicesLib.unitInfo(u).description]));
  const lines = table(rows);
  ctx.out(`  ${lines[0]}\n`);
  for (let i = 0; i < units.length; i++) {
    const u = units[i]!;
    const line = lines[i + 1]!;
    ctx.out(u.active === "failed" ? `${paint(ctx, UtilCmd.Color.red, "●")} ${paint(ctx, UtilCmd.Color.red, line)}\n` : `  ${line}\n`);
  }
  if (units.length > 0) {
    ctx.out(
      "\nLegend: LOAD   → Reflects whether the unit definition was properly loaded.\n" +
        "        ACTIVE → The high-level unit activation state, i.e. generalization of SUB.\n" +
        "        SUB    → The low-level unit activation state, values depend on unit type.\n",
    );
  }
  ctx.out(`\n${units.length} loaded units listed.${o.all || o.states.length > 0 ? "" : " Pass --all to see loaded but inactive units, too."}\n`);
  if (o.states.length === 0) ctx.out("To show all installed unit files use 'systemctl list-unit-files'.\n");
  return 0;
}

/** The distribution's timers: (timer, what it starts, how often: "daily", "weekly", "hourly" or "15min"). */
function timers(d: Distro): { timer: string; service: string; every: string }[] {
  const t = (timer: string, service: string, every: string) => ({ timer, service, every });
  switch (d.family) {
    case "debian":
      return [
        t("apt-daily-upgrade.timer", "apt-daily-upgrade.service", "daily"),
        t("apt-daily.timer", "apt-daily.service", "daily"),
        t("dpkg-db-backup.timer", "dpkg-db-backup.service", "daily"),
        t("e2scrub_all.timer", "e2scrub_all.service", "weekly"),
        t("fstrim.timer", "fstrim.service", "weekly"),
        t("logrotate.timer", "logrotate.service", "daily"),
        t("man-db.timer", "man-db.service", "daily"),
        t("systemd-tmpfiles-clean.timer", "systemd-tmpfiles-clean.service", "daily"),
      ];
    case "redhat":
      return [
        t("dnf-makecache.timer", "dnf-makecache.service", "hourly"),
        t("fstrim.timer", "fstrim.service", "weekly"),
        t("logrotate.timer", "logrotate.service", "daily"),
        t("raid-check.timer", "raid-check.service", "weekly"),
        t("systemd-tmpfiles-clean.timer", "systemd-tmpfiles-clean.service", "daily"),
      ];
    default:
      return [
        t("archlinux-keyring-wkd-sync.timer", "archlinux-keyring-wkd-sync.service", "weekly"),
        t("shadow.timer", "shadow.service", "daily"),
        t("systemd-tmpfiles-clean.timer", "systemd-tmpfiles-clean.service", "daily"),
      ];
  }
}

/** A time span (TimeSpan in C#) in milliseconds, as "2 days 3h", "5h 12min" or "7min". */
function left(ms: number): string {
  const totalMinutes = ms / 60_000;
  const totalHours = ms / 3_600_000;
  const totalDays = ms / 86_400_000;
  if (totalHours >= 24) return `${Math.trunc(totalDays)} day${Math.trunc(totalDays) === 1 ? "" : "s"} ${Math.trunc(totalHours) % 24}h`;
  if (totalMinutes >= 60) return `${Math.trunc(totalHours)}h ${Math.trunc(totalMinutes) % 60}min`;
  return `${Math.max(1, Math.trunc(totalMinutes))}min`;
}

/** systemctl list-timers: systemd's own way of running jobs at set times (instead of cron). */
export function listTimers(ctx: CmdCtx): number {
  const now = Js.localNow();
  const stamp = (d: Date): string => `${Days[d.getDay()]} ${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${clock(d)} ${tzName(d)}`;
  // Dates are built from local fields (new Date(y, m, d, h)), which is how C#'s DateTime arithmetic counts.
  const y = now.getFullYear();
  const mo = now.getMonth();
  const day = now.getDate();
  const rows: string[][] = [["NEXT", "LEFT", "LAST", "PASSED", "UNIT", "ACTIVATES"]];
  const entries = timers(ctx.sh.distro)
    .map((t) => {
      const toMonday = (1 - now.getDay() + 7) % 7;
      const next =
        t.every === "hourly"
          ? new Date(y, mo, day, now.getHours() + 1)
          : t.every === "weekly"
            ? new Date(y, mo, day + (toMonday === 0 ? 7 : toMonday))
            : new Date(y, mo, day + 1);
      const last =
        t.every === "hourly"
          ? new Date(next.getFullYear(), next.getMonth(), next.getDate(), next.getHours() - 1)
          : t.every === "weekly"
            ? new Date(next.getFullYear(), next.getMonth(), next.getDate() - 7)
            : new Date(next.getFullYear(), next.getMonth(), next.getDate() - 1);
      return { next, last, timer: t.timer, service: t.service };
    })
    .sort((a, b) => a.next.getTime() - b.next.getTime() || Js.ordinal(a.timer, b.timer));
  for (const e of entries) rows.push([stamp(e.next), left(e.next.getTime() - now.getTime()) + " left", stamp(e.last), left(now.getTime() - e.last.getTime()) + " ago", e.timer, e.service]);
  for (const line of table(rows)) ctx.out(line + "\n");
  ctx.out(`\n${entries.length} timers listed.\nPass --all to see loaded but inactive timers, too.\n`);
  return 0;
}

export function listUnitFiles(ctx: CmdCtx, o: ListOpts): number {
  const sh = ctx.sh;
  const names = new Set<string>();
  for (const dir of [ServicesLib.SystemUnitDir, ServicesLib.AdminUnitDir]) {
    const node = sh.vfs.tryLookup(dir, sh.rootUser());
    if (node?.children === null || node?.children === undefined) continue;
    for (const [name, child] of node.children) if (child.type === "file" && name.endsWith(".service")) names.add(name);
  }
  let rows: string[][] = [["UNIT FILE", "STATE", "PRESET"]];
  for (const name of [...names].sort()) {
    const rt = ServicesLib.resolveUnit(sh, name);
    if (rt === null) continue;
    const state = ServicesLib.enabledState(sh, rt);
    if (o.states.length > 0 && !o.states.includes(state)) continue;
    rows.push([name, state, state === "static" ? "-" : ServicesLib.presetState(sh)]);
    for (const alias of ServicesLib.unitInfo(rt).alias) if (o.states.length === 0 || o.states.includes("alias")) rows.push([alias, "alias", "-"]);
  }
  if (o.types.length > 0 && !o.types.includes("service")) rows = rows.slice(0, 1);
  for (const line of table(rows)) ctx.out(line + "\n");
  ctx.out(`\n${rows.length - 1} unit files listed.\n`);
  return 0;
}

export function jobFailed(ctx: CmdCtx, rt: UnitRt): void {
  ctx.err(`Job for ${rt.name} failed because the control process exited with error code.\n` + `See "systemctl status ${rt.name}" and "journalctl -xeu ${rt.name}" for details.\n`);
}
