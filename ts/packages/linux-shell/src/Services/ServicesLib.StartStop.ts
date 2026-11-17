// Port of Services/ServicesLib.StartStop.cs – ServicesLib: service processes, start/stop, syncing with the process
// table, daemon-reload and enable/disable.

import { Js } from "../Js.js";
import type { Proc } from "../Procs/Proc.js";
import * as ProcsLib from "../Procs/ProcsLib.js";
import type { Shell } from "../Shell/Shell.js";
import * as VfsLib from "../Vfs/VfsLib.js";
import type { LinkChange } from "./LinkChange.js";
import { AdminUnitDir, SystemUnitDir } from "./ServicesLib.js";
import { defFor, type StartFailure } from "./ServicesLib.Defs.js";
import { identOf, log, subjectStarted } from "./ServicesLib.Journal.js";
import { ensureDir, loadUnit, unitInfo, wantsPath } from "./ServicesLib.UnitFiles.js";
import type { StartResult } from "./StartResult.js";
import type { UnitRt } from "./UnitRt.js";

// ---------- Processes ----------

function hhmm(t: number): string {
  return Js.hhmm(Js.localDate(t));
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
    tty: "?",
    stat: "Ss",
    start: hhmm(t),
    time: "0:00",
  };
}

function hasProc(sh: Shell, pid: number | null | undefined): boolean {
  return pid !== null && pid !== undefined && sh.proc.procs.some((p) => p.pid === pid);
}

function pickPid(sh: Shell, wanted: number | null = null): number {
  if (wanted !== null && !hasProc(sh, wanted) && !sh.proc.jobs.some((j) => j.pid === wanted)) return wanted;
  return sh.proc.nextPid++;
}

// ---------- Start and stop ----------

// How a start happens (the `mode` parameter):
// - "real": for real – the process is added to the process table.
// - "init": when the model is created – existing processes in the table are taken over.
// - "record": only journal lines (for the previous boot).

