namespace Codestead.Shell.Commands;

// The snowfall command: lets it snow in the terminal (made-up AUR package).

public static partial class ReposCmd
{
    private static readonly CommandDef Snowfall = new()
    {
        Name = "snowfall",
        Summary = "Låter det snöa i terminalen (påhittat AUR-paket)",
        SummaryEn = "Lets it snow in the terminal (made-up AUR package)",
        Man = """
NAMN
       snowfall - låt det snöa i terminalen

BESKRIVNING
       Ett påhittat program från AUR. Tryck q för att avsluta.
""",
        ManEn = """
NAME
       snowfall - let it snow in the terminal

DESCRIPTION
       A made-up program from the AUR. Press q to quit.
""",
        Run = ctx =>
        {
            ctx.Out(
                "   *        .     *       .    *\n .     *       .      *         .\n     .    *        .      *  .\n" +
                "  *      .     *      .     *    \n    .  *     .     *     .    *\n__/\\___/\\__/\\____/\\___/\\___/\\___\n");
            ctx.Out(Dim(ctx.Sh, "repos.snowQuit"));
            return 0;
        },
    };
}
