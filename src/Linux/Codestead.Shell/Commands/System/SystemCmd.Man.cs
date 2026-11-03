namespace Codestead.Shell.Commands;

// The man command: shows the manual for a command.

public static partial class SystemCmd
{
    private static readonly Regex SectionRe = new(@"^[0-9]\z", RegexOptions.CultureInvariant);

    private static readonly CommandDef Man = Simple("man", "Visar manualen för ett kommando", ctx =>
    {
        var name = ctx.Args.FirstOrDefault(a => !SectionRe.IsMatch(a));
        if (string.IsNullOrEmpty(name))
        {
            ctx.Err("What manual page do you want?\nFor example, try 'man man'.\n");
            return 1;
        }
        var def = IndexCmd.Commands.GetValueOrDefault(name);
        bool available = def?.Builtin == true || ctx.Sh.ResolveCommand(name).Kind != "notfound";
        if (def is null || !available)
        {
            ctx.Err($"No manual entry for {name}\n");
            return 16;
        }
        ctx.Out(UtilCmd.FormatMan(name, ManEnCmd.ManFor(def, ctx.Sh)));
        if (ctx.IsTTY)
        {
            ctx.Out($"{UtilCmd.Color.Dim}({ctx.Sh.Msg("system.manScrollHint")}){UtilCmd.Color.Reset}\n");
        }
        return 0;
    }, """
NAMN
       man - visa manualsidor

SYNOPSIS
       man KOMMANDO

BESKRIVNING
       Nästan alla kommandon har en manualsida. Det är det första stället
       att leta på när du undrar vad en flagga gör. I simulatorn är
       manualerna förenklade och på svenska.
""");
}
