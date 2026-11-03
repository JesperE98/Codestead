namespace Codestead.Shell.Commands;

// The return command: ends a function with an exit status.

public static partial class ScriptCmd
{
    /// <summary>ToInt32 in JavaScript (what the bitwise operators do with a number).</summary>
    private static int JsToInt32(double n)
    {
        if (double.IsNaN(n) || double.IsInfinity(n)) return 0;
        double t = Math.Truncate(n);
        double m = t % 4294967296.0;
        if (m < 0) m += 4294967296.0;
        return unchecked((int)(uint)m);
    }

    private static readonly CommandDef ReturnCmd = new()
    {
        Name = "return",
        Builtin = true,
        Summary = "Avslutar en funktion med en slutkod",
        Man = """
NAMN
       return - avsluta en funktion

SYNOPSIS
       return [SLUTKOD]

BESKRIVNING
       Avslutar funktionen. Slutkoden (0–255) blir funktionens $?.
       Utan argument används slutkoden från det senaste kommandot.
""",
        Run = ctx =>
        {
            if (ctx.Sh.FuncDepth == 0 && ctx.Sh.ScriptDepth == 0)
            {
                ctx.Err("bash: return: can only `return' from a function or sourced script\n");
                return 1;
            }
            throw new ReturnSignal(ctx.Args.Count > 0 ? JsToInt32(Js.Number(ctx.Args[0])) & 255 : ctx.Sh.LastExit);
        },
    };
}
