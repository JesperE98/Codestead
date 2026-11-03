namespace Codestead.Shell.Commands;

// The break and continue commands.

public static partial class ScriptCmd
{
    private static CommandDef LoopControl(string kind) => new()
    {
        Name = kind,
        Builtin = true,
        Summary = kind == "break" ? "Avbryter en loop" : "Hoppar till nästa varv i en loop",
        Man = "NAMN\n" +
            $"       {kind} - {(kind == "break" ? "avbryt en for-, while- eller until-loop" : "hoppa direkt till nästa varv i en loop")}\n" +
            "\n" +
            "SYNOPSIS\n" +
            $"       {kind} [N]\n" +
            "\n" +
            "BESKRIVNING\n" +
            "       Med N påverkas N nivåer av nästlade loopar.",
        Run = ctx =>
        {
            if (ctx.Sh.LoopDepth == 0)
            {
                ctx.Err($"bash: {kind}: only meaningful in a `for', `while', or `until' loop\n");
                return 0;
            }
            double v = Js.Number(ctx.Args.Count > 0 ? ctx.Args[0] : "1");
            double n = Math.Max(1, double.IsNaN(v) || v == 0 ? 1 : v);
            throw new LoopSignal(kind, (int)Math.Min(n, ctx.Sh.LoopDepth));
        },
    };
}
