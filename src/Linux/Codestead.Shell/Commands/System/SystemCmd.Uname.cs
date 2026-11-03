namespace Codestead.Shell.Commands;

// The uname command: shows information about the system and the kernel.

public static partial class SystemCmd
{
    private static readonly CommandDef Uname = Simple("uname", "Visar information om systemet och kärnan", ctx =>
    {
        var d = ctx.Sh.Distro;
        var flags = new HashSet<string>(ctx.Args.SelectMany(a => a.StartsWith('-') ? a[1..].EnumerateRunes().Select(r => r.ToString()) : Enumerable.Empty<string>()));
        var parts = new List<string>();
        bool all = flags.Contains("a");
        if (all || flags.Contains("s") || flags.Count == 0) parts.Add("Linux");
        if (all || flags.Contains("n")) parts.Add(d.Hostname);
        if (all || flags.Contains("r")) parts.Add(d.Kernel);
        if (all || flags.Contains("v")) parts.Add("#1 SMP PREEMPT_DYNAMIC");
        if (all || flags.Contains("m")) parts.Add("x86_64");
        if (all || flags.Contains("o")) parts.Add("GNU/Linux");
        ctx.Out(string.Join(" ", parts) + "\n");
        return 0;
    }, """
NAMN
       uname - visa systeminformation

FLAGGOR
       -a    allt
       -r    kärnans version (kernel release)
       -n    värdnamnet
       -m    hårdvaruarkitektur (t.ex. x86_64)
""");
}
