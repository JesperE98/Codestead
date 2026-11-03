namespace Codestead.Shell.Commands;

// The unset command: removes a variable or function.

public static partial class SystemCmd
{
    private static readonly CommandDef Unset = Simple("unset", "Tar bort en variabel eller funktion", ctx =>
    {
        bool functions = false;
        foreach (var k in ctx.Args)
        {
            if (k == "-f") functions = true;
            else if (k == "-v") functions = false;
            else if (functions) ctx.Sh.Functions.Remove(k);
            else ctx.Sh.Env.Remove(k);
        }
        return 0;
    }, """
NAMN
       unset - ta bort en variabel eller funktion

SYNOPSIS
       unset NAMN...
       unset -f FUNKTION...
""", true);
}
