namespace Codestead.Shell.Commands;

// The vim, vi and nano commands.

public static partial class ExtrasCmd
{
    private static CommandDef Editor(string name, string summary, string man) => new()
    {
        Name = name,
        Summary = summary,
        Man = man,
        Run = ctx =>
        {
            Note(ctx, ctx.Sh.Msg("extras.editorUnsupported", ("editor", name)));
            return 0;
        },
    };
}
