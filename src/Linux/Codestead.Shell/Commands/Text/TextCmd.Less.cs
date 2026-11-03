namespace Codestead.Shell.Commands;

// The less command: pages through a file (one screen at a time).

public static partial class TextCmd
{
    private static readonly CommandDef Less = CatLike(
        "less",
        "Bläddrar i en fil (sida för sida)",
        """
NAMN
       less - visa en fil en sida i taget

BESKRIVNING
       I en riktig terminal bläddrar du med piltangenterna, mellanslag och
       b, söker med /ord och avslutar med q. I simulatorn visas hela filen
       direkt.
""");
}
