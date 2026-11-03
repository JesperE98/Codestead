namespace Codestead.Shell.Commands;

// The killall, pkill and pgrep commands.

public static partial class ProcsCmd
{
    private static readonly Regex RegexSpecialRe = new(@"[.*+?^${}()|[\]\\]", RegexOptions.CultureInvariant);

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
                       {name} {(name == "killall" ? "firefox" : "myserver")}
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
}
