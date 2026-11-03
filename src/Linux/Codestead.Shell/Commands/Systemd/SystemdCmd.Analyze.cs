namespace Codestead.Shell.Commands;

// The systemd-analyze command: show how long the boot took.

public static partial class SystemdCmd
{
    private static int FakeMs(string name)
    {
        uint h = 0;
        // for (const ch of name) iterates code points; charCodeAt(0) is the first UTF-16 unit.
        foreach (var rune in name.EnumerateRunes()) h = unchecked(h * 31 + rune.ToString()[0]);
        return 20 + (int)(h % 1800);
    }

    private static readonly Regex StartupRe = new(@"in (\S+) \(kernel\) \+ (\S+) \(userspace\) = (\S+)\.", RegexOptions.CultureInvariant);

    private static readonly CommandDef Analyze = new()
    {
        Name = "systemd-analyze",
        Summary = "Visar hur lång tid uppstarten tog",
        SummaryEn = "Show how long the boot took",
        Man = """
            NAMN
                   systemd-analyze - analysera uppstarten

            SYNOPSIS
                   systemd-analyze [time]
                   systemd-analyze blame

            BESKRIVNING
                   Utan argument (eller med time) visas hur lång tid kärnan och
                   tjänsterna tog att starta. blame listar tjänsterna med den som tog
                   längst tid först – bra för att hitta varför datorn startar långsamt.
            """,
        ManEn = """
            NAME
                   systemd-analyze - analyze the boot

            SYNOPSIS
                   systemd-analyze [time]
                   systemd-analyze blame

            DESCRIPTION
                   Without arguments (or with time) it shows how long the kernel and
                   the services took to start. blame lists the services with the
                   slowest first – useful for finding out why the computer boots slowly.
            """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var verb = ctx.Args.FirstOrDefault(a => !a.StartsWith('-')) ?? "time";
            var cur = ServicesLib.CurrentBoot(sh);
            if (verb == "time")
            {
                var line = sh.Services.Journal.Find(e => e.Boot == cur && e.Msg.StartsWith("Startup finished", StringComparison.Ordinal))?.Msg;
                var m = StartupRe.Match(line ?? "");
                var (k, u, total) = m.Success ? (m.Groups[1].Value, m.Groups[2].Value, m.Groups[3].Value) : ("2.153s", "4.871s", "7.024s");
                ctx.Out($"Startup finished in {k} (kernel) + {u} (userspace) = {total} \nmulti-user.target reached after {u} in userspace.\n");
                return 0;
            }
            if (verb == "blame")
            {
                var started = new List<string>();
                var seen = new HashSet<string>(StringComparer.Ordinal);
                foreach (var e in sh.Services.Journal)
                    if (e.Boot == cur && !string.IsNullOrEmpty(e.Unit) && e.Ident == "systemd" && seen.Add(e.Unit)) started.Add(e.Unit);
                var rows = started.Select(name => (Name: name, Ms: FakeMs(name))).ToList().StableSort((a, b) => b.Ms - a.Ms);
                foreach (var r in rows)
                    ctx.Out($"{(r.Ms >= 1000 ? $"{Js.ToFixed(r.Ms / 1000.0, 3)}s" : $"{r.Ms}ms").PadLeft(7)} {r.Name}\n");
                return 0;
            }
            ctx.Err($"Unknown command verb '{verb}'.\n");
            return 1;
        },
    };
}
