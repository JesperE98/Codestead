// Port of Commands/Systemd/SystemdCmd.Systemctl.cs – the systemctl command: control services (systemd): status,
// start, stop, enable …

import { Js } from "../../Js.js";
import * as ServicesLib from "../../Services/ServicesLib.js";
import type { UnitRt } from "../../Services/UnitRt.js";
import type { CmdCtx } from "../../Types/CmdCtx.js";
import type { CommandDef } from "../../Types/CommandDef.js";
import { Auth, doReboot, isRoot, paint, sudoTip, tip } from "./SystemdCmd.js";
import {
  changedWarning,
  jobFailed,
  listTimers,
  listUnitFiles,
  listUnits,
  statusText,
  systemOverview,
  type ListOpts,
} from "./SystemdCmd.SystemctlOutput.js";

const systemctlHelp = `systemctl [OPTIONS...] COMMAND ...

Query or send control commands to the system manager.

Unit Commands:
  list-units [PATTERN...]             List units currently in memory
  list-timers [PATTERN...]            List timer units currently in memory,
                                      ordered by next elapse
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

const verbNeedsRoot = new Set<string>([
  "start",
  "stop",
  "restart",
  "try-restart",
  "reload",
  "reload-or-restart",
  "enable",
  "disable",
  "daemon-reload",
  "reset-failed",
  "reboot",
]);

const ignoredSystemctlFlags = ["--no-pager", "--full", "-l", "--no-block", "--system", "--no-legend", "--plain", "--no-ask-password", "--force", "-f"];
const resolvingVerbs = ["start", "stop", "restart", "try-restart", "reload", "reload-or-restart", "enable", "disable"];
const digitsRe = /^[0-9]+$/;

/** Number(x) || 0 as an int that is safe to negate (for slice(-lines)). */
function linesArg(v: string): number {
  const n = Js.number(v);
  if (Number.isNaN(n) || n === 0) return 0;
  return Math.min(Math.max(Math.trunc(n), -2147483647), 2147483647);
}

export const systemctl: CommandDef = {
  name: "systemctl",
  summary: "Styr tjänster (systemd): status, start, stop, enable …",
  summaryEn: "Control services (systemd): status, start, stop, enable …",
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
       list-timers          lista timers (jobb som systemd kör på bestämda tider)
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
       sudo systemctl restart myserver
       sudo systemctl enable --now myserver
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
       list-timers          list timers (jobs systemd runs at set times)
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
       sudo systemctl restart myserver
       sudo systemctl enable --now myserver
       systemctl --failed`,
  run: (ctx) => runSystemctl(ctx),
};

