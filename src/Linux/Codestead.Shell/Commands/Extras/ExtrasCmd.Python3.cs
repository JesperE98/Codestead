namespace Codestead.Shell.Commands;

// The python3 command: the Python programming language.

public static partial class ExtrasCmd
{
    private static readonly CommandDef Python3 = new()
    {
        Name = "python3",
        Summary = "Programspråket Python",
        Man = """
NAMN
       python3 - tolk för programspråket Python

BESKRIVNING
       I simulatorn stöds "python3 --version". Ett interaktivt Python-läge
       finns inte ännu.
""",
        Run = ctx =>
        {
            var v = ctx.Sh.Installed.Get("python")?.Split('-')[0] ?? "3.12.3";
            var first = ctx.Args.Count > 0 ? ctx.Args[0] : null;
            if (first == "--version" || first == "-V")
            {
                ctx.Out($"Python {v}\n");
                return 0;
            }
            Note(ctx, ctx.Sh.Msg("extras.pythonInteractive", ("version", v)));
            return 0;
        },
    };
}
