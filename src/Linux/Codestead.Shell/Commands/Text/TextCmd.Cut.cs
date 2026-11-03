namespace Codestead.Shell.Commands;

// The cut command: picks out columns from lines.

public static partial class TextCmd
{
    private static readonly Regex ListPartRe = new(@"^([0-9]*)(-?)([0-9]*)\z", RegexOptions.CultureInvariant);

    private static Func<double, bool>? ParseList(string spec)
    {
        var ranges = new List<(double From, double To)>();
        foreach (var part in spec.Split(','))
        {
            var m = ListPartRe.Match(part);
            if (!m.Success || (m.Groups[1].Value == "" && m.Groups[3].Value == "")) return null;
            double from = m.Groups[1].Value != "" ? Js.Number(m.Groups[1].Value) : 1;
            double to = m.Groups[2].Value != "" ? (m.Groups[3].Value != "" ? Js.Number(m.Groups[3].Value) : double.PositiveInfinity) : from;
            ranges.Add((from, to));
        }
        return n => ranges.Any(r => n >= r.From && n <= r.To);
    }

    private static readonly CommandDef Cut = new()
    {
        Name = "cut",
        Summary = "Plockar ut kolumner ur rader",
        Man = """
NAMN
       cut - plocka ut delar av varje rad

SYNOPSIS
       cut -d AVGRÄNSARE -f FÄLT [FIL]...
       cut -c TECKEN [FIL]...

FLAGGOR
       -d TECKEN   använd TECKEN som fältavgränsare (standard är tabb)
       -f LISTA    välj fält, t.ex. 1 eller 1,3 eller 2-4
       -c LISTA    välj tecken på samma sätt

EXEMPEL
       cut -d: -f1 /etc/passwd      alla användarnamn
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Values = "dfc", Long = new() { ["delimiter"] = "d", ["fields"] = "f", ["characters"] = "c" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var spec = o.Values.Get("f") ?? o.Values.Get("c");
            if (string.IsNullOrEmpty(spec)) return UtilCmd.BadOption(ctx, "you must specify a list of bytes, characters, or fields");
            var pick = ParseList(spec);
            if (pick is null) return UtilCmd.BadOption(ctx, $"invalid field value '{spec}'");
            var delim = o.Values.Get("d") ?? "\t";
            var chars = o.Values.Get("c");
            var (inputs, failed) = UtilCmd.ReadInputs(ctx, o.Operands);
            foreach (var input in inputs)
            {
                foreach (var line in UtilCmd.SplitLines(input.Content))
                {
                    if (!string.IsNullOrEmpty(chars))
                    {
                        ctx.Out(string.Concat(line.EnumerateRunes().Where((_, i) => pick(i + 1)).Select(r => r.ToString())) + "\n");
                    }
                    else if (!line.Contains(delim, StringComparison.Ordinal))
                    {
                        ctx.Out(line + "\n");
                    }
                    else
                    {
                        ctx.Out(string.Join(delim, Js.Split(line, delim).Where((_, i) => pick(i + 1))) + "\n");
                    }
                }
            }
            return failed ? 1 : 0;
        },
    };
}
