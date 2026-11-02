namespace Codestead.Shell.Commands;

// Port of src/shell/commands/systemd.ts – commands for services and logs: systemctl, journalctl,
// hostnamectl, systemd-analyze and reboot. The model (services, journal, boots) is in ../Services.cs.

public static partial class SystemdCmd
{
    private static readonly string[] Months = { "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" };
    private static readonly string[] Days = { "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" };
    private const string BoldGreen = "\x1b[1;32m";
    private const string BoldYellow = "\x1b[1;33m";

    private static string Pad2(int n) => n.ToString(CultureInfo.InvariantCulture).PadLeft(2, '0');
    private static string Clock(DateTime d) => $"{Pad2(d.Hour)}:{Pad2(d.Minute)}:{Pad2(d.Second)}";

    private static string TzName(DateTime d)
    {
        try
        {
            return UtilCmd.TimeZoneAbbreviation(d);
        }
        catch
        {
            return "UTC";
        }
    }

    /// <summary>"Oct 30 08:00:03" – as in the journal.</summary>
    private static string ShortTime(long t)
    {
        var d = Js.LocalDate(t);
        return $"{Months[d.Month - 1]} {Pad2(d.Day)} {Clock(d)}";
    }

    /// <summary>"Fri 2026-10-30 08:00:03 CET" – as in systemctl status.</summary>
    private static string LongTime(long t)
    {
        var d = Js.LocalDate(t);
        return $"{Days[(int)d.DayOfWeek]} {d.Year}-{Pad2(d.Month)}-{Pad2(d.Day)} {Clock(d)} {TzName(d)}";
    }

    private static string IsoTime(long t)
    {
        var d = Js.LocalDate(t);
        var off = (int)TimeZoneInfo.Local.GetUtcOffset(d).TotalMinutes;
        var sign = off >= 0 ? "+" : "-";
        return $"{d.Year}-{Pad2(d.Month)}-{Pad2(d.Day)}T{Clock(d)}{sign}{Pad2(Math.Abs(off) / 60)}{Pad2(Math.Abs(off) % 60)}";
    }

    /// <summary>"2h 14min" / "5s" / "1 day 3h".</summary>
    private static string Span(long ms)
    {
        var s = Math.Max(0, (long)Math.Floor(ms / 1000.0));
        if (s < 60) return $"{s}s";
        var m = s / 60;
        if (m < 60) return $"{m}min {s % 60}s";
        var h = m / 60;
        if (h < 24) return $"{h}h {m % 60}min";
        var days = h / 24;
        return $"{days} day{(days == 1 ? "" : "s")} {h % 24}h";
    }

    private static string Paint(CmdCtx ctx, string code, string s) => ctx.IsTTY ? $"{code}{s}{UtilCmd.Color.Reset}" : s;

    private static void Tip(CmdCtx ctx, string key, params (string Name, object? Value)[] args) =>
        ctx.Err($"{UtilCmd.Color.Dim}{ctx.Sh.Msg(key, args)}{UtilCmd.Color.Reset}\n");

    private static string SupportUrl(CmdCtx ctx) => ctx.Sh.Distro.Id switch
    {
        "ubuntu" => "http://www.ubuntu.com/support",
        "debian" => "https://www.debian.org/support",
        _ => "https://lists.freedesktop.org/mailman/listinfo/systemd-devel",
    };

    private static string JournalLine(CmdCtx ctx, JournalEntry e, string output = "short")
    {
        if (output == "cat") return e.Msg;
        var time = output == "short-iso" ? IsoTime(e.T) : ShortTime(e.T);
        var who = e.Ident == "kernel" || e.Pid is null ? e.Ident : $"{e.Ident}[{e.Pid}]";
        var msg = e.Prio <= 3 ? Paint(ctx, UtilCmd.Color.Red, e.Msg)
            : e.Prio == 4 ? Paint(ctx, BoldYellow, e.Msg)
            : e.Prio == 5 ? Paint(ctx, UtilCmd.Color.Bold, e.Msg)
            : e.Msg;
        return $"{time} {ctx.Sh.Distro.Hostname} {who}: {msg}";
    }

    private static List<string> CatalogLines(CmdCtx ctx, JournalEntry e)
    {
        if (e.X is null) return new List<string>();
        var lines = new List<string> { $"Subject: {e.X.Subject}", "Defined-By: systemd", $"Support: {SupportUrl(ctx)}", "" };
        lines.AddRange(e.X.Body);
        return lines.Select(l => $"░░ {l}".TrimEnd() + (l == "" ? " " : "")).ToList();
    }

    private const string Auth = "Interactive authentication required.";

    private static void SudoTip(CmdCtx ctx) => Tip(ctx, "systemd.needsRoot");

    private static bool IsRoot(CmdCtx ctx) => ctx.Sh.CurrentUser().Uid == 0;

    // ---------- systemctl ----------

