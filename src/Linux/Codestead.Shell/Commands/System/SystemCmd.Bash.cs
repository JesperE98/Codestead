namespace Codestead.Shell.Commands;

// The bash and sh commands.

public static partial class SystemCmd
{
    private static int RunBash(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var first = ctx.Args.Count > 0 ? ctx.Args[0] : null;
        var rest = ctx.Args.Skip(1).ToList();
        if (first == "--version")
        {
            ctx.Out("GNU bash, version 5.2.21(1)-release (x86_64-pc-linux-gnu)\n");
            return 0;
        }
        if (first == "-c") return sh.RunScript(rest.Count > 0 ? rest[0] : "", "bash", rest.Skip(1).ToList(), ctx, false, "bash");
        if (string.IsNullOrEmpty(first))
        {
            var started = ShellsCmd.StartBash(ctx);
            if (started is not null) return started.Value;
            ctx.Out($"{UtilCmd.Color.Dim}{sh.Msg("system.alreadyBash")}{UtilCmd.Color.Reset}\n");
            return 0;
        }
        string content;
        try
        {
            content = sh.Vfs.ReadFile(sh.Resolve(first), sh.CurrentUser());
        }
        catch (FsError e)
        {
            ctx.Err($"bash: {first}: {e.Message}\n");
            return 127;
        }
        return sh.RunScript(content, first, rest, ctx, false, "bash");
    }

    private static readonly CommandDef Bash = Simple("bash", "Kör ett skript i ett nytt bash-skal", RunBash, """
NAMN
       bash - GNU Bourne-Again SHell

SYNOPSIS
       bash SKRIPT [ARGUMENT]...
       bash -c 'KOMMANDO'

BESKRIVNING
       bash är skalet du skriver kommandon i. "bash skript.sh" kör ett
       skript utan att det behöver vara körbart (chmod +x).
""");
}
