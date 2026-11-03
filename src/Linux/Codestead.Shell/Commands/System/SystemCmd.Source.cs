namespace Codestead.Shell.Commands;

// The source and . commands.

public static partial class SystemCmd
{
    private static int RunSource(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var file = ctx.Args.Count > 0 ? ctx.Args[0] : null;
        var rest = ctx.Args.Skip(1).ToList();
        if (string.IsNullOrEmpty(file))
        {
            ctx.Err("bash: source: filename argument required\n");
            return 2;
        }
        string content;
        try
        {
            content = sh.Vfs.ReadFile(sh.Resolve(file), sh.CurrentUser());
        }
        catch (FsError e)
        {
            ctx.Err($"bash: {file}: {e.Message}\n");
            return 1;
        }
        return sh.RunScript(content, file, rest, ctx, true);
    }

    private static readonly CommandDef Source = Simple("source", "Kör ett skript i det aktuella skalet", RunSource, """
NAMN
       source - läs in och kör kommandon från en fil i det aktuella skalet

BESKRIVNING
       Till skillnad från att köra ett skript påverkar source ditt skal:
       alias, variabler och cd stannar kvar. Används ofta så här:
           source ~/.bashrc
       Punkt (.) är en kortare variant: . ~/.bashrc
""", true);

    private static readonly CommandDef Dot = Source.With(name: ".");
}
