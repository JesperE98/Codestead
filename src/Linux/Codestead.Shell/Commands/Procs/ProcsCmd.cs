namespace Codestead.Shell.Commands;

// Port of src/shell/commands/procs.ts – commands for processes and jobs: ps, top, kill, killall,
// pkill, pgrep, jobs, fg, bg, wait, uptime and free.

public static partial class ProcsCmd
{
    private static readonly OrderedDictionary<string, int> Signals = new(StringComparer.Ordinal)
    {
        ["HUP"] = 1, ["INT"] = 2, ["QUIT"] = 3, ["KILL"] = 9, ["TERM"] = 15, ["STOP"] = 19, ["CONT"] = 18, ["USR1"] = 10, ["USR2"] = 12,
    };

    private static readonly Regex LeadingDashRe = new("^-", RegexOptions.CultureInvariant);
    private static readonly Regex SigPrefixRe = new("^SIG", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex DigitsRe = new(@"^[0-9]+\z", RegexOptions.CultureInvariant);

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

    private static Job? PickJob(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        sh.RefreshJobs();
        var spec = LeadingPercentRe.Replace(Arg(ctx.Args, 0) ?? "%+", "", 1);
        var job = spec == "" || spec == "+" || spec == "%" ? sh.Proc.Jobs.At(-1) : sh.Proc.Jobs.FirstOrDefault(j => Js.Num(j.Id) == spec);
        if (job is null) ctx.Err($"bash: {ctx.Name}: {Arg(ctx.Args, 0) ?? "current"}: no such job\n");
        return job;
    }

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new() { Ps, Top, Kill, ByName("killall"), ByName("pkill"), ByName("pgrep"), Jobs, Fg, Bg, Wait, Uptime, Free };
}
