namespace Codestead.Shell;

// Shell: background jobs (command &) and their notifications.

public partial class Shell
{
    // ---------- Background jobs ----------

    /// <summary>Updates jobs whose time has run out (e.g. `sleep 5 &amp;`).</summary>
    public void RefreshJobs()
    {
        var now = Js.Now();
        foreach (var job in Proc.Jobs.ToList())
        {
            if (job.State == "Running" && job.EndsAt is long endsAt && endsAt <= now) FinishJob(job, "Done");
        }
    }

    public void FinishJob(Job job, string state)
    {
        job.State = state;
        Proc.Procs = Proc.Procs.Where(p => p.Pid != job.Pid).ToList();
    }

    /// <summary>`command &amp;`: starts a background job and prints "[1] 4200".</summary>
    private int StartJob(Node node, XIO io)
    {
        RefreshJobs();
        var cmd = ShellLib.NodeToString(node);
        int id = Proc.Jobs.Select(j => j.Id).Append(0).Max() + 1;
        int pid = Proc.NextPid++;
        LastBgPid = pid;
        io.Err($"[{id}] {pid}\n");
        var seconds = ShellLib.SleepSeconds(node);
        if (seconds is double s)
        {
            // sleep runs "for real" in the background: the job finishes when the time has passed.
            Proc.Jobs.Add(new Job { Id = id, Pid = pid, Cmd = cmd, State = "Running", EndsAt = Js.Now() + (long)(s * 1000) });
            Proc.Procs.Add(new Proc
            {
                Pid = pid,
                Ppid = ProcsLib.ShellPid,
                User = CurrentUser().Name,
                Cmd = cmd,
                Cpu = 0,
                Mem = 0,
                Vsz = 8_300,
                Rss = 1_900,
                Tty = "pts/0",
                Stat = "S",
                Start = Js.LocalNow().ToString("HH:mm", CultureInfo.InvariantCulture),
                Time = "0:00",
            });
        }
        else
        {
            // Other commands run directly – in the simulator they finish at once.
            int exit = Exec(node, io);
            Proc.Jobs.Add(new Job { Id = id, Pid = pid, Cmd = cmd, State = "Done", Exit = exit });
        }
        return 0;
    }

    /// <summary>"[1]+  Done   sleep 3" for jobs that have finished since last time.</summary>
    private string JobNotifications()
    {
        RefreshJobs();
        var finished = Proc.Jobs.Where(j => j.State != "Running").ToList();
        if (finished.Count == 0) return "";
        var last = Proc.Jobs.Count > 0 ? Proc.Jobs[^1] : null;
        Proc.Jobs = Proc.Jobs.Where(j => j.State == "Running").ToList();
        return string.Concat(finished.Select(j =>
        {
            var state = j.State == "Done" && j.Exit is int e && e != 0 ? $"Exit {e}" : j.State;
            return $"[{j.Id}]{(ReferenceEquals(j, last) ? "+" : "-")}  {state,-24}{j.Cmd}\n";
        }));
    }
}
