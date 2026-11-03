namespace Codestead.Shell.Commands;

// The shift command: shifts the script's arguments one step ($2 becomes $1).

public static partial class ScriptCmd
{
    private static readonly CommandDef Shift = new()
    {
        Name = "shift",
        Builtin = true,
        Summary = "Flyttar skriptets argument ett steg ($2 blir $1)",
        Man = """
NAMN
       shift - flytta positionsparametrarna

SYNOPSIS
       shift [N]

BESKRIVNING
       $2 blir $1, $3 blir $2 och så vidare. Med N flyttas de N steg.
""",
        Run = ctx =>
        {
            double n = Js.Number(ctx.Args.Count > 0 ? ctx.Args[0] : "1");
            var args = ctx.Sh.Args;
            if (n > args.Count) return 1;
            int start = double.IsNaN(n) ? 0 : n <= int.MinValue ? int.MinValue : (int)Math.Truncate(n);
            ctx.Sh.SetArgs(Js.Slice(args, start));
            return 0;
        },
    };
}
