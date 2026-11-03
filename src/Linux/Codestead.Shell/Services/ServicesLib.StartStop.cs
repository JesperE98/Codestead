namespace Codestead.Shell;

// ServicesLib: service processes, start/stop, syncing with the process table, daemon-reload and enable/disable.

public static partial class ServicesLib
{
    // ---------- Processes ----------

    private static string Hhmm(long t)
    {
        var d = Js.LocalDate(t);
        return $"{d.Hour:00}:{d.Minute:00}";
    }

    private static Proc NewProc(int pid, string user, string cmd, long t) => new()
    {
        Pid = pid,
        Ppid = 1,
        User = user,
        Cmd = cmd,
        Cpu = 0,
        Mem = 0.2,
        Vsz = 20_000 + ((long)pid * 7919 % 300_000),
        Rss = 4_000 + ((long)pid * 104_729 % 40_000),
        Tty = "?",
        Stat = "Ss",
        Start = Hhmm(t),
        Time = "0:00",
    };

    private static bool HasProc(Shell sh, int? pid) => pid is not null && sh.Proc.Procs.Any(p => p.Pid == pid);

    private static int PickPid(Shell sh, int? wanted = null)
    {
        if (wanted is int w && !HasProc(sh, w) && !sh.Proc.Jobs.Any(j => j.Pid == w)) return w;
        return sh.Proc.NextPid++;
    }

    // ---------- Start and stop ----------

    // How a start happens (the `mode` parameter):
    // - "real": for real – the process is added to the process table.
    // - "init": when the model is created – existing processes in the table are taken over.
    // - "record": only journal lines (for the previous boot).

