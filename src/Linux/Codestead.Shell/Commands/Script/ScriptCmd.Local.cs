namespace Codestead.Shell.Commands;

// The local command: creates a variable that only exists inside the function.

public static partial class ScriptCmd
{
    private static readonly CommandDef Local = new()
    {
        Name = "local",
        Builtin = true,
        Summary = "Skapar en variabel som bara finns i funktionen",
        Man = """
NAMN
       local - skapa en lokal variabel i en funktion

SYNOPSIS
       local NAMN[=VÄRDE]...

BESKRIVNING
       En lokal variabel försvinner när funktionen är klar och påverkar
       inte en variabel med samma namn utanför funktionen.
""",
        Run = ctx =>
        {
            foreach (var a in ctx.Args)
            {
                int eq = a.IndexOf('=');
                var name = eq >= 0 ? a[..eq] : a;
                if (!ctx.Sh.DeclareLocal(name, eq >= 0 ? a[(eq + 1)..] : null))
                {
                    ctx.Err("bash: local: can only be used in a function\n");
                    return 1;
                }
            }
            return 0;
        },
    };
}
