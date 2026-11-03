namespace Codestead.Shell.Commands;

// The ps command: shows processes.

public static partial class ProcsCmd
{
    private static readonly Regex BsdStyleRe = new(@"^-?[aux]+\z", RegexOptions.CultureInvariant);
    private static readonly Regex AxRe = new("[ax]", RegexOptions.CultureInvariant);
    private static readonly Regex SortSignRe = new(@"^[-+]", RegexOptions.CultureInvariant);

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
}
