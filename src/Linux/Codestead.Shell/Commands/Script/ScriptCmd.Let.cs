namespace Codestead.Shell.Commands;

// The let command: does integer arithmetic.

public static partial class ScriptCmd
{
    private static readonly CommandDef LetCmd = new()
    {
        Name = "let",
        Builtin = true,
        Summary = "Räknar med heltal",
        Man = """
NAMN
       let - räkna med heltal

SYNOPSIS
       let UTTRYCK...

EXEMPEL
       let "summa = 2 + 3"
       let i++

TIPS
       Det vanligaste sättet idag är (( i++ )) eller summa=$(( 2 + 3 )).
""",
        Run = ctx =>
        {
            long last = 0;
            foreach (var expr in ctx.Args)
            {
                try
                {
                    last = ArithLib.EvalArith(ctx.Sh.ExpandString(expr), new ArithVars { Get = n => ctx.Sh.GetVar(n), Set = (n, v) => ctx.Sh.SetVar(n, v) });
                }
                catch (ArithError e)
                {
                    ctx.Err($"bash: let: {expr}: {e.Message}\n");
                    return 1;
                }
            }
            return last != 0 ? 0 : 1;
        },
    };
}
