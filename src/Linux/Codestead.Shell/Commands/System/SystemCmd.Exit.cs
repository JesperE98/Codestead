namespace Codestead.Shell.Commands;

// The exit and logout commands.

public static partial class SystemCmd
{
    /// <summary>A JS number passed on as an integer exit code (NaN becomes 0).</summary>
    private static int ToInt(double n) =>
        double.IsNaN(n) ? 0 : n >= int.MaxValue ? int.MaxValue : n <= int.MinValue ? int.MinValue : (int)Math.Truncate(n);

    private static int RunExit(CmdCtx ctx)
    {
        double n = Js.Number(ctx.Args.Count > 0 ? ctx.Args[0] : "0");
        return ctx.Sh.Exit(double.IsNaN(n) ? 0 : ToInt(n), ctx);
    }

    private static readonly CommandDef ExitCmd = Simple("exit", "Avslutar skalet (eller lämnar root-skalet)", RunExit, """
NAMN
       exit - avsluta skalet

BESKRIVNING
       Om du blivit root med "sudo -i" tar exit dig tillbaka till din
       vanliga användare.
""", true);

    private static readonly CommandDef Logout = ExitCmd.With(name: "logout", summary: "Loggar ut från ett inloggningsskal");
}
