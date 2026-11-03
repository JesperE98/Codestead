namespace Codestead.Shell.Commands;

// The du command: shows how much disk space files and directories use.

public static partial class ArchiveCmd
{
    private static readonly Regex DigitsRe = new("^[0-9]+\\z", RegexOptions.CultureInvariant);

    private static readonly CommandDef Du = new()
    {
        Name = "du",
        Summary = "Visar hur mycket diskutrymme filer och kataloger tar",
        Man = """
NAMN
       du - visa hur mycket diskutrymme filer och kataloger använder
            (disk usage)

SYNOPSIS
       du [FLAGGA]... [FIL]...

BESKRIVNING
       Visar storleken för varje katalog (och underkatalog) i kilobyte.
       Utan FIL visas aktuell katalog.

       Disken delas in i block om 4 KiB, så även en fil på 10 byte tar
       4.0K på disken. Den verkliga storleken visar du med --apparent-size
       eller med ls -l.

FLAGGOR
       -h, --human-readable   läsbara storlekar (4.0K, 12M, 1.5G)
       -s, --summarize        visa bara en summa per argument
       -a, --all              visa även filer, inte bara kataloger
       -c, --total            lägg till en rad med totalsumman
       -d, --max-depth=N      visa bara N nivåer ner
       -b, --bytes            verklig storlek i byte (--apparent-size)
           --apparent-size    verklig storlek i stället för diskutrymme

EXEMPEL
       du -sh dokument                 hur stor är katalogen?
       du -h -d 1 ~                    storleken på allt i hemkatalogen
       du -h dokument.tar dokument.tar.gz
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "hsacb",
                Values = "d",
                Long = new Dictionary<string, string>
                {
                    ["human-readable"] = "h",
                    ["summarize"] = "s",
                    ["all"] = "a",
                    ["total"] = "c",
                    ["bytes"] = "b",
                    ["apparent-size"] = "A",
                    ["max-depth"] = "d",
                },
            });
            if (o.Error is not null)
            {
                ctx.Err($"du: {o.Error}\nTry 'du --help' for more information.\n");
                return 1;
            }
            bool Has(string f) => o.Flags.Contains(f);
            if (Has("s") && Has("a"))
            {
                ctx.Err("du: cannot both summarize and show all entries\nTry 'du --help' for more information.\n");
                return 1;
            }
            double maxDepth = double.PositiveInfinity;
            if (o.Values.Get("d") is string dv)
            {
                if (!DigitsRe.IsMatch(dv))
                {
                    ctx.Err($"du: invalid maximum depth '{dv}'\nTry 'du --help' for more information.\n");
                    return 1;
                }
                maxDepth = Js.Number(dv);
            }
            if (Has("s")) maxDepth = 0;
            bool apparent = Has("b") || Has("A");
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            long Usage(FsNode n) => apparent ? VfsLib.NodeSize(n) : CeilDiv(VfsLib.NodeSize(n), 4096) * 4096;
            string Fmt(long bytes) => Has("h") ? UtilCmd.HumanSize(bytes) : Has("b") ? Js.Num(bytes) : Js.Num(CeilDiv(bytes, 1024));
            int code = 0;
            long total = 0;

            long Walk(string label, FsNode node, int depth)
            {
                long size = Usage(node);
                if (node.Type == "dir")
                {
                    if (!VfsLib.HasPerm(node, user, 'r') || !VfsLib.HasPerm(node, user, 'x'))
                    {
                        ctx.Err($"du: cannot read directory '{label}': Permission denied\n");
                        code = 1;
                    }
                    else
                    {
                        foreach (var child in SortedChildren(node))
                            size += Walk(label.EndsWith('/') ? label + child : $"{label}/{child}", node.Children![child], depth + 1);
                    }
                }
                if (depth <= maxDepth && (node.Type == "dir" || Has("a") || depth == 0)) ctx.Out($"{Fmt(size)}\t{label}\n");
                return size;
            }

            foreach (var op in o.Operands.Count > 0 ? o.Operands : new List<string> { "." })
            {
                try
                {
                    total += Walk(op, sh.Vfs.Lookup(sh.Resolve(op), user), 0);
                }
                catch (FsError e)
                {
                    ctx.Err($"du: cannot access '{op}': {e.Message}\n");
                    code = 1;
                }
            }
            if (Has("c")) ctx.Out($"{Fmt(total)}\ttotal\n");
            return code;
        },
    };
}
