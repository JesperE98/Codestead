namespace Codestead.Shell.Commands;

// The pwd command: prints the current directory.

public static partial class FsCmd
{
    private static readonly CommandDef Pwd = new()
    {
        Name = "pwd",
        Builtin = true,
        Summary = "Skriver ut aktuell katalog",
        Man = """
NAMN
       pwd - skriv ut namnet på aktuell katalog (print working directory)

SYNOPSIS
       pwd [-P]

BESKRIVNING
       Skriver ut den absoluta sökvägen till katalogen du står i.

FLAGGOR
       -P   visa den verkliga sökvägen, utan symboliska länkar
""",
        Run = ctx =>
        {
            // pwd -P: the real path, without symbolic links (cd follows them but remembers the way you came).
            if (ctx.Args.Contains("-P"))
            {
                try
                {
                    ctx.Out(ctx.Sh.Vfs.RealPath(ctx.Sh.Cwd, ctx.Sh.CurrentUser()) + "\n");
                    return 0;
                }
                catch (FsError)
                {
                    // The directory is gone: show the path as it is.
                }
            }
            ctx.Out(ctx.Sh.Cwd + "\n");
            return 0;
        },
    };
}
