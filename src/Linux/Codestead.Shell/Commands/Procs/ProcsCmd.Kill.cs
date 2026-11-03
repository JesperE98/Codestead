namespace Codestead.Shell.Commands;

// The kill command: sends a signal to a process (ends it).

public static partial class ProcsCmd
{
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
}
