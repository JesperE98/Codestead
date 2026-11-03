namespace Codestead.Shell.Commands;

// The set command: shows variables or changes shell settings.

public static partial class ScriptCmd
{
    private static readonly CommandDef Set = new()
    {
        Name = "set",
        Builtin = true,
        Summary = "Visar variabler eller ändrar skalets inställningar",
        Man = """
NAMN
       set - visa variabler eller ändra inställningar i skalet

SYNOPSIS
       set
       set -- ARGUMENT...
       set -e / -u / -x / -o pipefail

BESKRIVNING
       Utan argument listas alla variabler. "set -- a b c" sätter $1, $2, $3.
       Flaggorna -e (avbryt vid fel), -u och -x är vanliga överst i skript.
       I simulatorn godtas de men har ingen effekt ännu.
""",
        Run = ctx =>
        {
            var sh = ctx.Sh;
            if (ctx.Args.Count == 0)
            {
                foreach (var (k, v) in SystemCmd.SortedEntries(sh.Env)) ctx.Out($"{k}={(TextCmd.HasJsWhitespace(v) ? $"'{v}'" : v)}\n");
                return 0;
            }
            int dd = ctx.Args.IndexOf("--");
            if (dd >= 0) sh.SetArgs(ctx.Args.Skip(dd + 1).ToList());
            return 0;
        },
    };
}