    private static string ActiveText(CmdCtx ctx, UnitRt rt)
    {
        var now = Js.Now();
        var since = rt.Since is long s ? $" since {LongTime(s)}; {Span(now - s)} ago" : "";
        if (rt.Active == "active") return $"{Paint(ctx, BoldGreen, $"active ({rt.Sub})")}{since}";
        if (rt.Active == "failed") return $"{Paint(ctx, UtilCmd.Color.Red, $"failed (Result: {rt.Result ?? "exit-code"})")}{since}";
        return $"inactive (dead){since}";
    }

    private static string Dot(CmdCtx ctx, UnitRt rt)
    {
        if (rt.Active == "active") return Paint(ctx, BoldGreen, "●");
        if (rt.Active == "failed") return Paint(ctx, UtilCmd.Color.Red, "×");
        return "○";
    }

    private static string ChangedWarning(CmdCtx ctx, UnitRt rt) => Paint(
        ctx,
        UtilCmd.Color.Red,
        $"Warning: The unit file, source configuration file or drop-ins of {rt.Name} changed on disk. Run 'systemctl daemon-reload' to reload units.");

    private static string StatusText(CmdCtx ctx, UnitRt rt, int lines)
    {
        var sh = ctx.Sh;
        var info = ServicesLib.UnitInfo(rt);
        var en = ServicesLib.EnabledState(sh, rt);
        var @out = new List<string>();
        @out.Add($"{Dot(ctx, rt)} {rt.Name}{(info.Description != "" ? $" - {info.Description}" : "")}");
        @out.Add($"     Loaded: loaded ({rt.Path}; {(en == "static" ? "static" : $"{en}; preset: {ServicesLib.PresetState(sh)}")})");
        @out.Add($"     Active: {ActiveText(ctx, rt)}");
        if (rt.Active != "active" && rt.StartedAt is long startedAt && rt.Since is long since && since > startedAt)
        {
            @out.Add($"   Duration: {Span(since - startedAt)}");
        }
        for (int i = 0; i < info.Docs.Count; i++) @out.Add($"{(i == 0 ? "       Docs: " : "             ")}{info.Docs[i]}");
        if (rt.Active == "failed" && rt.LastPid is not null)
        {
            @out.Add($"    Process: {rt.LastPid} ExecStart={info.Exec} ({rt.ExitInfo})");
        }
        if (rt.Pid is int pid)
        {
            var proc = sh.Proc.Procs.Find(p => p.Pid == pid);
            @out.Add($"   Main PID: {pid} ({(proc is not null ? ProcsLib.ProcName(proc) : info.Exec.Split(' ')[0].Split('/').Last())})");
            @out.Add("      Tasks: 1 (limit: 9387)");
            @out.Add($"     Memory: {Js.ToFixed((proc?.Rss ?? 4096) / 1024.0, 1)}M");
            @out.Add($"        CPU: {(proc is null || proc.Time == "0:00" ? "23ms" : $"{ReplaceFirst(proc.Time, ":", "min ")}s")}");
            @out.Add($"     CGroup: /system.slice/{rt.Name}");
            @out.Add($"             └─{pid} {proc?.Cmd ?? info.Exec}");
        }
        else if (rt.LastPid is not null && !string.IsNullOrEmpty(rt.ExitInfo))
        {
            @out.Add($"   Main PID: {rt.LastPid} ({rt.ExitInfo})");
        }
        if (rt.Active == "active" && rt.Sub == "exited" && rt.LastPid is not null)
        {
            @out.Add($"    Process: {rt.LastPid} ExecStart={info.Exec} ({rt.ExitInfo})");
        }
        if (ServicesLib.ChangedOnDisk(sh, rt))
        {
            @out.Add("");
            @out.Add(ChangedWarning(ctx, rt));
        }
        var boot = ServicesLib.CurrentBoot(sh);
        // As in newer systemd: only the lines since the service's latest start (or stop).
        var from = rt.StartedAt ?? 0;
        var entries = sh.Services.Journal.Where(e => e.Unit == rt.Name && e.Boot == boot && e.T >= from).ToList().Slice(-lines);
        if (entries.Count > 0 && lines > 0)
        {
            @out.Add("");
            foreach (var e in entries) @out.Add(JournalLine(ctx, e));
        }
        return string.Join("\n", @out) + "\n";
    }

    private static string ReplaceFirst(string s, string find, string repl)
    {
        var i = s.IndexOf(find, StringComparison.Ordinal);
        return i < 0 ? s : s[..i] + repl + s[(i + find.Length)..];
    }

