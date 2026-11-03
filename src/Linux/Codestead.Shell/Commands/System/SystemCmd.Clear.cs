namespace Codestead.Shell.Commands;

// The clear command: clears the screen.

public static partial class SystemCmd
{
    private static readonly CommandDef Clear = Simple("clear", "Rensar skärmen", ctx =>
    {
        ctx.Sh.RequestClear();
        return 0;
    }, """
NAMN
       clear - rensa terminalfönstret

TIPS
       Kortkommandot Ctrl+L gör samma sak.
""");
}
