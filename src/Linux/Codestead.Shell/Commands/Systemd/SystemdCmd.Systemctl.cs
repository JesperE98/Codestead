namespace Codestead.Shell.Commands;

// The systemctl command: control services (systemd): status, start, stop, enable …

public static partial class SystemdCmd
{
    private const string SystemctlHelp = """
        systemctl [OPTIONS...] COMMAND ...

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

        """;

    private static readonly HashSet<string> VerbNeedsRoot = new(StringComparer.Ordinal)
    {
        "start", "stop", "restart", "try-restart", "reload", "reload-or-restart", "enable", "disable", "daemon-reload", "reset-failed", "reboot",
    };

    private static readonly string[] IgnoredSystemctlFlags = { "--no-pager", "--full", "-l", "--no-block", "--system", "--no-legend", "--plain", "--no-ask-password", "--force", "-f" };
    private static readonly string[] ResolvingVerbs = { "start", "stop", "restart", "try-restart", "reload", "reload-or-restart", "enable", "disable" };
    private static readonly Regex DigitsRe = new(@"^[0-9]+\z", RegexOptions.CultureInvariant);

    /// <summary>Number(x) || 0 as an int that is safe to negate (for slice(-lines)).</summary>
    private static int LinesArg(string v)
    {
        var n = Js.Number(v);
        if (double.IsNaN(n) || n == 0) return 0;
        return (int)Math.Clamp(Math.Truncate(n), -int.MaxValue, int.MaxValue);
    }

    private static readonly CommandDef Systemctl = new()
    {
        Name = "systemctl",
        Summary = "Styr tjänster (systemd): status, start, stop, enable …",
        SummaryEn = "Control services (systemd): status, start, stop, enable …",
        Man = """
            NAMN
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
                   systemctl --failed
            """,
        ManEn = """
            NAME
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
                   systemctl --failed
            """,
        Run = RunSystemctl,
    };

