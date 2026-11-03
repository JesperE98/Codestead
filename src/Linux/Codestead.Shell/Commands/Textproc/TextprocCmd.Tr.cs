namespace Codestead.Shell.Commands;

// The tr command: replaces or deletes characters.

public static partial class TextprocCmd
{
    private static readonly Regex TrShortFlagsRe = new("^-[a-zA-Z]+\\z", RegexOptions.CultureInvariant);

    private static readonly CommandDef Tr = new()
    {
        Name = "tr",
        Summary = "Byter ut eller tar bort tecken",
        Man = """
NAMN
       tr - översätt (translate), ta bort eller pressa ihop tecken

SYNOPSIS
       tr [-c] [-d] [-s] MÄNGD1 [MÄNGD2]

BESKRIVNING
       Läser standard input, byter varje tecken i MÄNGD1 mot tecknet på
       samma plats i MÄNGD2 och skriver resultatet till standard output.
       tr läser bara från standard input – aldrig från filer. Använd en pipe
       eller <.

       Mängder skrivs som vanliga tecken, intervall eller klasser:
       a-z  A-Z  0-9           intervall
       [:upper:] [:lower:]     stora / små bokstäver
       [:digit:] [:space:]     siffror / blanktecken
       [:alpha:] [:alnum:] [:punct:]
       \n  \t                  ny rad, tabb

       Obs! tr arbetar med enskilda byte, så a-z och [:lower:] omfattar
       inte å, ä och ö.

FLAGGOR
       -d    ta bort (delete) alla tecken i MÄNGD1
       -s    pressa ihop (squeeze) upprepade tecken till ett
       -c    använd komplementet till MÄNGD1 (alla tecken som INTE finns där)

EXEMPEL
       echo hej | tr a-z A-Z            HEJ
       echo $PATH | tr ':' '\n'         en katalog per rad
       tr -d '0-9' < fil.txt            ta bort alla siffror
       echo "a   b    c" | tr -s ' '    a b c
""",
        Run = ctx =>
        {
            var flags = new HashSet<string>();
            var ops = new List<string>();
            int i = 0;
            var longFlags = new Dictionary<string, string> { ["--delete"] = "d", ["--squeeze-repeats"] = "s", ["--complement"] = "c" };
            for (; i < ctx.Args.Count; i++)
            {
                var a = ctx.Args[i];
                if (a == "--")
                {
                    i++;
                    break;
                }
                if (longFlags.TryGetValue(a, out var lf))
                {
                    flags.Add(lf);
                    continue;
                }
                if (TrShortFlagsRe.IsMatch(a))
                {
                    foreach (var c in a[1..])
                    {
                        if (!"dscC".Contains(c))
                        {
                            ctx.Err($"tr: invalid option -- '{c}'\nTry 'tr --help' for more information.\n");
                            return 1;
                        }
                        flags.Add(c == 'C' ? "c" : c.ToString());
                    }
                    continue;
                }
                if (a.StartsWith("--", StringComparison.Ordinal))
                {
                    ctx.Err($"tr: unrecognized option '{a}'\nTry 'tr --help' for more information.\n");
                    return 1;
                }
                ops.Add(a);
            }
            ops.AddRange(ctx.Args.Skip(i));

            bool del = flags.Contains("d");
            bool squeeze = flags.Contains("s");
            int Usage(string msg)
            {
                ctx.Err($"tr: {msg}\nTry 'tr --help' for more information.\n");
                return 1;
            }
            if (ops.Count == 0) return Usage("missing operand");
            if (del && !squeeze && ops.Count > 1)
                return Usage($"extra operand '{ops[1]}'\nOnly one string may be given when deleting without squeezing repeated characters.");
            if (del && squeeze && ops.Count < 2)
                return Usage($"missing operand after '{ops[0]}'\nTwo strings must be given when both deleting and squeezing repeats.");
            if (!del && !squeeze && ops.Count < 2) return Usage($"missing operand after '{ops[0]}'\nTwo strings must be given when translating.");
            if (ops.Count > 2) return Usage($"extra operand '{ops[2]}'");

            List<string> set1;
            List<string> set2;
            try
            {
                set1 = ExpandTrSet(ops[0]);
                set2 = ops.Count > 1 ? ExpandTrSet(ops[1]) : new List<string>();
            }
            catch (TrError e)
            {
                ctx.Err($"tr: {e.Message}\n");
                return 1;
            }
            var in1 = new HashSet<string>(set1, StringComparer.Ordinal);
            bool complement = flags.Contains("c");
            bool InSet1(string c) => complement ? !in1.Contains(c) : in1.Contains(c);
            bool translating = !del && ops.Count == 2;
            if (translating && set2.Count == 0)
            {
                ctx.Err("tr: when not truncating set1, string2 must be non-empty\n");
                return 1;
            }
            var map = new Dictionary<string, string>(StringComparer.Ordinal);
            if (translating && !complement)
                for (int idx = 0; idx < set1.Count; idx++) map[set1[idx]] = set2[Math.Min(idx, set2.Count - 1)];
            var squeezeSet = new HashSet<string>(del || translating ? set2 : set1, StringComparer.Ordinal);
            bool SqueezeTest(string c) => del || translating ? squeezeSet.Contains(c) : InSet1(c);

            var o = new StringBuilder();
            var last = "";
            foreach (var ch in CodePoints(ctx.Stdin ?? ""))
            {
                var c = ch;
                if (del && InSet1(c)) continue;
                if (translating)
                {
                    if (complement)
                    {
                        if (InSet1(c)) c = set2[^1];
                    }
                    else c = map.TryGetValue(c, out var mc) ? mc : c;
                }
                if (squeeze && c == last && SqueezeTest(c)) continue;
                o.Append(c);
                last = c;
            }
            ctx.Out(o.ToString());
            return 0;
        },
    };
}
