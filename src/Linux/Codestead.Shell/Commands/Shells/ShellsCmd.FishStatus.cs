namespace Codestead.Shell.Commands;

// fish's builtin status (called through the fish translation).

public static partial class ShellsCmd
{
    private static readonly CommandDef FishStatus = FishBuiltin("status", ctx =>
    {
        var sh = ctx.Sh;
        switch (ctx.Args.Count > 0 ? ctx.Args[0] : null)
        {
            case null:
                ctx.Out("This is not a login shell\nJob control: Only on interactive jobs\n");
                return 0;
            case "is-interactive":
                return sh.Interactive ? 0 : 1;
            case "is-login":
                return 1;
            case "current-command":
                ctx.Out("status\n");
                return 0;
            case "fish-path":
                ctx.Out("/usr/bin/fish\n");
                return 0;
            default:
                ctx.Err($"status: {ctx.Args[0]}: invalid subcommand\n");
                return 2;
        }
    });
}