export function startUnit(sh: Shell, rt: UnitRt, t: number, mode = "real", atBoot = false): StartResult {
  const st = sh.services;
  if (rt.active === "active") return { ok: true };
  // A new start must come after the unit's earlier journal lines, even within the same millisecond
  // (fast machines) – otherwise `systemctl status` would show lines from the previous, failed start.
  let lastOwn = -Infinity;
  for (const e of st.journal) if (e.unit === rt.name && e.t > lastOwn) lastOwn = e.t;
  if (lastOwn >= t) t = lastOwn + 1;
  const info = unitInfo(rt);
  const def = defFor(sh, rt.name);
  const desc = info.description !== "" ? `${rt.name} - ${info.description}` : rt.name;
  const job = ++st.job;
  const ident = identOf(info.exec);
  const user = info.user ?? "root";

  // What can go wrong: the program does not exist, or (for our own services) a check.
  let failure: StartFailure | null = null;
  if (mode !== "record") {
    if (def?.check) failure = def.check(sh);
    else if (def === null) {
      const bin0 = info.exec.split(" ")[0]!;
      const path = bin0.includes("/") ? bin0 : `/usr/bin/${bin0}`;
      const node = bin0 !== "" ? sh.vfs.tryLookup(path, sh.rootUser()) : null;
      if (node === null || node.type !== "file" || (node.mode & Js.oct(111)) === 0) {
        failure = { log: [], status: 203, statusName: "EXEC", exec: true };
      }
    }
  }

  if (info.type !== "simple" && info.type !== "exec") log(sh, t, "systemd", `Starting ${desc}...`, { unit: rt.name });
  const pid = mode === "record" ? (def?.pid ?? 900 + job) : mode === "init" ? (def?.pid ?? pickPid(sh)) : pickPid(sh, atBoot ? (def?.pid ?? null) : null);

  if (failure !== null) {
    let bin = info.exec.split(" ")[0]!;
    if (bin === "") bin = "(none)";
    if (failure.exec) {
      log(sh, t, "systemd", `${rt.name}: Failed to locate executable ${bin}: No such file or directory`, { unit: rt.name, prio: 3, pid });
      log(sh, t, "systemd", `${rt.name}: Failed at step EXEC spawning ${bin}: No such file or directory`, { unit: rt.name, prio: 3, pid });
    } else {
      for (const line of failure.log) log(sh, t, ident, line, { unit: rt.name, pid, prio: line.startsWith("error") ? 3 : 6 });
    }
    const exitInfo = `code=exited, status=${failure.status}/${failure.statusName}`;
    log(sh, t, "systemd", `${rt.name}: Main process exited, ${exitInfo}`, {
      unit: rt.name,
      prio: 5,
      x: {
        subject: "Unit process exited",
        body: [`An ExecStart= process belonging to unit ${rt.name} has exited.`, "", `The process' exit code is 'exited' and its exit status is ${failure.status}.`],
      },
    });
    log(sh, t, "systemd", `${rt.name}: Failed with result 'exit-code'.`, {
      unit: rt.name,
      prio: 4,
      x: { subject: "Unit failed", body: [`The unit ${rt.name} has entered the 'failed' state with result 'exit-code'.`] },
    });
    log(sh, t, "systemd", `Failed to start ${desc}.`, {
      unit: rt.name,
      prio: 3,
      x: {
        subject: `A start job for unit ${rt.name} has failed`,
        body: [`A start job for unit ${rt.name} has finished with a failure.`, "", `The job identifier is ${job} and the job result is failed.`],
      },
    });
    rt.active = "failed";
    rt.sub = "failed";
    rt.since = t;
    rt.startedAt = t;
    rt.pid = null;
    rt.lastPid = pid;
    rt.result = "exit-code";
    rt.exitInfo = exitInfo;
    return { ok: false };
  }

  if (info.type === "oneshot") {
    for (const line of def?.log ?? []) log(sh, t, ident, line, { unit: rt.name, pid });
    if (info.remainAfterExit) {
      log(sh, t, "systemd", `Finished ${desc}.`, { unit: rt.name, x: subjectStarted(rt.name, job) });
      rt.active = "active";
      rt.sub = "exited";
    } else {
      log(sh, t, "systemd", `${rt.name}: Deactivated successfully.`, { unit: rt.name });
      log(sh, t, "systemd", `Finished ${desc}.`, { unit: rt.name, x: subjectStarted(rt.name, job) });
      rt.active = "inactive";
      rt.sub = "dead";
    }
    rt.since = t;
    rt.startedAt = t;
    rt.pid = null;
    rt.lastPid = pid;
    rt.result = null;
    rt.exitInfo = "code=exited, status=0/SUCCESS";
    return { ok: true };
  }

  if (mode !== "record") {
    const template = ProcsLib.initialProcs(sh.distro, sh.world.user).procs.find((p) => p.pid === pid && p.cmd === info.exec) ?? null;
    if (mode === "real" || (!hasProc(sh, pid) && template === null)) {
      if (!hasProc(sh, pid)) {
        let proc: Proc;
        if (template !== null && mode === "real") {
          // { ...template, start, time } – the template is a fresh object, so it can be changed.
          template.start = hhmm(t);
          template.time = "0:00";
          proc = template;
        } else proc = newProc(pid, user, info.exec, t);
        sh.proc.procs.push(proc);
      }
    }
  }
  const started = (): void => log(sh, t, "systemd", `Started ${desc}.`, { unit: rt.name, x: subjectStarted(rt.name, job) });
  if (info.type === "simple" || info.type === "exec") started();
  for (const line of def?.log ?? []) log(sh, t, ident, line, { unit: rt.name, pid });
  if (info.type !== "simple" && info.type !== "exec") started();
  rt.active = "active";
  rt.sub = "running";
  rt.since = t;
  rt.startedAt = t;
  rt.pid = pid;
  rt.lastPid = null;
  rt.result = null;
  rt.exitInfo = null;
  return { ok: true };
}

