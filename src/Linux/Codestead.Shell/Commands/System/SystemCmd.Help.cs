namespace Codestead.Shell.Commands;

// The help command: lists all available commands.

public static partial class SystemCmd
{
    private static readonly Regex LowercaseStartRe = new("^[a-z]", RegexOptions.CultureInvariant);

    private static readonly CommandDef Help = Simple("help", "Listar alla kommandon som finns", ctx =>
    {
        var sh = ctx.Sh;
        var names = sh.AvailableCommands().Where(n => LowercaseStartRe.IsMatch(n) && IndexCmd.Commands.GetValueOrDefault(n)?.Name == n).ToList();
        ctx.Out(sh.Msg("system.helpHeader", ("distro", sh.Distro.Name)));
        ctx.Out(sh.Msg("system.helpManHint"));
        foreach (var n in names) ctx.Out($"  {n.PadRight(11)} {ManEnCmd.SummaryFor(IndexCmd.Commands[n], sh)}\n");
        ctx.Out($"\n{UtilCmd.Color.Dim}{sh.Msg("system.helpMissingProgram", ("pm", sh.Distro.PackageManager))}{UtilCmd.Color.Reset}\n");
        return 0;
    }, """
NAMN
       help - lista kommandon i simulatorn
""", true);
}
