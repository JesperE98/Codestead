namespace Codestead.Shell.Commands;

// The sort command: sorts lines.

public static partial class TextCmd
{
    private static readonly CommandDef Sort = new()
    {
        Name = "sort",
        Summary = "Sorterar rader",
        Man = """
NAMN
       sort - sortera rader i textfiler

SYNOPSIS
       sort [FLAGGA]... [FIL]...

FLAGGOR
       -r    omvänd ordning
       -n    sortera numeriskt (2 före 10)
       -u    ta bort dubbletter
       -f    ignorera skillnad mellan stora och små bokstäver
       -k N  sortera på fält nummer N

EXEMPEL
       sort frukter.txt
       sort frukter.txt | uniq -c | sort -rn
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "rnuf",
                Values = "k",
                Long = new() { ["reverse"] = "r", ["numeric-sort"] = "n", ["unique"] = "u", ["ignore-case"] = "f", ["key"] = "k" },
            });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error, 2);
            var (inputs, failed) = UtilCmd.ReadInputs(ctx, o.Operands, (l, m) => $"sort: cannot read: {l}: {m}");
            if (failed) return 2;
            var lines = inputs.SelectMany(i => UtilCmd.SplitLines(i.Content)).ToList();
            var k = o.Values.Get("k");
            double field = !string.IsNullOrEmpty(k) ? Js.Number(k.Split(',')[0]) : 0;
            bool hasField = field != 0 && !double.IsNaN(field);
            string Key(string l) => hasField ? string.Join(" ", Js.Slice(SplitWordsKeepEmpty(JsTrim(l)), ToIndex(field - 1))) : l;
            var compareOptions = o.Flags.Contains("f") ? CompareOptions.IgnoreCase | CompareOptions.IgnoreNonSpace : CompareOptions.None;
            var collation = Collation(ctx.Sh);
            int Cmp(string a, string b)
            {
                var ka = Key(a);
                var kb = Key(b);
                if (o.Flags.Contains("n"))
                {
                    double na = Js.ParseFloat(ka), nb = Js.ParseFloat(kb);
                    double d = (double.IsNaN(na) ? 0 : na) - (double.IsNaN(nb) ? 0 : nb);
                    // A NaN result counts as "equal" in a JS sort comparator.
                    if (double.IsNaN(d)) return 0;
                    if (d != 0) return d < 0 ? -1 : 1;
                }
                else
                {
                    int c = collation.Compare(ka, kb, compareOptions);
                    if (c != 0) return c;
                }
                int o2 = string.CompareOrdinal(a, b);
                return o2 < 0 ? -1 : o2 > 0 ? 1 : 0;
            }
            lines.StableSort(Cmp);
            if (o.Flags.Contains("r")) lines.Reverse();
            if (o.Flags.Contains("u"))
            {
                var all = lines;
                lines = all.Where((l, i) => i == 0 || Cmp(l, all[i - 1]) != 0).ToList();
            }
            ctx.Out(UtilCmd.JoinLines(lines));
            return 0;
        },
    };

    /// <summary>s.split(/\s+/) in JavaScript (without dropping empty strings).</summary>
    private static List<string> SplitWordsKeepEmpty(string s) => JsWhitespaceRun.Split(s).ToList();
}
