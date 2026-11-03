namespace Codestead.Shell.Commands;

// The dirname command: strips the file name from a path.

public static partial class SystemCmd
{
    private static readonly CommandDef DirnameCmd = Simple("dirname", "Tar bort filnamnet från en sökväg", ctx =>
    {
        if (ctx.Args.Count == 0) return UtilCmd.BadOption(ctx, "missing operand");
        var p = ctx.Args[0];
        string result;
        if (!p.Contains('/')) result = ".";
        else if (p.StartsWith('/')) result = VfsLib.Dirname(p);
        else
        {
            var d = VfsLib.Dirname("/" + p).Slice(1);
            result = d != "" ? d : ".";
        }
        ctx.Out(result + "\n");
        return 0;
    });
}