    public static StartResult StartUnit(Shell sh, UnitRt rt, long t, string mode = "real", bool atBoot = false)
    {
        var st = sh.Services;
        if (rt.Active == "active") return new StartResult { Ok = true };
        // A new start must come after the unit's earlier journal lines, even within the same millisecond
        // (fast machines) – otherwise `systemctl status` would show lines from the previous, failed start.
        var lastOwn = st.Journal.Where(e => e.Unit == rt.Name).Select(e => e.T).DefaultIfEmpty(long.MinValue).Max();
        if (lastOwn >= t) t = lastOwn + 1;
        var info = UnitInfo(rt);
        var def = DefFor(sh, rt.Name);
        var desc = info.Description != "" ? $"{rt.Name} - {info.Description}" : rt.Name;
        var job = ++st.Job;
        var ident = IdentOf(info.Exec);
        var user = info.User ?? "root";

        // What can go wrong: the program does not exist, or (for our own services) a check.
        StartFailure? failure = null;
        if (mode != "record")
        {
            if (def?.Check is not null) failure = def.Check(sh);
            else if (def is null)
            {
                var bin0 = info.Exec.Split(' ')[0];
                var path = bin0.Contains('/') ? bin0 : $"/usr/bin/{bin0}";
                var node = bin0 != "" ? sh.Vfs.TryLookup(path, sh.RootUser()) : null;
                if (node is null || node.Type != "file" || (node.Mode & Js.Oct(111)) == 0)
                {
                    failure = new StartFailure { Log = new(), Status = 203, StatusName = "EXEC", Exec = true };
                }
            }
        }

        if (info.Type != "simple" && info.Type != "exec") Log(sh, t, "systemd", $"Starting {desc}...", unit: rt.Name);
        int pid = mode == "record"
            ? def?.Pid ?? 900 + job
            : mode == "init"
                ? def?.Pid ?? PickPid(sh)
                : PickPid(sh, atBoot ? def?.Pid : null);

        if (failure is not null)
        {
            var bin = info.Exec.Split(' ')[0];
            if (bin == "") bin = "(none)";
            if (failure.Exec)
            {
                Log(sh, t, "systemd", $"{rt.Name}: Failed to locate executable {bin}: No such file or directory", unit: rt.Name, prio: 3, pid: pid);
                Log(sh, t, "systemd", $"{rt.Name}: Failed at step EXEC spawning {bin}: No such file or directory", unit: rt.Name, prio: 3, pid: pid);
            }
            else
            {
                foreach (var line in failure.Log) Log(sh, t, ident, line, unit: rt.Name, pid: pid, prio: line.StartsWith("error", StringComparison.Ordinal) ? 3 : 6);
            }
            var exitInfo = $"code=exited, status={failure.Status}/{failure.StatusName}";
            Log(sh, t, "systemd", $"{rt.Name}: Main process exited, {exitInfo}", unit: rt.Name, prio: 5, x: new JournalCatalog
            {
                Subject = "Unit process exited",
                Body = new() { $"An ExecStart= process belonging to unit {rt.Name} has exited.", "", $"The process' exit code is 'exited' and its exit status is {failure.Status}." },
            });
            Log(sh, t, "systemd", $"{rt.Name}: Failed with result 'exit-code'.", unit: rt.Name, prio: 4, x: new JournalCatalog
            {
                Subject = "Unit failed",
                Body = new() { $"The unit {rt.Name} has entered the 'failed' state with result 'exit-code'." },
            });
            Log(sh, t, "systemd", $"Failed to start {desc}.", unit: rt.Name, prio: 3, x: new JournalCatalog
            {
                Subject = $"A start job for unit {rt.Name} has failed",
                Body = new() { $"A start job for unit {rt.Name} has finished with a failure.", "", $"The job identifier is {job} and the job result is failed." },
            });
            rt.Active = "failed";
            rt.Sub = "failed";
            rt.Since = t;
            rt.StartedAt = t;
            rt.Pid = null;
            rt.LastPid = pid;
            rt.Result = "exit-code";
            rt.ExitInfo = exitInfo;
            return new StartResult { Ok = false };
        }

        if (info.Type == "oneshot")
        {
            foreach (var line in def?.Log ?? new List<string>()) Log(sh, t, ident, line, unit: rt.Name, pid: pid);
            if (info.RemainAfterExit)
            {
                Log(sh, t, "systemd", $"Finished {desc}.", unit: rt.Name, x: SubjectStarted(rt.Name, job));
                rt.Active = "active";
                rt.Sub = "exited";
            }
            else
            {
                Log(sh, t, "systemd", $"{rt.Name}: Deactivated successfully.", unit: rt.Name);
                Log(sh, t, "systemd", $"Finished {desc}.", unit: rt.Name, x: SubjectStarted(rt.Name, job));
                rt.Active = "inactive";
                rt.Sub = "dead";
            }
            rt.Since = t;
            rt.StartedAt = t;
            rt.Pid = null;
            rt.LastPid = pid;
            rt.Result = null;
            rt.ExitInfo = "code=exited, status=0/SUCCESS";
            return new StartResult { Ok = true };
        }

        if (mode != "record")
        {
            var template = ProcsLib.InitialProcs(sh.Distro, sh.World.User).Procs.Find(p => p.Pid == pid && p.Cmd == info.Exec);
            if (mode == "real" || (!HasProc(sh, pid) && template is null))
            {
                if (!HasProc(sh, pid))
                {
                    Proc proc;
                    if (template is not null && mode == "real")
                    {
                        // { ...template, start, time } – the template is a fresh object, so it can be changed.
                        template.Start = Hhmm(t);
                        template.Time = "0:00";
                        proc = template;
                    }
                    else proc = NewProc(pid, user, info.Exec, t);
                    sh.Proc.Procs.Add(proc);
                }
            }
        }
        void Started() => Log(sh, t, "systemd", $"Started {desc}.", unit: rt.Name, x: SubjectStarted(rt.Name, job));
        if (info.Type == "simple" || info.Type == "exec") Started();
        foreach (var line in def?.Log ?? new List<string>()) Log(sh, t, ident, line, unit: rt.Name, pid: pid);
        if (info.Type != "simple" && info.Type != "exec") Started();
        rt.Active = "active";
        rt.Sub = "running";
        rt.Since = t;
        rt.StartedAt = t;
        rt.Pid = pid;
        rt.LastPid = null;
        rt.Result = null;
        rt.ExitInfo = null;
        return new StartResult { Ok = true };
    }

