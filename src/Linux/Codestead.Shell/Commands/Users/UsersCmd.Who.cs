namespace Codestead.Shell.Commands;

// The who command: show who is logged in.

public static partial class UsersCmd
{
    private static string IsoDay(int offsetDays = 0)
    {
        var d = Js.LocalDate(Js.Now() - offsetDays * 86_400_000L);
        return $"{d.Year}-{d.Month:00}-{d.Day:00}";
    }

    private static readonly CommandDef Who = new()
    {
        Name = "who",
        Summary = "Visar vilka som är inloggade",
        SummaryEn = "Show who is logged in",
        Man = """
        NAMN
               who - visa vilka som är inloggade

        SYNOPSIS
               who [-b] [am i]

        BESKRIVNING
               Visar en rad per inloggning: användare, terminal och tid.
               "su" och "sudo" räknas inte som nya inloggningar.

        FLAGGOR
               -b    när datorn startades
        """,
        ManEn = """
        NAME
               who - show who is logged on

        SYNOPSIS
               who [-b] [am i]

        DESCRIPTION
               Prints one line per login: user, terminal and time.
               "su" and "sudo" do not count as new logins.

        OPTIONS
               -b    time of last system boot
        """,
        Run = ctx =>
        {
            if (ctx.Args.Contains("-b"))
            {
                ctx.Out($"         system boot  {IsoDay()} 08:11\n");
                return 0;
            }
            ctx.Out($"{LoginName(ctx.Sh).PadRight(8)} pts/0        {IsoDay()} {LoginTime}\n");
            return 0;
        },
    };
}
