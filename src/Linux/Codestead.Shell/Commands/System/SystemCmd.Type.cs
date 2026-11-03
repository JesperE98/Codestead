namespace Codestead.Shell.Commands;

// The type command: shows what a command name is (alias, builtin, file).

public static partial class SystemCmd
{
    private static readonly CommandDef TypeCmd = Simple("type", "Visar vad ett kommandonamn är (alias, inbyggt, fil)", ctx =>
    {
        var sh = ctx.Sh;
        int code = 0;
        foreach (var n in ctx.Args)
        {
            if (sh.Aliases.TryGetValue(n, out var alias)) ctx.Out($"{n} is aliased to `{alias}'\n");
            else if (sh.Functions.ContainsKey(n)) ctx.Out($"{n} is a function\n");
            else if (IndexCmd.Commands.GetValueOrDefault(n)?.Builtin == true) ctx.Out($"{n} is a shell builtin\n");
            else
            {
                var r = sh.ResolveCommand(n);
                if (r.Kind == "binary" || r.Kind == "script") ctx.Out($"{n} is {r.Path}\n");
                else
                {
                    ctx.Err($"bash: type: {n}: not found\n");
                    code = 1;
                }
            }
        }
        return code;
    }, """
NAMN
       type - visa hur ett kommandonamn tolkas

EXEMPEL
       type cd      cd is a shell builtin
       type ls      ls is /usr/bin/ls
""", true);
}