    public static void StopUnit(Shell sh, UnitRt rt, long t, string mode = "real")
    {
        if (rt.Active != "active") return;
        var info = UnitInfo(rt);
        var def = DefFor(sh, rt.Name);
        var desc = info.Description != "" ? $"{rt.Name} - {info.Description}" : rt.Name;
        Log(sh, t, "systemd", $"Stopping {desc}...", unit: rt.Name);
        if (rt.Pid is int mainPid)
        {
            foreach (var line in def?.StopLog ?? new List<string>()) Log(sh, t, IdentOf(info.Exec), line, unit: rt.Name, pid: mainPid);
            if (mode != "record") sh.Proc.Procs = sh.Proc.Procs.Where(p => p.Pid != mainPid).ToList();
        }
        Log(sh, t, "systemd", $"{rt.Name}: Deactivated successfully.", unit: rt.Name);
        Log(sh, t, "systemd", $"Stopped {desc}.", unit: rt.Name);
        var lastPid = rt.Pid ?? rt.LastPid;
        var exitInfo = rt.Pid is not null ? "code=killed, signal=TERM" : rt.ExitInfo;
        rt.Active = "inactive";
        rt.Sub = "dead";
        rt.Since = t;
        rt.LastPid = lastPid;
        rt.Pid = null;
        rt.Result = null;
        rt.ExitInfo = exitInfo;
    }

    /// <summary>
    /// Reconciles the services with the process table: if the main process has been killed
    /// (e.g. with `sudo pkill myserver`) the service is no longer running.
    /// </summary>
    public static void SyncServices(Shell sh, long? t = null)
    {
        var now = t ?? Js.Now();
        foreach (var rt in sh.Services.Units.Values)
        {
            if (rt.Active != "active" || rt.Pid is null || HasProc(sh, rt.Pid)) continue;
            Log(sh, now, "systemd", $"{rt.Name}: Deactivated successfully.", unit: rt.Name);
            rt.Active = "inactive";
            rt.Sub = "dead";
            rt.Since = now;
            rt.LastPid = rt.Pid;
            rt.Pid = null;
            rt.ExitInfo = "code=killed, signal=TERM";
        }
    }

    /// <summary>Re-reads all unit files (systemctl daemon-reload).</summary>
    public static void DaemonReload(Shell sh)
    {
        var st = sh.Services;
        var names = new List<string>();
        var seen = new HashSet<string>(StringComparer.Ordinal);
        void Add(string n)
        {
            if (seen.Add(n)) names.Add(n);
        }
        foreach (var k in st.Units.Keys) Add(k);
        foreach (var dir in new[] { SystemUnitDir, AdminUnitDir })
        {
            var node = sh.Vfs.TryLookup(dir, sh.RootUser());
            if (node?.Children is null) continue;
            foreach (var (name, child) in node.Children)
                if (child.Type == "file" && name.EndsWith(".service", StringComparison.Ordinal)) Add(name);
        }
        foreach (var name in names)
        {
            if (LoadUnit(sh, name) is not null) continue;
            // The unit file was removed: forget the service unless it is running.
            if (st.Units[name].Active != "active") st.Units.Remove(name);
        }
    }

    // ---------- Enable and disable ----------

    public static LinkChange EnableUnit(Shell sh, UnitRt rt)
    {
        var info = UnitInfo(rt);
        var change = new LinkChange();
        foreach (var target in info.WantedBy)
        {
            var path = WantsPath(target, rt.Name);
            if (sh.Vfs.TryLookup(path, sh.RootUser()) is not null) continue;
            var dir = EnsureDir(sh, $"{AdminUnitDir}/{target}.wants");
            // Enabling a service is a symbolic link from the target's .wants directory to the unit file.
            dir.Children![rt.Name] = VfsLib.MakeLink(rt.Path);
            change.Created.Add($"{path} → {rt.Path}");
        }
        return change;
    }

    public static LinkChange DisableUnit(Shell sh, UnitRt rt)
    {
        var info = UnitInfo(rt);
        var change = new LinkChange();
        foreach (var target in info.WantedBy)
        {
            var path = WantsPath(target, rt.Name);
            if (sh.Vfs.TryLookupLink(path, sh.RootUser()) is null) continue;
            sh.Vfs.Remove(path, sh.RootUser());
            change.Removed.Add(path);
        }
        return change;
    }
}
