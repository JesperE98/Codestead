namespace Codestead.Shell.Commands;

// The top command: shows the processes using the most resources.

public static partial class ProcsCmd
{
    private static readonly CommandDef Top = new()
    {
        Name = "top",
        Summary = "Visar processerna som använder mest resurser",
        Man = """
            NAMN
                   top - visa processer och resursanvändning, uppdateras hela tiden

            BESKRIVNING
                   Överst visas belastning (load average), antal processer, CPU och
                   minne. Sedan alla processer, sorterade efter CPU-användning.
                   I en riktig terminal uppdateras top varje sekund: tryck M för att
                   sortera på minne, k för att döda en process och q för att avsluta.
                   I simulatorn visas en ögonblicksbild.

            FLAGGOR
                   -b -n 1   skriv ut en gång (bra i skript)
            """,
        Run = ctx =>
        {
            TopScreen(ctx, "top");
            if (ctx.IsTTY) ctx.Out($"{UtilCmd.Color.Dim}({ctx.Sh.Msg("procs.topSnapshot")}){UtilCmd.Color.Reset}\n");
            return 0;
        },
    };
}
