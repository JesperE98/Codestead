namespace Codestead.Shell.Commands;

// The mkdir command: creates directories.

public static partial class FsCmd
{
    private static readonly CommandDef Mkdir = new()
    {
        Name = "mkdir",
        Summary = "Skapar kataloger",
        Man = """
NAMN
       mkdir - skapa kataloger (make directory)

SYNOPSIS
       mkdir [FLAGGA]... KATALOG...

FLAGGOR
       -p, --parents   skapa även föräldrakataloger som saknas, och ge
                       inget fel om katalogen redan finns
       -v, --verbose   berätta om varje katalog som skapas

EXEMPEL
       mkdir -p projekt/src/test
""",
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "pv", Long = new() { ["parents"] = "p", ["verbose"] = "v" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            if (o.Operands.Count == 0) return UtilCmd.BadOption(ctx, "missing operand");
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            int code = 0;
            foreach (var t in o.Operands)
            {
                var path = sh.Resolve(t);
                try
                {
                    if (o.Flags.Contains("p"))
                    {
                        var segs = path.Split('/').Where(s => s != "");
                        var cur = "";
                        foreach (var seg in segs)
                        {
                            cur += "/" + seg;
                            var existing = sh.Vfs.TryLookup(cur, user);
                            if (existing is not null)
                            {
                                if (existing.Type != "dir") throw new FsError("ENOTDIR");
                                continue;
                            }
                            sh.Vfs.Mkdir(cur, user);
                            if (o.Flags.Contains("v")) ctx.Out($"mkdir: created directory '{cur}'\n");
                        }
                    }
                    else
                    {
                        sh.Vfs.Mkdir(path, user);
                        if (o.Flags.Contains("v")) ctx.Out($"mkdir: created directory '{t}'\n");
                    }
                }
                catch (FsError e)
                {
                    ctx.Err($"mkdir: cannot create directory '{t}': {e.Message}\n");
                    code = 1;
                }
            }
            return code;
        },
    };
}
