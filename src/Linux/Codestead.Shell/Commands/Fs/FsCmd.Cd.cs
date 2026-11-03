namespace Codestead.Shell.Commands;

// The cd command: changes the current directory.

public static partial class FsCmd
{
    private static readonly CommandDef Cd = new()
    {
        Name = "cd",
        Builtin = true,
        Summary = "Byter aktuell katalog",
        Man = """
NAMN
       cd - byt katalog (change directory)

SYNOPSIS
       cd [KATALOG]

BESKRIVNING
       Gör KATALOG till den aktuella katalogen. Utan argument går du till
       din hemkatalog ($HOME).

       cd ..     gå upp en nivå
       cd ~      gå till hemkatalogen
       cd -      gå tillbaka till föregående katalog
       cd /      gå till rotkatalogen
""",
        Run = ctx =>
        {
            var sh = ctx.Sh;
            if (ctx.Args.Count > 1)
            {
                ctx.Err("bash: cd: too many arguments\n");
                return 1;
            }
            var target = ctx.Args.Count > 0 ? ctx.Args[0] : sh.Home;
            if (target == "-")
            {
                var oldpwd = sh.Env.Get("OLDPWD");
                if (string.IsNullOrEmpty(oldpwd))
                {
                    ctx.Err("bash: cd: OLDPWD not set\n");
                    return 1;
                }
                target = oldpwd;
                ctx.Out(target + "\n");
            }
            if (target == "") return 0;
            var path = sh.Resolve(target);
            var user = sh.CurrentUser();
            try
            {
                var node = sh.Vfs.Lookup(path, user);
                if (node.Type != "dir") throw new FsError("ENOTDIR");
                if (!VfsLib.HasPerm(node, user, 'x')) throw new FsError("EACCES");
            }
            catch (FsError e)
            {
                ctx.Err($"bash: cd: {target}: {e.Message}\n");
                return 1;
            }
            sh.Env["OLDPWD"] = sh.Cwd;
            sh.Cwd = path;
            sh.Env["PWD"] = path;
            return 0;
        },
    };
}
