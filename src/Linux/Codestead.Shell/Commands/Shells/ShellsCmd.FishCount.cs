namespace Codestead.Shell.Commands;

// fish's builtin count (called through the fish translation).

public static partial class ShellsCmd
{
    private static readonly CommandDef FishCount = FishBuiltin("count", ctx =>
    {
        ctx.Out($"{ctx.Args.Count}\n");
        return ctx.Args.Count > 0 ? 0 : 1;
    });
}