    private static string SystemOverview(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var units = sh.Services.Units.Values.ToList();
        var failed = units.Count(u => u.Active == "failed");
        var boot = sh.Services.Boots[^1];
        var state = failed > 0 ? Paint(ctx, UtilCmd.Color.Red, "degraded") : Paint(ctx, BoldGreen, "running");
        var running = units.Where(u => u.Pid is not null).ToList()
            .StableSort((a, b) => Js.LocaleCompare(a.Name, b.Name))
            .Select(u => $"           │ ├─{u.Name}\n           │ │ └─{u.Pid} {ServicesLib.UnitInfo(u).Exec}\n");
        return
            $"{(failed > 0 ? Paint(ctx, UtilCmd.Color.Red, "×") : Paint(ctx, BoldGreen, "●"))} {sh.Distro.Hostname}\n" +
            $"    State: {state}\n" +
            $"    Units: {units.Count + 230} loaded (incl. loaded aliases)\n" +
            "     Jobs: 0 queued\n" +
            $"   Failed: {failed} units\n" +
            $"    Since: {LongTime(boot.Start)}; {Span(Js.Now() - boot.Start)} ago\n" +
            $"  systemd: {ServicesLib.SystemdVersion(sh.Distro).Major}\n" +
            "   CGroup: /\n" +
            "           ├─init.scope\n" +
            "           │ └─1 /sbin/init\n" +
            "           ├─system.slice\n" +
            string.Concat(running) +
            "           └─user.slice\n";
    }

    private static List<string> Table(List<List<string>> rows)
    {
        var widths = rows[0].Select((_, i) => rows.Max(r => (i < r.Count ? r[i] : "").Length)).ToList();
        return rows.Select(r => string.Join(" ", r.Select((cell, i) => i == r.Count - 1 ? cell : cell.PadRight(widths[i]))).TrimEnd()).ToList();
    }

    private sealed class ListOpts
    {
        public bool All { get; set; }
        public List<string> States { get; set; } = new();
        public List<string> Types { get; set; } = new();
    }

    private static int ListUnits(CmdCtx ctx, ListOpts o)
    {
        var sh = ctx.Sh;
        var units = sh.Services.Units.Values.ToList().StableSort((a, b) => Js.LocaleCompare(a.Name, b.Name));
        if (o.Types.Count > 0 && !o.Types.Contains("service")) units = new List<UnitRt>();
        if (o.States.Count > 0) units = units.Where(u => o.States.Contains(u.Active) || o.States.Contains(u.Sub)).ToList();
        else if (!o.All) units = units.Where(u => u.Active != "inactive").ToList();
        var rows = new List<List<string>> { new() { "UNIT", "LOAD", "ACTIVE", "SUB", "DESCRIPTION" } };
        rows.AddRange(units.Select(u => new List<string> { u.Name, "loaded", u.Active, u.Sub, ServicesLib.UnitInfo(u).Description }));
        var lines = Table(rows);
        ctx.Out($"  {lines[0]}\n");
        for (int i = 0; i < units.Count; i++)
        {
            var u = units[i];
            var line = lines[i + 1];
            ctx.Out(u.Active == "failed" ? $"{Paint(ctx, UtilCmd.Color.Red, "●")} {Paint(ctx, UtilCmd.Color.Red, line)}\n" : $"  {line}\n");
        }
        if (units.Count > 0)
        {
            ctx.Out(
                "\nLegend: LOAD   → Reflects whether the unit definition was properly loaded.\n" +
                "        ACTIVE → The high-level unit activation state, i.e. generalization of SUB.\n" +
                "        SUB    → The low-level unit activation state, values depend on unit type.\n");
        }
        ctx.Out($"\n{units.Count} loaded units listed.{(o.All || o.States.Count > 0 ? "" : " Pass --all to see loaded but inactive units, too.")}\n");
        if (o.States.Count == 0) ctx.Out("To show all installed unit files use 'systemctl list-unit-files'.\n");
        return 0;
    }

    private static int ListUnitFiles(CmdCtx ctx, ListOpts o)
    {
        var sh = ctx.Sh;
        var names = new HashSet<string>(StringComparer.Ordinal);
        foreach (var dir in new[] { ServicesLib.SystemUnitDir, ServicesLib.AdminUnitDir })
        {
            var node = sh.Vfs.TryLookup(dir, sh.RootUser());
            if (node?.Children is null) continue;
            foreach (var (name, child) in node.Children)
                if (child.Type == "file" && name.EndsWith(".service", StringComparison.Ordinal)) names.Add(name);
        }
        var rows = new List<List<string>> { new() { "UNIT FILE", "STATE", "PRESET" } };
        foreach (var name in names.ToList().SortJs())
        {
            var rt = ServicesLib.ResolveUnit(sh, name);
            if (rt is null) continue;
            var state = ServicesLib.EnabledState(sh, rt);
            if (o.States.Count > 0 && !o.States.Contains(state)) continue;
            rows.Add(new List<string> { name, state, state == "static" ? "-" : ServicesLib.PresetState(sh) });
            foreach (var alias in ServicesLib.UnitInfo(rt).Alias)
                if (o.States.Count == 0 || o.States.Contains("alias")) rows.Add(new List<string> { alias, "alias", "-" });
        }
        if (o.Types.Count > 0 && !o.Types.Contains("service")) rows.RemoveRange(1, rows.Count - 1);
        foreach (var line in Table(rows)) ctx.Out(line + "\n");
        ctx.Out($"\n{rows.Count - 1} unit files listed.\n");
        return 0;
    }

    private static void JobFailed(CmdCtx ctx, UnitRt rt) => ctx.Err(
        $"Job for {rt.Name} failed because the control process exited with error code.\n" +
        $"See \"systemctl status {rt.Name}\" and \"journalctl -xeu {rt.Name}\" for details.\n");

