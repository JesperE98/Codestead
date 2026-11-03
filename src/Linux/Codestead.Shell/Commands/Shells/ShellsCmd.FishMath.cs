namespace Codestead.Shell.Commands;

// fish's builtin math (called through the fish translation).

public static partial class ShellsCmd
{
    /// <summary>String(Number(v.toFixed(digits))) – rounds to the given number of decimals.</summary>
    private static string RoundJs(double v, double scale)
    {
        // toFixed converts its argument with ToIntegerOrInfinity (NaN -> 0, fractions truncated).
        double d = double.IsNaN(scale) ? 0 : Math.Truncate(scale);
        if (d < 0 || d > 100) throw new ArgumentOutOfRangeException(nameof(scale), "toFixed() digits argument must be between 0 and 100");
        // Beyond 15 decimals toFixed(d) parses back to the same double.
        if (d > 15) return Js.Num(v);
        return Js.Num(Js.Number(Js.ToFixed(v, (int)d)));
    }

    private static readonly CommandDef FishMathCmd = FishBuiltin("math", ctx =>
    {
        var args = new List<string>(ctx.Args);
        double scale = 6;
        while (args.Count > 0 && (args[0].StartsWith("-s", StringComparison.Ordinal) || args[0].StartsWith("--scale", StringComparison.Ordinal)))
        {
            var a = args[0];
            args.RemoveAt(0);
            string? v;
            if (a.Contains('=')) v = a.Split('=')[1];
            else if (a.Length > 2 && !a.StartsWith("--", StringComparison.Ordinal)) v = a.Slice(2);
            else if (args.Count > 0)
            {
                v = args[0];
                args.RemoveAt(0);
            }
            else v = null;
            scale = Js.Number(v);
        }
        if (args.Count == 0)
        {
            ctx.Err("math: expected >= 1 arguments; got 0\n");
            return 2;
        }
        try
        {
            var v = FishMath(string.Join(" ", args));
            if (!double.IsFinite(v)) throw new MathError("Result is infinite");
            var s = scale == 0 ? Js.Num(Math.Truncate(v)) : RoundJs(v, scale);
            ctx.Out(s + "\n");
            return 0;
        }
        catch (MathError e)
        {
            ctx.Err($"math: Error: {e.Message}\n'{string.Join(" ", args)}'\n");
            return 1;
        }
    });
}
