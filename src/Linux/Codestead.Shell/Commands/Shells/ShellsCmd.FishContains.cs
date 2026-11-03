namespace Codestead.Shell.Commands;

// fish's builtin contains (called through the fish translation).

public static partial class ShellsCmd
{
    private static readonly CommandDef FishContains = FishBuiltin("contains", ctx =>
    {
        var args = new List<string>(ctx.Args);
        bool printIndex = args.Count > 0 && (args[0] == "-i" || args[0] == "--index");
        if (printIndex) args.RemoveAt(0);
        if (args.Count == 0)
        {
            ctx.Err("contains: Key not specified\n");
            return 2;
        }
        var needle = args[0];
        var hay = args.Slice(1);
        int i = hay.IndexOf(needle);
        if (i >= 0 && printIndex) ctx.Out($"{i + 1}\n");
        return i >= 0 ? 0 : 1;
    });
}
