namespace Codestead.Shell.Commands;

// fish's builtin index (called through the fish translation).

public static partial class ShellsCmd
{
    private static readonly CommandDef FishIndex = FishBuiltin("index", ctx =>
    {
        var n = ctx.Args.Count > 0 ? ctx.Args[0] : null;
        var list = ctx.Args.Slice(1);
        double idx = Js.Number(n);
        double pos = idx > 0 ? idx - 1 : list.Count + idx;
        // list[pos] is undefined unless pos is a whole index inside the list.
        if (double.IsNaN(pos) || pos != Math.Floor(pos) || pos < 0 || pos >= list.Count) return 1;
        ctx.Out(list[(int)pos] + "\n");
        return 0;
    });
}
