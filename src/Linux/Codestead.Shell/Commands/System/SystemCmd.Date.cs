namespace Codestead.Shell.Commands;

// The date command: shows the date and time.

public static partial class SystemCmd
{
    private static readonly CommandDef Date = Simple("date", "Visar datum och tid", ctx =>
    {
        ctx.Out(UtilCmd.LongDate() + "\n");
        return 0;
    }, """
NAMN
       date - visa datum och tid
""");
}
