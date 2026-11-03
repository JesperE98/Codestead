namespace Codestead.Shell.Commands;

// The touch command: creates empty files or updates their timestamp.

public static partial class FsCmd
{
    private static readonly CommandDef Touch = new()
    {
        Name = "touch",
        Summary = "Skapar tomma filer eller uppdaterar tidsstämpeln",
        Man = """
NAMN
       touch - ändra tidsstämpel på filer, eller skapa tomma filer

SYNOPSIS
       touch FIL...

BESKRIVNING
       Om FIL inte finns skapas en tom fil. Om den finns uppdateras dess
       ändringstid till nu.
""",
        Run = ctx =>
        {
            if (ctx.Args.Count == 0)
            {
                ctx.Err("touch: missing file operand\nTry 'touch --help' for more information.\n");
                return 1;
            }
            var sh = ctx.Sh;
            var user = sh.CurrentUser();
            int code = 0;
            foreach (var t in ctx.Args)
            {
                var path = sh.Resolve(t);
                try
                {
                    var node = sh.Vfs.TryLookup(path, user);
                    if (node is not null)
                    {
                        if (!VfsLib.HasPerm(node, user, 'w') && node.Owner != user.Name && user.Uid != 0) throw new FsError("EACCES");
                        node.Mtime = Js.Now();
                    }
                    else
                    {
                        sh.Vfs.WriteFile(path, "", user);
                    }
                }
                catch (FsError e)
                {
                    ctx.Err($"touch: cannot touch '{t}': {e.Message}\n");
                    code = 1;
                }
            }
            return code;
        },
    };
}
