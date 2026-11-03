namespace Codestead.Shell.Commands;

// What systemctl prints: unit status, the system overview and the list-* tables.

public static partial class SystemdCmd
{
    private const string BoldGreen = "\x1b[1;32m";

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

    /// <summary>The distribution's timers: (timer, what it starts, how often: "daily", "weekly", "hourly" or "15min").</summary>
    private static List<(string Timer, string Service, string Every)> Timers(Distro d) => d.Family switch
    {
        "debian" => new()
        {
            ("apt-daily-upgrade.timer", "apt-daily-upgrade.service", "daily"),
            ("apt-daily.timer", "apt-daily.service", "daily"),
            ("dpkg-db-backup.timer", "dpkg-db-backup.service", "daily"),
            ("e2scrub_all.timer", "e2scrub_all.service", "weekly"),
            ("fstrim.timer", "fstrim.service", "weekly"),
            ("logrotate.timer", "logrotate.service", "daily"),
            ("man-db.timer", "man-db.service", "daily"),
            ("systemd-tmpfiles-clean.timer", "systemd-tmpfiles-clean.service", "daily"),
        },
        "redhat" => new()
        {
            ("dnf-makecache.timer", "dnf-makecache.service", "hourly"),
            ("fstrim.timer", "fstrim.service", "weekly"),
            ("logrotate.timer", "logrotate.service", "daily"),
            ("raid-check.timer", "raid-check.service", "weekly"),
            ("systemd-tmpfiles-clean.timer", "systemd-tmpfiles-clean.service", "daily"),
        },
        _ => new()
        {
            ("archlinux-keyring-wkd-sync.timer", "archlinux-keyring-wkd-sync.service", "weekly"),
            ("shadow.timer", "shadow.service", "daily"),
            ("systemd-tmpfiles-clean.timer", "systemd-tmpfiles-clean.service", "daily"),
        },
    };

    private static string Left(TimeSpan span)
    {
        if (span.TotalHours >= 24) return $"{(int)span.TotalDays} day{((int)span.TotalDays == 1 ? "" : "s")} {span.Hours}h";
        if (span.TotalMinutes >= 60) return $"{(int)span.TotalHours}h {span.Minutes}min";
        return $"{Math.Max(1, (int)span.TotalMinutes)}min";
    }

    /// <summary>systemctl list-timers: systemd's own way of running jobs at set times (instead of cron).</summary>
    private static int ListTimers(CmdCtx ctx)
    {
        var now = Js.LocalNow();
        string Stamp(DateTime d) => $"{d.ToString("ddd yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture)} {TzName(d)}";
        var rows = new List<List<string>> { new() { "NEXT", "LEFT", "LAST", "PASSED", "UNIT", "ACTIVATES" } };
        var entries = Timers(ctx.Sh.Distro).Select(t =>
        {
            DateTime next = t.Every switch
            {
                "hourly" => now.Date.AddHours(now.Hour + 1),
                "weekly" => now.Date.AddDays(((int)DayOfWeek.Monday - (int)now.DayOfWeek + 7) % 7 is 0 ? 7 : ((int)DayOfWeek.Monday - (int)now.DayOfWeek + 7) % 7),
                _ => now.Date.AddDays(1),
            };
            var last = t.Every switch
            {
                "hourly" => next.AddHours(-1),
                "weekly" => next.AddDays(-7),
                _ => next.AddDays(-1),
            };
            return (Next: next, Last: last, t.Timer, t.Service);
        }).OrderBy(e => e.Next).ThenBy(e => e.Timer, StringComparer.Ordinal).ToList();
        foreach (var e in entries)
            rows.Add(new() { Stamp(e.Next), Left(e.Next - now) + " left", Stamp(e.Last), Left(now - e.Last) + " ago", e.Timer, e.Service });
        foreach (var line in Table(rows)) ctx.Out(line + "\n");
        ctx.Out($"\n{entries.Count} timers listed.\nPass --all to see loaded but inactive timers, too.\n");
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
}
