namespace Codestead.Shell.Commands;

// The unalias command: removes an alias.

public static partial class SystemCmd
{
    private static readonly CommandDef Unalias = Simple("unalias", "Tar bort ett alias", ctx =>
    {
        if (ctx.Args.Count > 0 && ctx.Args[0] == "-a")
        {
            ctx.Sh.Aliases.Clear();
            return 0;
        }
        int code = 0;
        foreach (var a in ctx.Args)
        {
            if (ctx.Sh.Aliases.ContainsKey(a)) ctx.Sh.Aliases.Remove(a);
            else
            {
                ctx.Err($"bash: unalias: {a}: not found\n");
                code = 1;
            }
        }
        return code;
    }, null, true);
}
