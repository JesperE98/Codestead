namespace Codestead.Shell.Commands;

// The more command: shows a file page by page (older variant of less).

public static partial class TextCmd
{
    private static readonly CommandDef More = CatLike(
        "more",
        "Visar en fil sida för sida (äldre variant av less)",
        """
NAMN
       more - visa en fil en sida i taget

BESKRIVNING
       Föregångaren till less. I simulatorn visas hela filen direkt.
""");
}
