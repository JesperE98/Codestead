namespace Codestead.Shell.Commands;

// Port of src/shell/commands/procs.ts – commands for processes and jobs: ps, top, kill, killall,
// pkill, pgrep, jobs, fg, bg, wait, uptime and free.

public static partial class ProcsCmd
{
    private static readonly OrderedDictionary<string, int> Signals = new(StringComparer.Ordinal)
    {
        ["HUP"] = 1, ["INT"] = 2, ["QUIT"] = 3, ["KILL"] = 9, ["TERM"] = 15, ["STOP"] = 19, ["CONT"] = 18, ["USR1"] = 10, ["USR2"] = 12,
    };

    private static readonly Regex BsdStyleRe = new(@"^-?[aux]+\z", RegexOptions.CultureInvariant);
    private static readonly Regex AxRe = new("[ax]", RegexOptions.CultureInvariant);
    private static readonly Regex SortSignRe = new(@"^[-+]", RegexOptions.CultureInvariant);
    private static readonly Regex LeadingDashRe = new("^-", RegexOptions.CultureInvariant);
    private static readonly Regex SigPrefixRe = new("^SIG", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex DigitsRe = new(@"^[0-9]+\z", RegexOptions.CultureInvariant);
    private static readonly Regex RegexSpecialRe = new(@"[.*+?^${}()|[\]\\]", RegexOptions.CultureInvariant);
    private static readonly Regex LeadingPercentRe = new("^%", RegexOptions.CultureInvariant);

    /// <summary>args[i], or null (undefined) when i is out of range.</summary>
    private static string? Arg(IReadOnlyList<string> args, int i) => i >= 0 && i < args.Count ? args[i] : null;

    /// <summary>Math.round in JavaScript (halves round up).</summary>
    private static double JsRound(double x) => Math.Floor(x + 0.5);

    private static int Sign(double d) => d > 0 ? 1 : d < 0 ? -1 : 0;

    private static string TimeString(int length) =>
        Js.LocalNow().ToString("HH:mm:ss", CultureInfo.InvariantCulture).Slice(0, length);

    /// <summary>Every process right now, including the command that is running (e.g. ps itself).</summary>
    private static List<Proc> Snapshot(CmdCtx ctx, string? self = null)
    {
        var sh = ctx.Sh;
        sh.RefreshJobs();
        var procs = new List<Proc>(sh.Proc.Procs);
        if (!string.IsNullOrEmpty(self))
        {
            procs.Add(new Proc
            {
                Pid = sh.Proc.NextPid++,
                Ppid = ProcsLib.ShellPid,
                User = sh.CurrentUser().Name,
                Cmd = self,
                Cpu = 0,
                Mem = 0.1,
                Vsz = 11_200,
                Rss = 4_100,
                Tty = "pts/0",
                Stat = "R+",
                Start = TimeString(5),
                Time = "0:00",
            });
        }
        return procs;
    }

    /// <summary>Every process right now (exported as currentProcs).</summary>
    public static List<Proc> CurrentProcs(CmdCtx ctx, string? self = null) => Snapshot(ctx, self);

    private static string FmtTime(string t)
    {
        var parts = t.Split(':').Select(x => Js.Number(x)).ToList();
        double m = parts.Count > 0 ? parts[0] : double.NaN;
        double s = parts.Count > 1 ? parts[1] : double.NaN;
        return $"{Js.Num(Math.Floor(m / 60)).PadLeft(2, '0')}:{Js.Num(m % 60).PadLeft(2, '0')}:{Js.Num(s).PadLeft(2, '0')}";
    }

    private static readonly CommandDef Ps = new()
    {
        Name = "ps",
        Summary = "Visar processer",
        Man = """
            NAMN
                   ps - visa en ögonblicksbild av processerna

            SYNOPSIS
                   ps [FLAGGOR]

            BESKRIVNING
                   Utan flaggor visas bara processerna i din egen terminal.

            FLAGGOR
                   aux              alla processer, med användare, CPU och minne (BSD-stil)
                   -ef              alla processer med förälderns PID (PPID)
                   -u ANVÄNDARE     bara processer som tillhör ANVÄNDARE
                   -p PID           bara processen med PID
                   --sort=-%cpu     sortera efter CPU-användning, störst först
                                    (även -%mem, pid, -pid)

            KOLUMNER
                   PID   processens id-nummer
                   %CPU  hur mycket av processorn processen använder
                   STAT  R = kör, S = sover, s = sessionsledare, + = i förgrunden
                   TTY   terminalen processen hör till (? = ingen)

            EXEMPEL
                   ps aux | grep sshd
                   ps aux --sort=-%cpu | head -5
            """,
        Run = ctx =>
        {
            var args = new List<string>(ctx.Args);
            var style = "short"; // 'short' | 'bsd' | 'full'
            string? user = null;
            double? pid = null;
            string? sort = null;
            for (int i = 0; i < args.Count; i++)
            {
                var a = args[i];
                if (a == "-u" || a == "U") user = Arg(args, ++i);
                else if (BsdStyleRe.IsMatch(a) && AxRe.IsMatch(a)) style = a.Contains('u') ? "bsd" : "full";
                else if (new[] { "-ef", "-e", "-A", "-f", "-eF" }.Contains(a)) style = "full";
                else if (a == "-p" || a == "p") pid = Js.Number(Arg(args, ++i));
                else if (a.StartsWith("--sort=", StringComparison.Ordinal)) sort = a.Slice(7);
                else if (a == "--sort") sort = Arg(args, ++i);
                else return UtilCmd.BadOption(ctx, $"unsupported option (BSD syntax) '{a}'");
            }
            var procs = Snapshot(ctx, $"ps {string.Join(" ", ctx.Args)}".Trim());
            if (style == "short" && user is null && pid is null) procs = procs.Where(p => p.Tty == "pts/0").ToList();
            if (user is not null) procs = procs.Where(p => p.User == user).ToList();
            if (pid is double wanted) procs = procs.Where(p => p.Pid == wanted).ToList();
            if (!string.IsNullOrEmpty(sort))
            {
                var desc = sort.StartsWith('-');
                var key = SortSignRe.Replace(sort, "", 1);
                double Val(Proc p) => key == "%cpu" || key == "pcpu" ? p.Cpu : key == "%mem" || key == "pmem" ? p.Mem : p.Pid;
                procs.StableSort((a, b) => Sign(desc ? Val(b) - Val(a) : Val(a) - Val(b)));
            }
            if (style == "short" && user is null && pid is null)
            {
                ctx.Out("    PID TTY          TIME CMD\n");
                foreach (var p in procs) ctx.Out($"{Js.Num(p.Pid).PadLeft(7)} {p.Tty.PadRight(8)} {FmtTime(p.Time)} {ProcsLib.ProcName(p)}\n");
            }
            else if (style == "full" || (style == "short" && (user is not null || pid is not null)))
            {
                ctx.Out("UID          PID    PPID  C STIME TTY          TIME CMD\n");
                foreach (var p in procs)
                {
                    ctx.Out(
                        $"{p.User.PadRight(8)} {Js.Num(p.Pid).PadLeft(7)} {Js.Num(p.Ppid).PadLeft(7)} {Js.Num(JsRound(p.Cpu)).PadLeft(2)} {p.Start} {p.Tty.PadRight(8)} {FmtTime(p.Time)} {p.Cmd}\n");
                }
            }
            else
            {
                ctx.Out("USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\n");
                foreach (var p in procs)
                {
                    ctx.Out(
                        $"{p.User.PadRight(10)} {Js.Num(p.Pid).PadLeft(5)} {Js.ToFixed(p.Cpu, 1).PadLeft(4)} {Js.ToFixed(p.Mem, 1).PadLeft(4)} {Js.Num(p.Vsz).PadLeft(6)} {Js.Num(p.Rss).PadLeft(5)} {p.Tty.PadRight(8)} {p.Stat.PadRight(4)} {p.Start} {p.Time.PadLeft(6)} {p.Cmd}\n");
                }
            }
            return 0;
        },
    };

    public static void TopScreen(CmdCtx ctx, string name)
    {
        var procs = Snapshot(ctx, name).StableSort((a, b) =>
        {
            var d = Sign(b.Cpu - a.Cpu);
            return d != 0 ? d : Sign(a.Pid - b.Pid);
        });
        var total = procs.Count;
        var running = procs.Count(p => p.Stat.StartsWith('R'));
        var load = procs.Aggregate(0.0, (s, p) => s + p.Cpu) / 100;
        var time = TimeString(8);
        ctx.Out(
            $"top - {time} up  2:14,  1 user,  load average: {Js.ToFixed(load, 2)}, {Js.ToFixed(load * 0.9, 2)}, {Js.ToFixed(load * 0.8, 2)}\n" +
            $"Tasks: {Js.Num(total).PadLeft(3)} total, {Js.Num(running).PadLeft(3)} running, {Js.Num(total - running).PadLeft(3)} sleeping,   0 stopped,   0 zombie\n" +
            $"%Cpu(s): {Js.ToFixed(Math.Min(99.9, load * 50), 1).PadLeft(4)} us,  0.7 sy,  0.0 ni, {Js.ToFixed(Math.Max(0, 100 - load * 50 - 0.7), 1).PadLeft(4)} id,  0.0 wa\n" +
            "MiB Mem :   7884.2 total,   5203.1 free,   1884.6 used,    796.5 buff/cache\n" +
            "MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   5999.6 avail Mem\n\n");
        const string header = "    PID USER      PR  NI    VIRT    RES S  %CPU  %MEM     TIME+ COMMAND";
        ctx.Out(ctx.IsTTY ? $"\x1b[30;42m{header}{UtilCmd.Color.Reset}\n" : header + "\n");
        foreach (var p in procs)
        {
            ctx.Out(
                $"{Js.Num(p.Pid).PadLeft(7)} {p.User.Slice(0, 8).PadRight(8)}  20   0 {Js.Num(p.Vsz).PadLeft(7)} {Js.Num(p.Rss).PadLeft(6)} {p.Stat.CharAt(0)} {Js.ToFixed(p.Cpu, 1).PadLeft(5)} {Js.ToFixed(p.Mem, 1).PadLeft(5)} {(p.Time + ".00").PadLeft(9)} {ProcsLib.ProcName(p)}\n");
        }
    }

    private static readonly CommandDef Top = new()
    {
        Name = "top",
        Summary = "Visar processerna som använder mest resurser",
        Man = """
            NAMN
                   top - visa processer och resursanvändning, uppdateras hela tiden

            BESKRIVNING
                   Överst visas belastning (load average), antal processer, CPU och
                   minne. Sedan alla processer, sorterade efter CPU-användning.
                   I en riktig terminal uppdateras top varje sekund: tryck M för att
                   sortera på minne, k för att döda en process och q för att avsluta.
                   I simulatorn visas en ögonblicksbild.

            FLAGGOR
                   -b -n 1   skriv ut en gång (bra i skript)
            """,
        Run = ctx =>
        {
            TopScreen(ctx, "top");
            if (ctx.IsTTY) ctx.Out($"{UtilCmd.Color.Dim}({ctx.Sh.Msg("procs.topSnapshot")}){UtilCmd.Color.Reset}\n");
            return 0;
        },
    };

    /// <summary>Shared logic for kill, killall and pkill. Returns true on success.</summary>
    private static bool SignalProc(CmdCtx ctx, Proc proc, double signal, Action<string> report)
    {
        var sh = ctx.Sh;
        var user = sh.CurrentUser();
        if (user.Uid != 0 && proc.User != user.Name)
        {
            report("Operation not permitted");
            return false;
        }
        if (proc.Pid == 1 || proc.Pid == 2) return true; // init ignores ordinary signals
        if (proc.Pid == ProcsLib.ShellPid)
        {
            ctx.Err($"{UtilCmd.Color.Dim}({ctx.Sh.Msg("procs.killOwnShell")}){UtilCmd.Color.Reset}\n");
            return true;
        }
        if (signal == 0 || signal == 18 || signal == 19) return true;
        var job = sh.Proc.Jobs.FirstOrDefault(j => j.Pid == proc.Pid);
        if (job is not null) sh.FinishJob(job, signal == 9 ? "Killed" : "Terminated");
        else sh.Proc.Procs = sh.Proc.Procs.Where(p => p.Pid != proc.Pid).ToList();
        return true;
    }

    private static double? ParseSignal(string arg)
    {
        var s = SigPrefixRe.Replace(LeadingDashRe.Replace(arg, "", 1), "", 1).ToUpperInvariant();
        if (DigitsRe.IsMatch(s)) return Js.Number(s);
        return Signals.TryGetValue(s, out var n) ? n : null;
    }

    private static readonly CommandDef Kill = new()
    {
        Name = "kill",
        Builtin = true,
        Summary = "Skickar en signal till en process (avslutar den)",
        Man = """
            NAMN
                   kill - skicka en signal till en process

            SYNOPSIS
                   kill [-SIGNAL] PID...
                   kill %JOBB
                   kill -l

            BESKRIVNING
                   Som standard skickas SIGTERM (15), som ber processen avsluta sig
                   snyggt. Om den inte lyssnar kan du skicka SIGKILL (9), som tvingar
                   den att sluta direkt – men då hinner den inte städa efter sig.

                   Du kan bara skicka signaler till dina egna processer. För andra
                   användares processer behövs sudo.

            SIGNALER
                   1  HUP    läs om inställningarna (för många tjänster)
                   2  INT    samma som Ctrl+C
                   9  KILL   tvinga processen att avsluta
                   15 TERM   be processen avsluta (standard)

            EXEMPEL
                   kill 3141
                   kill -9 3141
                   kill %1
            """,
        Run = ctx =>
        {
            var args = new List<string>(ctx.Args);
            if (Arg(args, 0) == "-l" || Arg(args, 0) == "-L")
            {
                ctx.Out(" 1) SIGHUP\t 2) SIGINT\t 3) SIGQUIT\t 9) SIGKILL\n10) SIGUSR1\t12) SIGUSR2\t15) SIGTERM\t18) SIGCONT\n19) SIGSTOP\n");
                return 0;
            }
            double signal = 15;
            if (Arg(args, 0) == "-s" || Arg(args, 0) == "-n")
            {
                args.RemoveAt(0);
                var next = args.Count > 0 ? args[0] : "";
                if (args.Count > 0) args.RemoveAt(0);
                var s = ParseSignal(next);
                if (s is null) return UtilCmd.BadOption(ctx, "invalid signal specification");
                signal = s.Value;
            }
            else if (Arg(args, 0) is string first && first.StartsWith('-') && first != "--")
            {
                args.RemoveAt(0);
                var s = ParseSignal(first);
                if (s is null)
                {
                    ctx.Err($"bash: kill: {ctx.Args[0].Slice(1)}: invalid signal specification\n");
                    return 1;
                }
                signal = s.Value;
            }
            if (Arg(args, 0) == "--") args.RemoveAt(0);
            if (args.Count == 0)
            {
                ctx.Err("kill: usage: kill [-s sigspec | -n signum | -sigspec] pid | jobspec ... or kill -l [sigspec]\n");
                return 2;
            }
            var sh = ctx.Sh;
            sh.RefreshJobs();
            int code = 0;
            foreach (var target in args)
            {
                double pid;
                if (target.StartsWith('%'))
                {
                    var spec = target.Slice(1);
                    var job = spec == "" || spec == "%" || spec == "+"
                        ? sh.Proc.Jobs.At(-1)
                        : sh.Proc.Jobs.FirstOrDefault(j => Js.Num(j.Id) == spec);
                    if (job is null || job.State != "Running")
                    {
                        ctx.Err($"bash: kill: {target}: no such job\n");
                        code = 1;
                        continue;
                    }
                    pid = job.Pid;
                }
                else if (DigitsRe.IsMatch(target))
                {
                    pid = Js.Number(target);
                }
                else
                {
                    ctx.Err($"bash: kill: {target}: arguments must be process or job IDs\n");
                    code = 1;
                    continue;
                }
                var proc = sh.Proc.Procs.FirstOrDefault(p => p.Pid == pid);
                if (proc is null)
                {
                    ctx.Err($"bash: kill: ({Js.Num(pid)}) - No such process\n");
                    code = 1;
                    continue;
                }
                if (!SignalProc(ctx, proc, signal, msg => ctx.Err($"bash: kill: ({Js.Num(pid)}) - {msg}\n"))) code = 1;
            }
            return code;
        },
    };

    private static CommandDef ByName(string name) // 'killall' | 'pkill' | 'pgrep'
    {
        var summaries = new Dictionary<string, string>
        {
            ["killall"] = "Avslutar alla processer med ett visst namn",
            ["pkill"] = "Avslutar processer vars namn matchar ett mönster",
            ["pgrep"] = "Visar PID för processer vars namn matchar ett mönster",
        };
        var options = name == "pgrep"
            ? "\n       -l        visa även processens namn\n       -a        visa hela kommandoraden"
            : "\n       -9        skicka SIGKILL i stället för SIGTERM";
        return new CommandDef
        {
            Name = name,
            Summary = summaries[name],
            Man = $"""
                NAMN
                       {name} - {summaries[name].ToLowerInvariant()}

                SYNOPSIS
                       {name} [-SIGNAL] {(name == "killall" ? "NAMN" : "MÖNSTER")}

                FLAGGOR{options}
                       -u ANV    bara processer som tillhör ANV

                EXEMPEL
                       {name} {(name == "killall" ? "firefox" : "minserver")}
                """,
            Run = ctx =>
            {
                var args = new List<string>(ctx.Args);
                double signal = 15;
                string? user = null;
                bool list = false;
                bool full = false;
                var rest = new List<string>();
                for (int i = 0; i < args.Count; i++)
                {
                    var a = args[i];
                    if (a == "-u") user = Arg(args, ++i);
                    else if (a == "-l" && name == "pgrep") list = true;
                    else if (a == "-a" && name == "pgrep") full = true;
                    else if (a.StartsWith('-') && name != "pgrep")
                    {
                        var s = ParseSignal(a);
                        if (s is null) return UtilCmd.BadOption(ctx, $"invalid option -- '{a.Slice(1)}'");
                        signal = s.Value;
                    }
                    else rest.Add(a);
                }
                var pattern = Arg(rest, 0);
                if (string.IsNullOrEmpty(pattern))
                {
                    ctx.Err(name == "killall" ? "Usage: killall [OPTION]... [--] NAME...\n" : $"{name}: no matching criteria specified\n");
                    return 2;
                }
                Regex re;
                try
                {
                    re = name == "killall"
                        ? new Regex($"^{RegexSpecialRe.Replace(pattern, @"\$0")}\\z", RegexOptions.CultureInvariant)
                        : new Regex(pattern, RegexOptions.CultureInvariant);
                }
                catch (ArgumentException)
                {
                    ctx.Err($"{name}: invalid regular expression\n");
                    return 2;
                }
                var matches = Snapshot(ctx).Where(p => re.IsMatch(ProcsLib.ProcName(p)) && (user is null || p.User == user) && p.Pid != ProcsLib.ShellPid).ToList();
                if (name == "pgrep")
                {
                    foreach (var p in matches) ctx.Out(full ? $"{p.Pid} {p.Cmd}\n" : list ? $"{p.Pid} {ProcsLib.ProcName(p)}\n" : $"{p.Pid}\n");
                    return matches.Count > 0 ? 0 : 1;
                }
                if (matches.Count == 0)
                {
                    if (name == "killall") ctx.Err($"{pattern}: no process found\n");
                    return 1;
                }
                bool ok = false;
                foreach (var p in matches)
                {
                    Action<string> report = name == "killall"
                        ? msg => ctx.Err($"{ProcsLib.ProcName(p)}({p.Pid}): {msg}\n")
                        : msg => ctx.Err($"pkill: killing pid {p.Pid} failed: {msg}\n");
                    if (SignalProc(ctx, p, signal, report)) ok = true;
                }
                return ok ? 0 : 1;
            },
        };
    }

    private static string JobLine(Job job, bool last, bool @long)
    {
        var state = job.State == "Running" ? "Running" : job.State;
        return $"[{job.Id}]{(last ? "+" : "-")}  {(@long ? job.Pid + " " : "")}{state.PadRight(24)}{job.Cmd}{(job.State == "Running" ? " &" : "")}\n";
    }

    private static readonly CommandDef Jobs = new()
    {
        Name = "jobs",
        Builtin = true,
        Summary = "Visar bakgrundsjobb i den här terminalen",
        Man = """
            NAMN
                   jobs - visa jobb som startats från den här terminalen

            SYNOPSIS
                   jobs [-l]

            BESKRIVNING
                   Ett jobb startas i bakgrunden genom att skriva & efter kommandot,
                   t.ex. "sleep 300 &". Jobben numreras [1], [2] ... och kan anges som
                   %1, %2 till kill, fg och bg.

            FLAGGOR
                   -l    visa även PID
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            sh.RefreshJobs();
            var list = sh.Proc.Jobs;
            for (int i = 0; i < list.Count; i++) ctx.Out(JobLine(list[i], i == list.Count - 1, ctx.Args.Contains("-l")));
            return 0;
        },
    };

    private static Job? PickJob(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        sh.RefreshJobs();
        var spec = LeadingPercentRe.Replace(Arg(ctx.Args, 0) ?? "%+", "", 1);
        var job = spec == "" || spec == "+" || spec == "%" ? sh.Proc.Jobs.At(-1) : sh.Proc.Jobs.FirstOrDefault(j => Js.Num(j.Id) == spec);
        if (job is null) ctx.Err($"bash: {ctx.Name}: {Arg(ctx.Args, 0) ?? "current"}: no such job\n");
        return job;
    }

    private static readonly CommandDef Fg = new()
    {
        Name = "fg",
        Builtin = true,
        Summary = "Flyttar ett bakgrundsjobb till förgrunden",
        Man = """
            NAMN
                   fg - flytta ett jobb till förgrunden

            SYNOPSIS
                   fg [%JOBB]

            BESKRIVNING
                   Jobbet tar över terminalen tills det är klart. I en riktig terminal
                   kan du skicka tillbaka det till bakgrunden med Ctrl+Z följt av bg.
            """,
        Run = ctx =>
        {
            var job = PickJob(ctx);
            if (job is null) return 1;
            ctx.Out(job.Cmd + "\n");
            if (job.State == "Running")
            {
                ctx.Out($"{UtilCmd.Color.Dim}({ctx.Sh.Msg("procs.fgJobDone")}){UtilCmd.Color.Reset}\n");
                ctx.Sh.FinishJob(job, "Done");
            }
            ctx.Sh.Proc.Jobs = ctx.Sh.Proc.Jobs.Where(j => !ReferenceEquals(j, job)).ToList();
            return 0;
        },
    };

    private static readonly CommandDef Bg = new()
    {
        Name = "bg",
        Builtin = true,
        Summary = "Fortsätter ett stoppat jobb i bakgrunden",
        Man = """
            NAMN
                   bg - låt ett stoppat jobb fortsätta i bakgrunden

            SYNOPSIS
                   bg [%JOBB]

            BESKRIVNING
                   Används efter att ett program stoppats med Ctrl+Z.
            """,
        Run = ctx =>
        {
            var job = PickJob(ctx);
            if (job is null) return 1;
            ctx.Err($"bash: bg: job {job.Id} already in background\n");
            return 0;
        },
    };

    private static readonly CommandDef Wait = new()
    {
        Name = "wait",
        Builtin = true,
        Summary = "Väntar tills bakgrundsjobben är klara",
        Man = """
            NAMN
                   wait - vänta på att bakgrundsjobb blir klara

            BESKRIVNING
                   Används i skript som startar flera saker parallellt med & och
                   sedan behöver vänta in dem. I simulatorn blir jobben klara direkt.
            """,
        Run = ctx =>
        {
            foreach (var job in ctx.Sh.Proc.Jobs.ToList()) if (job.State == "Running") ctx.Sh.FinishJob(job, "Done");
            ctx.Sh.Proc.Jobs = new List<Job>();
            return 0;
        },
    };

    private static readonly CommandDef Uptime = new()
    {
        Name = "uptime",
        Summary = "Visar hur länge datorn varit igång och belastningen",
        Man = """
            NAMN
                   uptime - visa hur länge systemet varit igång

            BESKRIVNING
                   Load average är det genomsnittliga antalet processer som vill ha
                   processorn under senaste 1, 5 och 15 minuterna.
            """,
        Run = ctx =>
        {
            var load = Snapshot(ctx).Aggregate(0.0, (s, p) => s + p.Cpu) / 100;
            ctx.Out($" {TimeString(8)} up  2:14,  1 user,  load average: {Js.ToFixed(load, 2)}, {Js.ToFixed(load * 0.9, 2)}, {Js.ToFixed(load * 0.8, 2)}\n");
            return 0;
        },
    };

    private static readonly CommandDef Free = new()
    {
        Name = "free",
        Summary = "Visar hur mycket minne som används",
        Man = """
            NAMN
                   free - visa använt och ledigt minne

            FLAGGOR
                   -h    läsbara enheter (Mi, Gi)
                   -m    i mebibyte
            """,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "hmgk", Long = new Dictionary<string, string> { ["human"] = "h" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            const long total = 8_073_420, used = 1_929_820, free = 5_327_976, shared = 102_400, cache = 815_624, avail = 6_143_600, swap = 2_097_148;
            string F(long n) => o.Flags.Contains("h")
                ? (n >= 1_048_576 ? $"{Js.ToFixed(n / 1_048_576.0, 1)}Gi" : $"{Js.Num(JsRound(n / 1024.0))}Mi")
                : o.Flags.Contains("m") ? Js.Num(JsRound(n / 1024.0)) : Js.Num(n);
            string C(long n) => F(n).PadLeft(12);
            ctx.Out($"{"".PadRight(7)}{"total".PadLeft(12)}{"used".PadLeft(12)}{"free".PadLeft(12)}{"shared".PadLeft(12)}{"buff/cache".PadLeft(12)}{"available".PadLeft(12)}\n");
            ctx.Out($"Mem:   {C(total)}{C(used)}{C(free)}{C(shared)}{C(cache)}{C(avail)}\n");
            ctx.Out($"Swap:  {C(swap)}{C(0)}{C(swap)}\n");
            return 0;
        },
    };

    public static List<CommandDef> All { get; } = new() { Ps, Top, Kill, ByName("killall"), ByName("pkill"), ByName("pgrep"), Jobs, Fg, Bg, Wait, Uptime, Free };
}
