namespace Codestead.Shell.Commands;

// The history command: shows previous commands.

public static partial class SystemCmd
{
    private static readonly CommandDef History = Simple("history", "Visar tidigare kommandon", ctx =>
    {
        if (ctx.Args.Count > 0 && ctx.Args[0] == "-c")
        {
            ctx.Sh.History.Clear();
            return 0;
        }
        var history = ctx.Sh.History;
        for (int i = 0; i < history.Count; i++) ctx.Out($"{Js.Num(i + 1).PadLeft(5)}  {history[i]}\n");
        return 0;
    }, """
NAMN
       history - visa kommandohistoriken

BESKRIVNING
       Använd pil upp/ned för att bläddra bland tidigare kommandon.

FLAGGOR
       -c    töm historiken
""", true);
}
