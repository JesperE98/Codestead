namespace Codestead.Shell.Commands;

// The whoami command: shows which user you are.

public static partial class SystemCmd
{
    private static readonly CommandDef Whoami = Simple("whoami", "Visar vilken användare du är", ctx =>
    {
        ctx.Out(ctx.Sh.CurrentUser().Name + "\n");
        return 0;
    }, """
NAMN
       whoami - skriv ut ditt användarnamn

BESKRIVNING
       Visar namnet på användaren som kör kommandot. Prova "sudo whoami"!
""");
}
