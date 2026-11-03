namespace Codestead.Shell.Commands;

// The wc command: counts lines, words and characters.

public static partial class TextCmd
{
    private static readonly CommandDef Wc = new()
    {
        Name = "wc",
        Summary = "Räknar rader, ord och tecken",
        Man = """
NAMN
       wc - räkna rader, ord och byte (word count)

SYNOPSIS
       wc [-l] [-w] [-c] [FIL]...

FLAGGOR
       -l    antal rader
       -w    antal ord
       -c    antal byte
       -m    antal tecken

EXEMPEL
       wc -l dokument/frukter.txt
       ls /etc | wc -l
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "lwcm", Long = new() { ["lines"] = "l", ["words"] = "w", ["bytes"] = "c", ["chars"] = "m" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var chosen = new[] { "l", "w", "m", "c" }.Where(f => o.Flags.Contains(f)).ToList();
            var fields = chosen.Count > 0 ? chosen : new List<string> { "l", "w", "c" };
            var (inputs, failed) = UtilCmd.ReadInputs(ctx, o.Operands);
            Dictionary<string, long> Count(string s) => new()
            {
                ["l"] = s.Count(c => c == '\n'),
                ["w"] = SplitWords(s).Count,
                ["c"] = Js.Utf8Length(s),
                ["m"] = Js.CodePointLength(s),
            };
            var rows = inputs.Select(i => (Label: o.Operands.Count > 0 ? i.Label : "", Counts: Count(i.Content))).ToList();
            if (rows.Count > 1)
            {
                var total = new Dictionary<string, long> { ["l"] = 0, ["w"] = 0, ["c"] = 0, ["m"] = 0 };
                foreach (var r in rows) foreach (var k in total.Keys.ToList()) total[k] += r.Counts[k];
                rows.Add(("total", total));
            }
            bool single = fields.Count == 1 && rows.Count == 1;
            int width = single
                ? 0
                : rows.SelectMany(r => fields.Select(f => Js.Num(r.Counts[f]).Length)).Append(o.Operands.Count > 0 ? 1 : 7).Max();
            foreach (var r in rows)
            {
                var nums = string.Join(" ", fields.Select(f => Js.Num(r.Counts[f]).PadLeft(width)));
                ctx.Out(r.Label != "" ? $"{nums} {r.Label}\n" : $"{nums}\n");
            }
            return failed ? 1 : 0;
        },
    };
}
