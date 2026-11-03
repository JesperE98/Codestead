namespace Codestead.Shell.Commands;

// The readlink command: print where a symbolic link points.

public static partial class FileinfoCmd
{
    private static readonly CommandDef Readlink = new()
    {
        Name = "readlink",
        Summary = "Visar vart en symbolisk länk pekar",
        SummaryEn = "Print where a symbolic link points",
        Man = """
            NAMN
                   readlink - visa vart en symbolisk länk pekar

            SYNOPSIS
                   readlink [-f] FIL...

            BESKRIVNING
                   Skriver ut sökvägen som står i länken, precis som den skrevs
                   med ln -s. Är FIL ingen länk skrivs inget ut (slutstatus 1).

            FLAGGOR
                   -f   följ alla länkar och skriv den fullständiga sökvägen
                        (som realpath)
            """,
        ManEn = """
            NAME
                   readlink - print where a symbolic link points

            SYNOPSIS
                   readlink [-f] FILE...

            DESCRIPTION
                   Prints the path stored in the link, exactly as it was written with
                   ln -s. If FILE is not a link, nothing is printed (exit status 1).

            OPTIONS
                   -f   follow every link and print the full path (like realpath)
            """,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "femnqsvz", Long = new() { ["canonicalize"] = "f", ["canonicalize-existing"] = "e", ["canonicalize-missing"] = "m" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            if (o.Operands.Count == 0) return UtilCmd.BadOption(ctx, "missing operand");
            var sh = ctx.Sh;
            int code = 0;
            foreach (var arg in o.Operands)
            {
                if (o.Flags.Contains("f") || o.Flags.Contains("e") || o.Flags.Contains("m"))
                {
                    var p = Canonical(sh, arg, !o.Flags.Contains("e"));
                    if (p is null) code = 1;
                    else ctx.Out(p + "\n");
                    continue;
                }
                var node = sh.Vfs.TryLookupLink(sh.Resolve(arg), sh.CurrentUser());
                if (node?.Type == "link") ctx.Out((node.Content ?? "") + "\n");
                else code = 1;
            }
            return code;
        },
    };
}
