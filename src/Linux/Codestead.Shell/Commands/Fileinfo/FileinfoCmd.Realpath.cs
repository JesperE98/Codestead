namespace Codestead.Shell.Commands;

// The realpath command: print the full path, without links.

public static partial class FileinfoCmd
{
    private static readonly CommandDef Realpath = new()
    {
        Name = "realpath",
        Summary = "Skriver den fullständiga sökvägen utan länkar",
        SummaryEn = "Print the full path, without links",
        Man = """
            NAMN
                   realpath - skriv den fullständiga sökvägen

            SYNOPSIS
                   realpath FIL...

            BESKRIVNING
                   Skriver den absoluta sökvägen till FIL, där alla symboliska
                   länkar, . och .. är upplösta.

            EXEMPEL
                   realpath .
                   realpath ~/loggen
            """,
        ManEn = """
            NAME
                   realpath - print the resolved path

            SYNOPSIS
                   realpath FILE...

            DESCRIPTION
                   Prints the absolute path to FILE, with every symbolic link, . and
                   .. resolved.

            EXAMPLES
                   realpath .
                   realpath ~/thelog
            """,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "emqsz", Long = new() { ["canonicalize-existing"] = "e", ["canonicalize-missing"] = "m", ["quiet"] = "q" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            if (o.Operands.Count == 0) return UtilCmd.BadOption(ctx, "missing operand");
            int code = 0;
            foreach (var arg in o.Operands)
            {
                var p = Canonical(ctx.Sh, arg, !o.Flags.Contains("e"));
                if (p is null)
                {
                    if (!o.Flags.Contains("q")) ctx.Err($"realpath: {arg}: No such file or directory\n");
                    code = 1;
                }
                else ctx.Out(p + "\n");
            }
            return code;
        },
    };
}