    private const string SystemctlHelp = """
        systemctl [OPTIONS...] COMMAND ...

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

    private static int DoReboot(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        ServicesLib.Reboot(sh);
        // Every session disappears at reboot: the student logs in again in the home directory.
        sh.UserStack.Clear();
        sh.UserStack.Add(sh.World.User);
        var home = sh.World.Home;
        sh.Env["USER"] = sh.World.User;
        sh.Env["LOGNAME"] = sh.World.User;
        sh.Env["HOME"] = home;
        sh.Env["PWD"] = home;
        sh.Cwd = home;
        ctx.Out($"{UtilCmd.Color.Dim}{sh.Msg("systemd.rebooted", ("user", sh.World.User))}{UtilCmd.Color.Reset}\n");
        return 0;
    }

    private static readonly CommandDef RebootCmd = new()
    {
        Name = "reboot",
        Summary = "Startar om datorn",
        SummaryEn = "Reboot the computer",
        Man = """
            NAMN
                   reboot - starta om datorn

            SYNOPSIS
                   sudo reboot

            BESKRIVNING
                   Samma sak som "systemctl reboot": alla tjänster stoppas och datorn
                   startar om. Efter omstarten körs bara de tjänster som är aktiverade
                   (enable). I simulatorn startar datorn om på ett ögonblick.
            """,
        ManEn = """
            NAME
                   reboot - reboot the computer

            SYNOPSIS
                   sudo reboot

