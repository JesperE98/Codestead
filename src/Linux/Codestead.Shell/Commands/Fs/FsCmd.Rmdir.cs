namespace Codestead.Shell.Commands;

// The rmdir command: removes empty directories.

public static partial class FsCmd
{
    private static readonly CommandDef Rmdir = new()
    {
        Name = "rmdir",
        Summary = "Tar bort tomma kataloger",
        Man = """
NAMN
       rmdir - ta bort tomma kataloger

SYNOPSIS
       rmdir KATALOG...

BESKRIVNING
       Tar bort katalogen bara om den är tom. Använd rm -r för att ta bort
       en katalog med innehåll.
""",
        Run = ctx =>
        {
            if (ctx.Args.Count == 0) return UtilCmd.BadOption(ctx, "missing operand");
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            int code = 0;
            foreach (var t in ctx.Args)
            {
                try
                {
                    var path = sh.Resolve(t);
                    var node = sh.Vfs.Lookup(path, user, follow: false);
                    if (node.Type != "dir") throw new FsError("ENOTDIR");
                    if (node.Children!.Count > 0) throw new FsError("ENOTEMPTY");
                    sh.Vfs.Remove(path, user);
                }
                catch (FsError e)
                {
                    ctx.Err($"rmdir: failed to remove '{t}': {e.Message}\n");
                    code = 1;
                }
            }
            return code;
        },
    };
}
