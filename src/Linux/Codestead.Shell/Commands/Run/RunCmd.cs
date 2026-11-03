namespace Codestead.Shell.Commands;

// Commands that run other commands: xargs, nohup and watch.

public static partial class RunCmd
{
    /// <summary>
    /// Runs a command the way a program started by another program runs: from $PATH (aliases and shell
    /// functions do not exist there). Returns 127 if it is not found, like execvp.
    /// </summary>
    private static int Exec(CmdCtx ctx, string who, List<string> argv, IO io)
    {
        var sh = ctx.Sh;
        var name = argv[0];
        if (!name.Contains('/') && IndexCmd.Commands.TryGetValue(name, out var def) && def.Builtin && sh.ResolveCommand(name).Kind == "notfound")
        {
            io.Err($"{who}: {name}: No such file or directory\n");
            return 127;
        }
        if (sh.ResolveCommand(name).Kind == "notfound")
        {
            io.Err($"{who}: {name}: No such file or directory\n");
            if (!name.Contains('/')) sh.NotFoundHint(name, io);
            return 127;
        }
        return sh.Invoke(argv, io, viaSudo: true);
    }

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new() { Xargs, Nohup, Watch };
}
