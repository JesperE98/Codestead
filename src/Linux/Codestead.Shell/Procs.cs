namespace Codestead.Shell;

// Port of src/shell/procs.ts – the process table of the simulated computer: system processes, the
// user's shell, a runaway process to find, and background jobs the student starts.

public partial class Proc
{
    public int Pid { get; set; }
    public int Ppid { get; set; }
    public string User { get; set; } = "";
    /// <summary>The whole command line, e.g. "/usr/sbin/sshd -D".</summary>
    public string Cmd { get; set; } = "";
    public double Cpu { get; set; }
    public double Mem { get; set; }
    public long Vsz { get; set; }
    public long Rss { get; set; }
    public string Tty { get; set; } = "?";
    public string Stat { get; set; } = "Ss";
    public string Start { get; set; } = "08:00";
    public string Time { get; set; } = "0:00";
}

public partial class Job
{
    public int Id { get; set; }
    public int Pid { get; set; }
    public string Cmd { get; set; } = "";
    /// <summary>"Running", "Done", "Terminated" or "Killed".</summary>
    public string State { get; set; } = "Running";
    /// <summary>When a `sleep` job finishes (ms since 1970).</summary>
    public long? EndsAt { get; set; }
    public int? Exit { get; set; }
}

public partial class ProcState
{
    public List<Proc> Procs { get; set; } = new();
    public List<Job> Jobs { get; set; } = new();
    public int NextPid { get; set; }
}

public static partial class ProcsLib
{
    /// <summary>The shell's own process (bash in the terminal).</summary>
    public const int ShellPid = 1290;
    /// <summary>The process that eats CPU and that the student should find.</summary>
    public const int RunawayPid = 3141;
    /// <summary>The exercise server running as root.</summary>
    public const int ServerPid = 812;

    private static Proc P(int pid, int ppid, string user, string cmd, Action<Proc>? extra = null)
    {
        var proc = new Proc
        {
            Pid = pid,
            Ppid = ppid,
            User = user,
            Cmd = cmd,
            Cpu = 0,
            Mem = 0.1,
            Vsz = 20_000 + ((long)pid * 7919 % 300_000),
            Rss = 4_000 + ((long)pid * 104_729 % 40_000),
            Tty = "?",
            Stat = "Ss",
            Start = "08:00",
            Time = "0:00",
        };
        extra?.Invoke(proc);
        return proc;
    }

    public static ProcState InitialProcs(Distro distro, string student)
    {
        var common = new List<Proc>
        {
            P(1, 0, "root", "/sbin/init", p => p.Time = "0:02"),
            P(2, 0, "root", "[kthreadd]", p => { p.Stat = "S"; p.Rss = 0; p.Vsz = 0; }),
            P(312, 1, "root", "/usr/lib/systemd/systemd-journald", p => p.Mem = 0.3),
            P(341, 1, "root", "/usr/lib/systemd/systemd-udevd"),
            P(520, 1, "root", "/usr/lib/systemd/systemd-logind"),
        };
        List<Proc> family = distro.Family switch
        {
            "debian" => new List<Proc>
            {
                P(498, 1, "messagebus", "/usr/bin/dbus-daemon --system --address=systemd: --nofork"),
                P(530, 1, "root", "/usr/sbin/cron -f"),
                P(533, 1, "syslog", "/usr/sbin/rsyslogd -n"),
            }.Concat(distro.Id == "ubuntu" ? new[] { P(560, 1, "root", "/usr/lib/snapd/snapd", p => p.Mem = 0.6) } : Array.Empty<Proc>()).ToList(),
            "arch" => new List<Proc>
            {
                P(498, 1, "dbus", "/usr/bin/dbus-broker-launch --scope system"),
                P(531, 1, "root", "/usr/lib/systemd/systemd-timesyncd"),
            },
            _ => new List<Proc>
            {
                P(498, 1, "dbus", "/usr/bin/dbus-broker-launch --scope system"),
                P(540, 1, "root", "/usr/bin/python3 -sP /usr/sbin/firewalld --nofork --nopid", p => p.Mem = 0.5),
                P(545, 1, "chrony", "/usr/sbin/chronyd -F 2"),
                P(560, 1, "root", "/usr/sbin/NetworkManager --no-daemon", p => p.Mem = 0.4),
            },
        };
        var procs = new List<Proc>();
        procs.AddRange(common);
        procs.AddRange(family);
        procs.Add(P(733, 1, "root", "/usr/sbin/sshd -D"));
        procs.Add(P(ServerPid, 1, "root", "/usr/local/bin/myserver --port 8080", p => { p.Cpu = 1.2; p.Mem = 1.8; p.Time = "0:41"; }));
        procs.Add(P(1201, 1, student, "/usr/lib/systemd/systemd --user"));
        procs.Add(P(ShellPid, 1201, student, "-bash", p => { p.Tty = "pts/0"; p.Stat = "Ss"; p.Start = "10:02"; }));
        procs.Add(P(RunawayPid, 1201, student, "yes", p => { p.Cpu = 99.7; p.Mem = 0.0; p.Stat = "R"; p.Start = "10:05"; p.Time = "42:13"; }));
        return new ProcState { Procs = procs, Jobs = new List<Job>(), NextPid = 4200 };
    }

    /// <summary>The command's name, e.g. "sshd" for "/usr/sbin/sshd -D".</summary>
    public static string ProcName(Proc proc)
    {
        var first = proc.Cmd.Split(' ')[0];
        if (first.StartsWith('[')) return first.Slice(1, -1);
        var stripped = first.StartsWith('-') ? first[1..] : first;
        return stripped.Split('/').Last();
    }
}