            DESCRIPTION
                   Same as "systemctl reboot": all services are stopped and the
                   computer restarts. After the reboot only enabled services run.
                   In the simulator the reboot takes no time at all.
            """,
        Run = ctx =>
        {
            if (!IsRoot(ctx))
            {
                ctx.Err($"Call to Reboot failed: {Auth}\n");
                SudoTip(ctx);
                return 1;
            }
            return DoReboot(ctx);
        },
    };

    // ---------- journalctl ----------

    private static readonly string[] Prios = { "emerg", "alert", "crit", "err", "warning", "notice", "info", "debug" };
    private static readonly Regex PrioDigitRe = new(@"^[0-7]\z", RegexOptions.CultureInvariant);

    private static (int Lo, int Hi)? ParsePrio(string s)
    {
        int? One(string x)
        {
            if (PrioDigitRe.IsMatch(x)) return x[0] - '0';
            var lower = x.ToLowerInvariant();
            var i = Array.IndexOf(Prios, lower == "error" ? "err" : lower == "warn" ? "warning" : lower);
            return i >= 0 ? i : null;
        }
        if (s.Contains("..", StringComparison.Ordinal))
        {
            var parts = Js.Split(s, "..");
            var a = parts[0];
            var b = parts.Count > 1 ? parts[1] : "";
            var lo = One(a != "" ? a : "emerg");
            var hi = One(b != "" ? b : "debug");
            return lo is null || hi is null ? null : (Math.Min(lo.Value, hi.Value), Math.Max(lo.Value, hi.Value));
        }
        var p = One(s);
        return p is null ? null : (0, p.Value);
    }

    private static readonly Regex RelativeRe = new(@"^([+-])\s*([0-9]+)\s*([a-z]+)\z", RegexOptions.CultureInvariant);
    private static readonly Regex AgoRe = new(@"^([0-9]+)\s*([a-z]+)\s+ago\z", RegexOptions.CultureInvariant);
    private static readonly Regex ClockRe = new(@"^([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?\z", RegexOptions.CultureInvariant);
    private static readonly Regex DateRe = new(@"^([0-9]{4})-([0-9]{2})-([0-9]{2})(?:[ t]([0-9]{1,2}):([0-9]{2})(?::([0-9]{2}))?)?\z", RegexOptions.CultureInvariant);

    private static readonly Dictionary<string, long> TimeUnits = new(StringComparer.Ordinal)
    {
        ["s"] = 1, ["sec"] = 1, ["second"] = 1, ["seconds"] = 1,
        ["m"] = 60, ["min"] = 60, ["minute"] = 60, ["minutes"] = 60,
        ["h"] = 3600, ["hour"] = 3600, ["hours"] = 3600,
        ["d"] = 86400, ["day"] = 86400, ["days"] = 86400,
    };

    private static long LocalMs(DateTime local) => new DateTimeOffset(DateTime.SpecifyKind(local, DateTimeKind.Local)).ToUnixTimeMilliseconds();

    /// <summary>new Date(y, m, d, h, mi, s) in local time, with JS's overflow of the fields (month 13 → next year).</summary>
    private static long LocalDateMs(double year, double month, double day, double hour, double minute, double second)
    {
        if (year >= 0 && year <= 99) year += 1900;
        var d = new DateTime((int)year, 1, 1, 0, 0, 0, DateTimeKind.Local)
            .AddMonths((int)month)
            .AddDays(day - 1)
            .AddHours(hour)
            .AddMinutes(minute)
            .AddSeconds(second);
        return LocalMs(d);
    }

    /// <summary>Parses times such as "today", "yesterday", "10:00", "2026-10-30 08:00", "-1h", "1 hour ago".</summary>
    public static long? ParseSince(string s, long? now = null)
    {
        var nowMs = now ?? Js.Now();
        var v = s.Trim().ToLowerInvariant();
        var midnight = LocalMs(Js.LocalDate(nowMs).Date);
        if (v == "now") return nowMs;
        if (v == "today") return midnight;
        if (v == "yesterday") return midnight - 86_400_000;
        if (v == "tomorrow") return midnight + 86_400_000;
        var m = RelativeRe.Match(v);
        if (m.Success && TimeUnits.TryGetValue(m.Groups[3].Value, out var u1))
            return nowMs + (m.Groups[1].Value == "-" ? -1 : 1) * (long)Js.Number(m.Groups[2].Value) * u1 * 1000;
        m = AgoRe.Match(v);
        if (m.Success && TimeUnits.TryGetValue(m.Groups[2].Value, out var u2))
            return nowMs - (long)Js.Number(m.Groups[1].Value) * u2 * 1000;
        m = ClockRe.Match(v);
        if (m.Success)
        {
            var sec = m.Groups[3].Success ? Js.Number(m.Groups[3].Value) : 0;
            return midnight + (long)((Js.Number(m.Groups[1].Value) * 3600 + Js.Number(m.Groups[2].Value) * 60 + sec) * 1000);
        }
        m = DateRe.Match(v);
        if (m.Success)
        {
            double G(int i) => m.Groups[i].Success ? Js.Number(m.Groups[i].Value) : 0;
            return LocalDateMs(G(1), G(2) - 1, G(3), G(4), G(5), G(6));
        }
        return null;
    }

    private const string JournalctlHelp = "journalctl [OPTIONS...] [MATCHES...]\n\nQuery the journal.\n\nSee \"man journalctl\" for the options.\n";
    private static readonly Regex LinesValueRe = new(@"^(\+?[0-9]+|all)\z", RegexOptions.CultureInvariant);
    private static readonly Regex BootValueRe = new(@"^[+-]?[0-9]+\z", RegexOptions.CultureInvariant);
    private static readonly Regex MatchArgRe = new(@"^(_SYSTEMD_UNIT|UNIT|SYSLOG_IDENTIFIER|_COMM)=(.+)\z", RegexOptions.CultureInvariant);

    private static double LinesValue(string v) => v == "all" ? double.PositiveInfinity : Js.Number(ReplaceFirst(v, "+", ""));

    private static Regex? MakeGrep(string v)
    {
        try
        {
            var opts = RegexOptions.CultureInvariant | (v == v.ToLowerInvariant() ? RegexOptions.IgnoreCase : RegexOptions.None);
            return new Regex(v, opts);
        }
        catch (ArgumentException)
        {
            return null;
        }
    }

    private static readonly CommandDef Journalctl = new()
    {
        Name = "journalctl",
        Summary = "Läser systemloggen (journalen)",
        SummaryEn = "Read the system log (the journal)",
        Man = """
            NAMN
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
                   journalctl -u myserver
                   journalctl -xeu reportd
                   journalctl -p err -b
                   journalctl --since today -u ssh
                   journalctl -f
            """,
        ManEn = """
            NAME
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
                   journalctl -u myserver
                   journalctl -xeu reportd
                   journalctl -p err -b
                   journalctl --since today -u ssh
                   journalctl -f
            """,
        Run = RunJournalctl,
    };

    private static int RunJournalctl(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        ServicesLib.SyncServices(sh);
        var st = sh.Services;
        var args = ctx.Args;
        var units = new List<string>();
        var idents = new List<string>();
        double? lines = null;
        (int Lo, int Hi)? prio = null;
        double? boot = null;
        long? since = null;
        long? until = null;
        var follow = false;
        var catalog = false;
        var end = false;
        var reverse = false;
        var kernel = false;
        var output = "short";
        Regex? grep = null;
        var listBoots = false;
        var diskUsage = false;

        int Fail(string msg)
        {
            ctx.Err(msg + "\n");
            return 1;
        }
        string? SetTime(string which, string? v)
        {
            if (v is null) return $"option '--{which}' requires an argument";
            var t = ParseSince(v);
            if (t is null) return $"Failed to parse timestamp: {v}";
            if (which == "since") since = t;
            else until = t;
            return null;
        }
        string? Next(ref int i)
        {
            ++i;
            return i < args.Count ? args[i] : null;
        }

        for (int i = 0; i < args.Count; i++)
        {
            var a = args[i];
            if (a.StartsWith("--", StringComparison.Ordinal))
            {
                var eq = a.IndexOf('=');
                var key = eq > 0 ? a[2..eq] : a[2..];
                var attached = eq > 0 ? a[(eq + 1)..] : null;
                string? Value() => attached ?? Next(ref i);
                string? Optional(Regex re) => attached ?? (i + 1 < args.Count && re.IsMatch(args[i + 1]) ? args[++i] : null);
                string? err = null;
                switch (key)
                {
                    case "unit":
                    {
                        var v = Value();
                        if (v is null) return Fail("journalctl: option '--unit' requires an argument");
                        units.Add(v);
                        break;
                    }
                    case "identifier":
                    {
                        var v = Value();
                        if (v is null) return Fail("journalctl: option '--identifier' requires an argument");
                        idents.Add(v);
                        break;
                    }
                    case "lines":
                    {
                        var v = Optional(LinesValueRe);
                        lines = v is null ? 10 : LinesValue(v);
                        break;
                    }
                    case "priority":
                    {
                        var p = ParsePrio(Value() ?? "");
                        if (p is null) return Fail($"Failed to parse priority value: {attached ?? (i < args.Count ? args[i] : "undefined")}");
                        prio = p;
                        break;
                    }
                    case "boot":
                    {
                        var v = Optional(BootValueRe);
                        boot = v is null ? 0 : Js.Number(v);
                        break;
                    }
                    case "since":
                        err = SetTime("since", Value());
                        break;
                    case "until":
                        err = SetTime("until", Value());
                        break;
                    case "follow":
                        follow = true;
                        break;
                    case "catalog":
                        catalog = true;
                        break;
                    case "pager-end":
                        end = true;
                        break;
                    case "reverse":
                        reverse = true;
                        break;
                    case "dmesg":
                        kernel = true;
                        break;
                    case "output":
                        output = Value() ?? "";
                        break;
                    case "grep":
                    {
                        var v = Value() ?? "";
                        grep = MakeGrep(v);
                        if (grep is null) return Fail($"Bad pattern \"{v}\"");
                        break;
                    }
                    case "list-boots":
                        listBoots = true;
                        break;
                    case "disk-usage":
                        diskUsage = true;
                        break;
                    case "no-pager":
                    case "full":
                    case "all":
                    case "quiet":
                    case "utc":
                    case "no-hostname":
                    case "system":
                    case "merge":
                        break;
                    case "help":
                        ctx.Out(JournalctlHelp);
                        return 0;
                    default:
                        return Fail($"journalctl: unrecognized option '{a}'");
                }
                if (err is not null) return Fail(err);
                continue;
            }
            if (a.StartsWith('-') && a.Length > 1)
            {
                for (int j = 1; j < a.Length; j++)
                {
                    var c = a[j];
                    var rest = a[(j + 1)..];
                    string? Value() => rest != "" ? rest : Next(ref i);
                    string? Optional(Regex re) => rest != "" ? rest : i + 1 < args.Count && re.IsMatch(args[i + 1]) ? args[++i] : null;
                    var stop = false;
                    string? err = null;
                    switch (c)
                    {
                        case 'u':
                        case 't':
                        {
                            var v = Value();
                            if (v is null) return Fail($"journalctl: option requires an argument -- '{c}'");
                            (c == 'u' ? units : idents).Add(v);
                            stop = true;
                            break;
                        }
                        case 'n':
                        {
                            var v = Optional(LinesValueRe);
                            lines = v is null ? 10 : LinesValue(v);
                            if (double.IsNaN(lines.Value)) return Fail($"Failed to parse lines '{v}'");
                            stop = true;
                            break;
                        }
                        case 'p':
                        {
                            var v = Value();
                            var p = ParsePrio(v ?? "");
                            if (p is null) return Fail($"Failed to parse priority value: {v ?? ""}");
                            prio = p;
                            stop = true;
                            break;
                        }
                        case 'b':
                        {
                            var v = Optional(BootValueRe);
                            boot = v is null ? 0 : Js.Number(v);
                            if (double.IsNaN(boot.Value)) return Fail($"Failed to parse boot descriptor '{v}'");
                            stop = true;
                            break;
                        }
                        case 'S':
                        case 'U':
                            err = SetTime(c == 'S' ? "since" : "until", Value());
                            stop = true;
                            break;
                        case 'o':
                            output = Value() ?? "";
                            stop = true;
                            break;
                        case 'g':
                        {
                            var v = Value() ?? "";
                            grep = MakeGrep(v);
                            if (grep is null) return Fail($"Bad pattern \"{v}\"");
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
                            ctx.Out(JournalctlHelp);
                            return 0;
                        default:
                            return Fail($"journalctl: invalid option -- '{c}'");
                    }
                    if (err is not null) return Fail(err);
                    if (stop) break;
                }
                continue;
            }
            // Matches such as _SYSTEMD_UNIT=ssh.service or _PID=733.
            var m = MatchArgRe.Match(a);
            if (m.Success)
            {
                if (m.Groups[1].Value.EndsWith("UNIT", StringComparison.Ordinal)) units.Add(m.Groups[2].Value);
                else idents.Add(m.Groups[2].Value);
                continue;
            }
            return Fail($"Failed to add match '{a}': Invalid argument");
        }

        if (output is not ("short" or "short-iso" or "cat")) return Fail($"Unknown output format '{output}'.");

        var cur = ServicesLib.CurrentBoot(sh);
        if (listBoots)
        {
            var rows = new List<List<string>> { new() { "IDX", "BOOT ID", "FIRST ENTRY", "LAST ENTRY" } };
            for (int i = 0; i < st.Boots.Count; i++)
            {
                var b = st.Boots[i];
                var bootEntries = st.Journal.Where(e => e.Boot == i).ToList();
                var first = bootEntries.Count > 0 ? bootEntries[0].T : b.Start;
                var last = bootEntries.Count > 0 ? bootEntries[^1].T : b.Start;
                rows.Add(new List<string> { (i - cur).ToString(CultureInfo.InvariantCulture).PadLeft(3), b.Id, LongTime(first), LongTime(last) });
            }
            foreach (var line in Table(rows)) ctx.Out(line + "\n");
            return 0;
        }
        if (diskUsage)
        {
            ctx.Out($"Archived and active journals take up {Js.ToFixed(8 + st.Boots.Count * 8, 1)}M in the file system.\n");
            return 0;
        }

        IEnumerable<JournalEntry> query = st.Journal;
        if (boot is not null || kernel)
        {
            var b = boot ?? 0;
            var idx = b <= 0 ? cur + b : b - 1;
            if (idx < 0 || idx > cur) return Fail($"Data from the specified boot ({(b > 0 ? "+" : "")}{Js.Num(b)}) is not available: No such boot ID in journal");
            query = query.Where(e => e.Boot == idx);
        }
        if (kernel) query = query.Where(e => e.Ident == "kernel");
        if (units.Count > 0)
        {
            var names = units.Select(u => ServicesLib.ResolveUnit(sh, u)?.Name ?? ServicesLib.UnitName(u)).ToList();
            query = query.Where(e => e.Unit is not null && names.Contains(e.Unit));
        }
        if (idents.Count > 0) query = query.Where(e => idents.Contains(e.Ident));
        if (prio is (int lo, int hi)) query = query.Where(e => e.Prio >= lo && e.Prio <= hi);
        if (since is long sinceT) query = query.Where(e => e.T >= sinceT);
        if (until is long untilT) query = query.Where(e => e.T <= untilT);
        if (grep is not null) query = query.Where(e => grep.IsMatch(e.Msg));
        var entries = query.ToList();
        var n = lines ?? (follow ? 10 : end ? 1000 : double.PositiveInfinity);
        if (double.IsFinite(n))
        {
            var start = Math.Max(0, entries.Count - n);
            entries = entries.Slice((int)Math.Min(start, entries.Count));
        }
        if (reverse) entries.Reverse();

        if (entries.Count == 0)
        {
            if (!follow) ctx.Out("-- No entries --\n");
        }
        int? prevBoot = null;
        foreach (var e in entries)
        {
            if (prevBoot is not null && e.Boot != prevBoot) ctx.Out($"-- Boot {(e.Boot >= 0 && e.Boot < st.Boots.Count ? st.Boots[e.Boot].Id : "?")} --\n");
            prevBoot = e.Boot;
            ctx.Out(JournalLine(ctx, e, output) + "\n");
            if (catalog) foreach (var l in CatalogLines(ctx, e)) ctx.Out(l + "\n");
        }
        if (follow)
        {
            Tip(ctx, "systemd.journalFollow");
        }
        return 0;
    }

    // ---------- hostnamectl ----------

    private static readonly Regex HostnameRe = new(@"^[a-zA-Z0-9]([a-zA-Z0-9-]{0,62})\z", RegexOptions.CultureInvariant);
    private static readonly Regex PrettyNameRe = new("PRETTY_NAME=\"([^\"]+)\"", RegexOptions.CultureInvariant);

    private static readonly CommandDef Hostnamectl = new()
    {
        Name = "hostnamectl",
        Summary = "Visar eller ändrar datorns namn och systeminformation",
        SummaryEn = "Show or change the computer's hostname and system information",
        Man = """
            NAMN
                   hostnamectl - visa eller ändra datorns namn