function runSystemctl(ctx: CmdCtx): number {
  const sh = ctx.sh;
  const o: ListOpts = { all: false, states: [], types: [] };
  let now = false;
  let quiet = false;
  let lines = 10;
  const operands: string[] = [];
  const args = ctx.args;
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    const eq = a.indexOf("=");
    const key = a.startsWith("--") && eq > 0 ? a.slice(0, eq) : a;
    const val = (): string => {
      if (a.startsWith("--") && eq > 0) return a.slice(eq + 1);
      ++i;
      return i < args.length ? args[i]! : "";
    };
    if (a === "--") {
      operands.push(...args.slice(i + 1));
      break;
    } else if (key === "--type" || key === "-t") o.types.push(...val().split(","));
    else if (key === "--state") o.states.push(...val().split(","));
    else if (key === "--lines" || key === "-n") lines = linesArg(val());
    else if (a === "--failed") o.states.push("failed");
    else if (a === "--all" || a === "-a") o.all = true;
    else if (a === "--now") now = true;
    else if (a === "--quiet" || a === "-q") quiet = true;
    else if (ignoredSystemctlFlags.includes(a)) continue;
    else if (a === "--user") {
      ctx.err("Failed to connect to user scope bus via local transport: No medium found\n");
      tip(ctx, "systemd.noUserServices");
      return 1;
    } else if (a === "-h" || a === "--help") {
      ctx.out(systemctlHelp);
      return 0;
    } else if (a === "--version") {
      const v = ServicesLib.systemdVersion(sh.distro);
      ctx.out(`systemd ${v.major} (${v.full})\n+PAM +AUDIT +SELINUX +APPARMOR +SECCOMP +ACL +BLKID +KMOD +PCRE2 +ZSTD +BPF_FRAMEWORK\n`);
      return 0;
    } else if (a.startsWith("-") && a.length > 1) {
      ctx.err(`systemctl: unrecognized option '${a}'\n`);
      return 1;
    } else operands.push(a);
  }
  ServicesLib.syncServices(sh);
  let verb = "list-units";
  if (operands.length > 0) verb = operands.shift()!;
  const units = operands;

  if (verbNeedsRoot.has(verb) && units.length === 0 && !(verb === "daemon-reload" || verb === "reset-failed" || verb === "reboot")) {
    ctx.err("Too few arguments.\n");
    return 1;
  }

  // Do the services exist? (Checked before permissions – a misspelled name is the most common mistake.)
  const resolved: UnitRt[] = [];
  if (resolvingVerbs.includes(verb)) {
    for (const u of units) {
      const rt = ServicesLib.resolveUnit(sh, u);
      if (rt === null) {
        if (verb === "enable" || verb === "disable") ctx.err(`Failed to ${verb} unit: Unit file ${ServicesLib.unitName(u)} does not exist.\n`);
        else ctx.err(`Failed to ${verb} ${ServicesLib.unitName(u)}: Unit ${ServicesLib.unitName(u)} not found.\n`);
        return verb === "enable" || verb === "disable" ? 1 : 5;
      }
      resolved.push(rt);
    }
  }

  if (verbNeedsRoot.has(verb) && !isRoot(ctx)) {
    if (verb === "enable" || verb === "disable") ctx.err(`Failed to ${verb} unit: ${Auth}\n`);
    else if (verb === "daemon-reload") ctx.err(`Failed to reload daemon: ${Auth}\n`);
    else if (verb === "reboot") ctx.err(`Call to Reboot failed: ${Auth}\n`);
    else if (verb === "reset-failed") ctx.err(`Failed to reset failed state of unit ${ServicesLib.unitName(units.length > 0 ? units[0]! : "")}: ${Auth}\n`);
    else {
      const name = resolved.length > 0 ? resolved[0]!.name : ServicesLib.unitName(units[0]!);
      ctx.err(`Failed to ${verb} ${name}: ${Auth}\nSee system logs and 'systemctl status ${name}' for details.\n`);
    }
    sudoTip(ctx);
    return 1;
  }

  const t = Js.now();
  switch (verb) {
    case "list-units":
      return listUnits(ctx, o);
    case "list-unit-files":
      return listUnitFiles(ctx, o);
    case "list-timers":
      return listTimers(ctx);
    case "status": {
      if (units.length === 0) {
        ctx.out(systemOverview(ctx));
        return 0;
      }
      let code = 0;
      let first = true;
      for (const u of units) {
        const rt = ServicesLib.resolveUnit(sh, u);
        if (rt === null) {
          ctx.err(digitsRe.test(u) ? `Failed to get unit for PID ${u}: PID ${u} does not belong to any loaded unit.\n` : `Unit ${ServicesLib.unitName(u)} could not be found.\n`);
          code = 4;
          continue;
        }
        if (!first) ctx.out("\n");
        first = false;
        ctx.out(statusText(ctx, rt, lines));
        if (rt.active !== "active" && code === 0) code = 3;
      }
      return code;
    }
    case "start":
    case "restart":
    case "try-restart":
    case "reload-or-restart": {
      let code = 0;
      for (const rt of resolved) {
        if (verb === "try-restart" && rt.active !== "active") continue;
        if (ServicesLib.changedOnDisk(sh, rt)) ctx.err(changedWarning(ctx, rt) + "\n");
        if (verb !== "start") ServicesLib.stopUnit(sh, rt, t);
        if (!ServicesLib.startUnit(sh, rt, t).ok) {
          jobFailed(ctx, rt);
          code = 1;
        }
      }
      return code;
    }
    case "stop":
      for (const rt of resolved) {
        if (ServicesLib.changedOnDisk(sh, rt)) ctx.err(changedWarning(ctx, rt) + "\n");
        ServicesLib.stopUnit(sh, rt, t);
      }
      return 0;
    case "reload":
      for (const rt of resolved) {
        const info = ServicesLib.unitInfo(rt);
        if (info.reload === null || info.reload === "") {
          ctx.err(`Failed to reload ${rt.name}: Job type reload is not applicable for unit ${rt.name}.\n`);
          return 1;
        }
        if (rt.active !== "active") {
          ctx.err(`Failed to reload ${rt.name}: Unit ${rt.name} is not active.\n`);
          return 1;
        }
        const desc = `${rt.name} - ${info.description}`;
        ServicesLib.log(sh, t, "systemd", `Reloading ${desc}...`, { unit: rt.name });
        const pid = rt.pid ?? null;
        if (pid !== null) ServicesLib.log(sh, t, info.exec.split(" ")[0]!.split("/").at(-1)!, "Received SIGHUP; reloading configuration.", { unit: rt.name, pid });
        ServicesLib.log(sh, t, "systemd", `Reloaded ${desc}.`, { unit: rt.name });
      }
      return 0;
    case "enable":
    case "disable": {
      let code = 0;
      for (const rt of resolved) {
        if (ServicesLib.unitInfo(rt).wantedBy.length === 0) {
          ctx.err(
            "The unit files have no installation config (WantedBy=, RequiredBy=, UpheldBy=,\n" +
              "Also=, or Alias= settings in the [Install] section, and DefaultInstance= for\n" +
              "template units). This means they are not meant to be enabled or disabled using systemctl.\n",
          );
          continue;
        }
        const change = verb === "enable" ? ServicesLib.enableUnit(sh, rt) : ServicesLib.disableUnit(sh, rt);
        for (const c of change.created) ctx.err(`Created symlink ${c}.\n`);
        for (const r of change.removed) ctx.err(`Removed "${r}".\n`);
        if (now) {
          if (verb === "enable") {
            if (!ServicesLib.startUnit(sh, rt, t).ok) {
              jobFailed(ctx, rt);
              code = 1;
            }
          } else ServicesLib.stopUnit(sh, rt, t);
        }
      }
      return code;
    }
    case "daemon-reload":
      ServicesLib.daemonReload(sh);
      ServicesLib.log(sh, t, "systemd", "Reloading requested from client PID " + sh.proc.nextPid + " ('systemctl')...");
      ServicesLib.log(sh, t, "systemd", "Reloading finished in 112 ms.");
      return 0;
    case "reset-failed": {
      const list =
        units.length > 0 ? units.map((u) => ServicesLib.resolveUnit(sh, u)).filter((u): u is UnitRt => u !== null) : [...sh.services.units.values()];
      for (const rt of list) {
        if (rt.active !== "failed") continue;
        rt.active = "inactive";
        rt.sub = "dead";
        rt.result = null;
      }
      return 0;
    }
    case "is-active":
    case "is-failed":
    case "is-enabled": {
      if (units.length === 0) {
        ctx.err("Too few arguments.\n");
        return 1;
      }
      let code = verb === "is-failed" ? 1 : 0;
      let anyOk = false;
      for (const u of units) {
        const rt = ServicesLib.resolveUnit(sh, u);
        if (verb === "is-enabled") {
          if (rt === null) {
            if (!quiet) ctx.err(`Failed to get unit file state for ${ServicesLib.unitName(u)}: No such file or directory\n`);
            code = 1;
            continue;
          }
          const enState = ServicesLib.enabledState(sh, rt, u);
          if (!quiet) ctx.out(enState + "\n");
          if (enState === "disabled") code = 1;
          continue;
        }
        const state = rt?.active ?? "inactive";
        if (!quiet) ctx.out(state + "\n");
        if (verb === "is-active" && state !== "active") code = rt !== null ? 3 : 4;
        if (verb === "is-failed" && state === "failed") anyOk = true;
      }
      return verb === "is-failed" ? (anyOk ? 0 : 1) : code;
    }
    case "is-system-running": {
      const failed = [...sh.services.units.values()].some((u) => u.active === "failed");
      if (!quiet) ctx.out(failed ? "degraded\n" : "running\n");
      return failed ? 1 : 0;
    }
    case "cat": {
      if (units.length === 0) {
        ctx.err("Too few arguments.\n");
        return 1;
      }
      let code = 0;
      for (let i = 0; i < units.length; i++) {
        const u = units[i]!;
        const rt = ServicesLib.resolveUnit(sh, u);
        if (rt === null) {
          ctx.err(`No files found for ${ServicesLib.unitName(u)}.\n`);
          code = 1;
          continue;
        }
        if (ServicesLib.changedOnDisk(sh, rt)) ctx.err(changedWarning(ctx, rt) + "\n");
        const content = sh.vfs.tryLookup(rt.path, sh.rootUser())?.content ?? rt.loaded;
        ctx.out(`${i > 0 ? "\n" : ""}${paint(ctx, "\x1b[34m", `# ${rt.path}`)}\n${content}`);
      }
      return code;
    }
    case "reboot":
      return doReboot(ctx);
    case "poweroff":
    case "halt":
      ctx.err(`Call to PowerOff failed: ${Auth}\n`);
      tip(ctx, "systemd.cannotPowerOff");
      return 1;
    default:
      ctx.err(`Unknown command verb '${verb}'.\n`);
      return 1;
  }
}
