namespace Codestead.Shell.Commands;

// The sleep command: waits for a while.

public static partial class SystemCmd
{
    private static readonly CommandDef Sleep = Simple("sleep", "Väntar en stund", _ => 0, """
NAMN
       sleep - vänta ett antal sekunder

BESKRIVNING
       I simulatorn returnerar sleep direkt.
""");
}
