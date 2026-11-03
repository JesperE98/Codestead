namespace Codestead.Shell.Commands;

// The basename command: strips the directory part from a path.

public static partial class SystemCmd
{
    private static readonly CommandDef BasenameCmd = Simple("basename", "Tar bort katalogdelen från en sökväg", ctx =>
    {
        if (ctx.Args.Count == 0) return UtilCmd.BadOption(ctx, "missing operand");
        var b = VfsLib.Basename(ctx.Args[0]);
        var suffix = ctx.Args.Count > 1 ? ctx.Args[1] : "";
        if (suffix != "" && b.EndsWith(suffix, StringComparison.Ordinal) && b != suffix) b = b[..^suffix.Length];
        ctx.Out(b + "\n");
        return 0;
    });
}
