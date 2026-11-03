namespace Codestead.Shell.Commands;

// The env and printenv commands.

public static partial class SystemCmd
{
    private static CommandDef EnvCmd(string name) => Simple(name, "Visar miljövariabler", ctx =>
    {
        var env = ctx.Sh.Env;
        if (name == "printenv" && ctx.Args.Count > 0)
        {
            int code = 0;
            foreach (var k in ctx.Args)
            {
                if (env.TryGetValue(k, out var v)) ctx.Out(v + "\n");
                else code = 1;
            }
            return code;
        }
        foreach (var (k, v) in SortedEntries(env)) ctx.Out($"{k}={v}\n");
        return 0;
    }, "NAMN\n" +
        $"       {name} - visa miljövariabler\n" +
        "\n" +
        "SYNOPSIS\n" +
        $"       {(name == "env" ? "env" : "printenv [VARIABEL]...")}\n" +
        "\n" +
        "BESKRIVNING\n" +
        "       Miljövariabler är namngivna värden som program kan läsa, t.ex.\n" +
        "       HOME (din hemkatalog), PATH (var kommandon letas efter) och USER.");
}