            SYNOPSIS
                   hostnamectl [status]
                   sudo hostnamectl set-hostname NAMN

            BESKRIVNING
                   Utan argument visas datorns namn, operativsystem, kärna och
                   arkitektur. set-hostname skriver det nya namnet till /etc/hostname.
            """,
        ManEn = """
            NAME
                   hostnamectl - show or change the computer's hostname

            SYNOPSIS
                   hostnamectl [status]
                   sudo hostnamectl set-hostname NAME

            DESCRIPTION
                   Without arguments the hostname, operating system, kernel and
                   architecture are shown. set-hostname writes the new name to
                   /etc/hostname.
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var ops = ctx.Args.Where(a => !a.StartsWith('-')).ToList();
            var verb = ops.Count > 0 ? ops[0] : "status";
            var root = sh.RootUser();
            var hostname = (sh.Vfs.TryLookup("/etc/hostname", root)?.Content ?? sh.Distro.Hostname).Trim();
            var arg1 = ops.Count > 1 ? ops[1] : null;
            if (verb == "hostname" && string.IsNullOrEmpty(arg1))
            {
                ctx.Out(hostname + "\n");
                return 0;
            }
            if (verb == "set-hostname" || verb == "hostname")
            {
                var name = arg1;
                if (string.IsNullOrEmpty(name))
                {
                    ctx.Err("Too few arguments.\n");
                    return 1;
                }
                if (!HostnameRe.IsMatch(name))
                {
                    ctx.Err($"Invalid static hostname '{name}'\n");
                    return 1;
                }
                if (!IsRoot(ctx))
                {
                    ctx.Err($"Could not set static hostname: {Auth}\n");
                    SudoTip(ctx);
                    return 1;
                }
                sh.Vfs.WriteFile("/etc/hostname", name + "\n", root);
                Tip(ctx, "systemd.hostnameSaved");
                return 0;
            }
            if (verb != "status")
            {
                ctx.Err($"Unknown command verb '{verb}'.\n");
                return 1;
            }
            var pm = PrettyNameRe.Match(sh.Distro.OsRelease);
            var pretty = pm.Success ? pm.Groups[1].Value : sh.Distro.Name;
            var boot = sh.Services.Boots.Count > 0 ? sh.Services.Boots[^1] : null;
            ctx.Out(
                $" Static hostname: {hostname}\n" +
                "       Icon name: computer-vm\n" +
                "         Chassis: vm\n" +
                $"      Machine ID: {sh.Services.MachineId}\n" +
                $"         Boot ID: {boot?.Id ?? ""}\n" +
                "  Virtualization: kvm\n" +
                $"Operating System: {pretty}\n" +
                $"          Kernel: Linux {sh.Distro.Kernel}\n" +
                "    Architecture: x86-64\n" +
                " Hardware Vendor: QEMU\n" +
                "  Hardware Model: Standard PC _Q35 + ICH9, 2009_\n");
            return 0;
        },
    };

    // ---------- systemd-analyze ----------

    private static int FakeMs(string name)
    {
        uint h = 0;
        // for (const ch of name) iterates code points; charCodeAt(0) is the first UTF-16 unit.
        foreach (var rune in name.EnumerateRunes()) h = unchecked(h * 31 + rune.ToString()[0]);
        return 20 + (int)(h % 1800);
    }

    private static readonly Regex StartupRe = new(@"in (\S+) \(kernel\) \+ (\S+) \(userspace\) = (\S+)\.", RegexOptions.CultureInvariant);

    private static readonly CommandDef Analyze = new()
    {
        Name = "systemd-analyze",
        Summary = "Visar hur lång tid uppstarten tog",
        SummaryEn = "Show how long the boot took",
        Man = """
            NAMN
                   systemd-analyze - analysera uppstarten

            SYNOPSIS
                   systemd-analyze [time]
                   systemd-analyze blame

            BESKRIVNING
                   Utan argument (eller med time) visas hur lång tid kärnan och
                   tjänsterna tog att starta. blame listar tjänsterna med den som tog
                   längst tid först – bra för att hitta varför datorn startar långsamt.
            """,
        ManEn = """
            NAME
                   systemd-analyze - analyze the boot

            SYNOPSIS
                   systemd-analyze [time]
                   systemd-analyze blame

            DESCRIPTION
                   Without arguments (or with time) it shows how long the kernel and
                   the services took to start. blame lists the services with the
                   slowest first – useful for finding out why the computer boots slowly.
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var verb = ctx.Args.FirstOrDefault(a => !a.StartsWith('-')) ?? "time";
            var cur = ServicesLib.CurrentBoot(sh);
            if (verb == "time")
            {
                var line = sh.Services.Journal.Find(e => e.Boot == cur && e.Msg.StartsWith("Startup finished", StringComparison.Ordinal))?.Msg;
                var m = StartupRe.Match(line ?? "");
                var (k, u, total) = m.Success ? (m.Groups[1].Value, m.Groups[2].Value, m.Groups[3].Value) : ("2.153s", "4.871s", "7.024s");
                ctx.Out($"Startup finished in {k} (kernel) + {u} (userspace) = {total} \nmulti-user.target reached after {u} in userspace.\n");
                return 0;
            }
            if (verb == "blame")
            {
                var started = new List<string>();
                var seen = new HashSet<string>(StringComparer.Ordinal);
                foreach (var e in sh.Services.Journal)
                    if (e.Boot == cur && !string.IsNullOrEmpty(e.Unit) && e.Ident == "systemd" && seen.Add(e.Unit)) started.Add(e.Unit);
                var rows = started.Select(name => (Name: name, Ms: FakeMs(name))).ToList().StableSort((a, b) => b.Ms - a.Ms);
                foreach (var r in rows)
                    ctx.Out($"{(r.Ms >= 1000 ? $"{Js.ToFixed(r.Ms / 1000.0, 3)}s" : $"{r.Ms}ms").PadLeft(7)} {r.Name}\n");
                return 0;
            }
            ctx.Err($"Unknown command verb '{verb}'.\n");
            return 1;
        },
    };

    public static List<CommandDef> All { get; } = new() { Systemctl, Journalctl, Hostnamectl, Analyze, RebootCmd };
}