export function stopUnit(sh: Shell, rt: UnitRt, t: number, mode = "real"): void {
  if (rt.active !== "active") return;
  const info = unitInfo(rt);
  const def = defFor(sh, rt.name);
  const desc = info.description !== "" ? `${rt.name} - ${info.description}` : rt.name;
  log(sh, t, "systemd", `Stopping ${desc}...`, { unit: rt.name });
  if (rt.pid !== null && rt.pid !== undefined) {
    const mainPid = rt.pid;
    for (const line of def?.stopLog ?? []) log(sh, t, identOf(info.exec), line, { unit: rt.name, pid: mainPid });
    if (mode !== "record") sh.proc.procs = sh.proc.procs.filter((p) => p.pid !== mainPid);
  }
  log(sh, t, "systemd", `${rt.name}: Deactivated successfully.`, { unit: rt.name });
  log(sh, t, "systemd", `Stopped ${desc}.`, { unit: rt.name });
  const lastPid = rt.pid ?? rt.lastPid ?? null;
  const exitInfo = rt.pid !== null && rt.pid !== undefined ? "code=killed, signal=TERM" : (rt.exitInfo ?? null);
  rt.active = "inactive";
  rt.sub = "dead";
  rt.since = t;
  rt.lastPid = lastPid;
  rt.pid = null;
  rt.result = null;
  rt.exitInfo = exitInfo;
}

/**
 * Reconciles the services with the process table: if the main process has been killed
 * (e.g. with `sudo pkill myserver`) the service is no longer running.
 */
export function syncServices(sh: Shell, t: number | null = null): void {
  const now = t ?? Js.now();
  for (const rt of sh.services.units.values()) {
    if (rt.active !== "active" || rt.pid === null || rt.pid === undefined || hasProc(sh, rt.pid)) continue;
    log(sh, now, "systemd", `${rt.name}: Deactivated successfully.`, { unit: rt.name });
    rt.active = "inactive";
    rt.sub = "dead";
    rt.since = now;
    rt.lastPid = rt.pid;
    rt.pid = null;
    rt.exitInfo = "code=killed, signal=TERM";
  }
}

/** Re-reads all unit files (systemctl daemon-reload). */
export function daemonReload(sh: Shell): void {
  const st = sh.services;
  const names: string[] = [];
  const seen = new Set<string>();
  const add = (n: string): void => {
    if (!seen.has(n)) {
      seen.add(n);
      names.push(n);
    }
  };
  for (const k of st.units.keys()) add(k);
  for (const dir of [SystemUnitDir, AdminUnitDir]) {
    const node = sh.vfs.tryLookup(dir, sh.rootUser());
    if (!node?.children) continue;
    for (const [name, child] of node.children) if (child.type === "file" && name.endsWith(".service")) add(name);
  }
  for (const name of names) {
    if (loadUnit(sh, name) !== null) continue;
    // The unit file was removed: forget the service unless it is running.
    if (st.units.get(name)!.active !== "active") st.units.delete(name);
  }
}

// ---------- Enable and disable ----------

export function enableUnit(sh: Shell, rt: UnitRt): LinkChange {
  const info = unitInfo(rt);
  const change: LinkChange = { created: [], removed: [] };
  for (const target of info.wantedBy) {
    const path = wantsPath(target, rt.name);
    if (sh.vfs.tryLookup(path, sh.rootUser()) !== null) continue;
    const dir = ensureDir(sh, `${AdminUnitDir}/${target}.wants`);
    // Enabling a service is a symbolic link from the target's .wants directory to the unit file.
    dir.children!.set(rt.name, VfsLib.makeLink(rt.path));
    change.created.push(`${path} → ${rt.path}`);
  }
  return change;
}

export function disableUnit(sh: Shell, rt: UnitRt): LinkChange {
  const info = unitInfo(rt);
  const change: LinkChange = { created: [], removed: [] };
  for (const target of info.wantedBy) {
    const path = wantsPath(target, rt.name);
    if (sh.vfs.tryLookupLink(path, sh.rootUser()) === null) continue;
    sh.vfs.remove(path, sh.rootUser());
    change.removed.push(path);
  }
  return change;
}