    private static int RunSystemctl(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var o = new ListOpts();
        var now = false;
        var quiet = false;
        var lines = 10;
        var operands = new List<string>();
        var args = ctx.Args;
        for (int i = 0; i < args.Count; i++)
        {
            var a = args[i];
            var eq = a.IndexOf('=');
            var key = a.StartsWith("--", StringComparison.Ordinal) && eq > 0 ? a[..eq] : a;
            string Val()
            {
                if (a.StartsWith("--", StringComparison.Ordinal) && eq > 0) return a[(eq + 1)..];
                ++i;
                return i < args.Count ? args[i] : "";
            }
            if (a == "--")
            {
                operands.AddRange(args.Slice(i + 1));
                break;
            }
            else if (key == "--type" || key == "-t") o.Types.AddRange(Js.Split(Val(), ","));
            else if (key == "--state") o.States.AddRange(Js.Split(Val(), ","));
            else if (key == "--lines" || key == "-n") lines = LinesArg(Val());
            else if (a == "--failed") o.States.Add("failed");
            else if (a == "--all" || a == "-a") o.All = true;
            else if (a == "--now") now = true;
            else if (a == "--quiet" || a == "-q") quiet = true;
            else if (IgnoredSystemctlFlags.Contains(a)) continue;
            else if (a == "--user")
            {
                ctx.Err("Failed to connect to user scope bus via local transport: No medium found\n");
                Tip(ctx, "systemd.noUserServices");
                return 1;
            }
            else if (a == "-h" || a == "--help")
            {
                ctx.Out(SystemctlHelp);
                return 0;
            }
            else if (a == "--version")
            {
                var v = ServicesLib.SystemdVersion(sh.Distro);
                ctx.Out($"systemd {v.Major} ({v.Full})\n+PAM +AUDIT +SELINUX +APPARMOR +SECCOMP +ACL +BLKID +KMOD +PCRE2 +ZSTD +BPF_FRAMEWORK\n");
                return 0;
            }
            else if (a.StartsWith('-') && a.Length > 1)
            {
                ctx.Err($"systemctl: unrecognized option '{a}'\n");
                return 1;
            }
            else operands.Add(a);
        }
        ServicesLib.SyncServices(sh);
        var verb = "list-units";
        if (operands.Count > 0)
        {
            verb = operands[0];
            operands.RemoveAt(0);
        }
        var units = operands;

        if (VerbNeedsRoot.Contains(verb) && units.Count == 0 && verb is not ("daemon-reload" or "reset-failed" or "reboot"))
        {
            ctx.Err("Too few arguments.\n");
            return 1;
        }

        // Do the services exist? (Checked before permissions – a misspelled name is the most common mistake.)
        var resolved = new List<UnitRt>();
        if (ResolvingVerbs.Contains(verb))
        {
            foreach (var u in units)
            {
                var rt = ServicesLib.ResolveUnit(sh, u);
                if (rt is null)
                {
                    if (verb == "enable" || verb == "disable") ctx.Err($"Failed to {verb} unit: Unit file {ServicesLib.UnitName(u)} does not exist.\n");
                    else ctx.Err($"Failed to {verb} {ServicesLib.UnitName(u)}: Unit {ServicesLib.UnitName(u)} not found.\n");
                    return verb == "enable" || verb == "disable" ? 1 : 5;
                }
                resolved.Add(rt);
            }
        }

        if (VerbNeedsRoot.Contains(verb) && !IsRoot(ctx))
        {
            if (verb == "enable" || verb == "disable") ctx.Err($"Failed to {verb} unit: {Auth}\n");
            else if (verb == "daemon-reload") ctx.Err($"Failed to reload daemon: {Auth}\n");
            else if (verb == "reboot") ctx.Err($"Call to Reboot failed: {Auth}\n");
            else if (verb == "reset-failed") ctx.Err($"Failed to reset failed state of unit {ServicesLib.UnitName(units.Count > 0 ? units[0] : "")}: {Auth}\n");
            else
            {
                var name = resolved.Count > 0 ? resolved[0].Name : ServicesLib.UnitName(units[0]);
                ctx.Err($"Failed to {verb} {name}: {Auth}\nSee system logs and 'systemctl status {name}' for details.\n");
            }
            SudoTip(ctx);
            return 1;
        }

        var t = Js.Now();
        switch (verb)
        {
            case "list-units":
                return ListUnits(ctx, o);
            case "list-unit-files":
                return ListUnitFiles(ctx, o);
            case "list-timers":
                return ListTimers(ctx);
            case "status":
            {
                if (units.Count == 0)
                {
                    ctx.Out(SystemOverview(ctx));
                    return 0;
                }
                var code = 0;
                var first = true;
                foreach (var u in units)
                {
                    var rt = ServicesLib.ResolveUnit(sh, u);
                    if (rt is null)
                    {
                        ctx.Err(DigitsRe.IsMatch(u) ? $"Failed to get unit for PID {u}: PID {u} does not belong to any loaded unit.\n" : $"Unit {ServicesLib.UnitName(u)} could not be found.\n");
                        code = 4;
                        continue;
                    }
                    if (!first) ctx.Out("\n");
                    first = false;
                    ctx.Out(StatusText(ctx, rt, lines));
                    if (rt.Active != "active" && code == 0) code = 3;
                }
                return code;
            }
            case "start":
            case "restart":
            case "try-restart":
            case "reload-or-restart":
            {
                var code = 0;
                foreach (var rt in resolved)
                {
                    if (verb == "try-restart" && rt.Active != "active") continue;
                    if (ServicesLib.ChangedOnDisk(sh, rt)) ctx.Err(ChangedWarning(ctx, rt) + "\n");
                    if (verb != "start") ServicesLib.StopUnit(sh, rt, t);
                    if (!ServicesLib.StartUnit(sh, rt, t).Ok)
                    {
                        JobFailed(ctx, rt);
                        code = 1;
                    }
                }
                return code;
            }
            case "stop":
                foreach (var rt in resolved)
                {
                    if (ServicesLib.ChangedOnDisk(sh, rt)) ctx.Err(ChangedWarning(ctx, rt) + "\n");
                    ServicesLib.StopUnit(sh, rt, t);
                }
                return 0;
            case "reload":
                foreach (var rt in resolved)
                {
                    var info = ServicesLib.UnitInfo(rt);
                    if (string.IsNullOrEmpty(info.Reload))
                    {
                        ctx.Err($"Failed to reload {rt.Name}: Job type reload is not applicable for unit {rt.Name}.\n");
                        return 1;
                    }
                    if (rt.Active != "active")
                    {
                        ctx.Err($"Failed to reload {rt.Name}: Unit {rt.Name} is not active.\n");
                        return 1;
                    }
                    var desc = $"{rt.Name} - {info.Description}";
                    ServicesLib.Log(sh, t, "systemd", $"Reloading {desc}...", unit: rt.Name);
                    if (rt.Pid is int pid) ServicesLib.Log(sh, t, info.Exec.Split(' ')[0].Split('/').Last(), "Received SIGHUP; reloading configuration.", unit: rt.Name, pid: pid);
                    ServicesLib.Log(sh, t, "systemd", $"Reloaded {desc}.", unit: rt.Name);
                }
                return 0;
            case "enable":
            case "disable":
            {
                var code = 0;
                foreach (var rt in resolved)
                {
                    if (ServicesLib.UnitInfo(rt).WantedBy.Count == 0)
                    {
                        ctx.Err(
                            "The unit files have no installation config (WantedBy=, RequiredBy=, UpheldBy=,\n" +
                            "Also=, or Alias= settings in the [Install] section, and DefaultInstance= for\n" +
                            "template units). This means they are not meant to be enabled or disabled using systemctl.\n");
                        continue;
                    }
                    var change = verb == "enable" ? ServicesLib.EnableUnit(sh, rt) : ServicesLib.DisableUnit(sh, rt);
                    foreach (var c in change.Created) ctx.Err($"Created symlink {c}.\n");
                    foreach (var r in change.Removed) ctx.Err($"Removed \"{r}\".\n");
                    if (now)
                    {
                        if (verb == "enable")
                        {
                            if (!ServicesLib.StartUnit(sh, rt, t).Ok)
                            {
                                JobFailed(ctx, rt);
                                code = 1;
                            }
                        }
                        else ServicesLib.StopUnit(sh, rt, t);
                    }
                }
                return code;
            }
            case "daemon-reload":
                ServicesLib.DaemonReload(sh);
                ServicesLib.Log(sh, t, "systemd", "Reloading requested from client PID " + sh.Proc.NextPid + " ('systemctl')...");
                ServicesLib.Log(sh, t, "systemd", "Reloading finished in 112 ms.");
                return 0;
            case "reset-failed":
            {
                var list = units.Count > 0
                    ? units.Select(u => ServicesLib.ResolveUnit(sh, u)).Where(u => u is not null).Select(u => u!).ToList()
                    : sh.Services.Units.Values.ToList();
                foreach (var rt in list)
                {
                    if (rt.Active != "failed") continue;
                    rt.Active = "inactive";
                    rt.Sub = "dead";
                    rt.Result = null;
                }
                return 0;
            }
            case "is-active":
            case "is-failed":
            case "is-enabled":
            {
                if (units.Count == 0)
                {
                    ctx.Err("Too few arguments.\n");
                    return 1;
                }
                var code = verb == "is-failed" ? 1 : 0;
                var anyOk = false;
                foreach (var u in units)
                {
                    var rt = ServicesLib.ResolveUnit(sh, u);
                    if (verb == "is-enabled")
                    {
                        if (rt is null)
                        {
                            if (!quiet) ctx.Err($"Failed to get unit file state for {ServicesLib.UnitName(u)}: No such file or directory\n");
                            code = 1;
                            continue;
                        }
                        var enState = ServicesLib.EnabledState(sh, rt, u);
                        if (!quiet) ctx.Out(enState + "\n");
                        if (enState == "disabled") code = 1;
                        continue;
                    }
                    var state = rt?.Active ?? "inactive";
                    if (!quiet) ctx.Out(state + "\n");
                    if (verb == "is-active" && state != "active") code = rt is not null ? 3 : 4;
                    if (verb == "is-failed" && state == "failed") anyOk = true;
                }
                return verb == "is-failed" ? (anyOk ? 0 : 1) : code;
            }
            case "is-system-running":
            {
                var failed = sh.Services.Units.Values.Any(u => u.Active == "failed");
                if (!quiet) ctx.Out(failed ? "degraded\n" : "running\n");
                return failed ? 1 : 0;
            }
            case "cat":
            {
                if (units.Count == 0)
                {
                    ctx.Err("Too few arguments.\n");
                    return 1;
                }
                var code = 0;
                for (int i = 0; i < units.Count; i++)
                {
                    var u = units[i];
                    var rt = ServicesLib.ResolveUnit(sh, u);
                    if (rt is null)
                    {
                        ctx.Err($"No files found for {ServicesLib.UnitName(u)}.\n");
                        code = 1;
                        continue;
                    }
                    if (ServicesLib.ChangedOnDisk(sh, rt)) ctx.Err(ChangedWarning(ctx, rt) + "\n");
                    var content = sh.Vfs.TryLookup(rt.Path, sh.RootUser())?.Content ?? rt.Loaded;
                    ctx.Out($"{(i > 0 ? "\n" : "")}{Paint(ctx, "\x1b[34m", $"# {rt.Path}")}\n{content}");
                }
                return code;
            }
            case "reboot":
                return DoReboot(ctx);
            case "poweroff":
            case "halt":
                ctx.Err($"Call to PowerOff failed: {Auth}\n");
                Tip(ctx, "systemd.cannotPowerOff");
                return 1;
            default:
                ctx.Err($"Unknown command verb '{verb}'.\n");
                return 1;
        }
    }
}
