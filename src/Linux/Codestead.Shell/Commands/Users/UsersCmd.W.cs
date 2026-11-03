namespace Codestead.Shell.Commands;

// The w command: show who is logged on and what they are doing.

public static partial class UsersCmd
{
    private static readonly CommandDef W = new()
    {
        Name = "w",
        Summary = "Visar vilka som är inloggade och vad de gör",
        SummaryEn = "Show who is logged on and what they are doing",
        Man = """
        NAMN
               w - visa vilka som är inloggade och vad de gör

        BESKRIVNING
               Första raden är samma som uptime. Sedan kommer en rad per
               inloggning med kommandot som körs just nu (WHAT).

        FLAGGOR
               -h    utan rubrikrader
        """,
        ManEn = """
        NAME
               w - show who is logged on and what they are doing

        DESCRIPTION
               The first line is the same as uptime. Then comes one line per login
               with the command currently running (WHAT).

        OPTIONS
               -h    no header lines
        """,
        Run = ctx =>
        {
            if (!ctx.Args.Contains("-h"))
            {
                var load = ProcsCmd.CurrentProcs(ctx).Sum(p => p.Cpu) / 100;
                var now = Js.LocalNow();
                ctx.Out($" {now.Hour:00}:{now.Minute:00}:{now.Second:00} up  2:14,  1 user,  load average: {Js.ToFixed(load, 2)}, {Js.ToFixed(load * 0.9, 2)}, {Js.ToFixed(load * 0.8, 2)}\n");
                ctx.Out("USER     TTY      FROM             LOGIN@   IDLE   JCPU   PCPU  WHAT\n");
            }
            ctx.Out($"{LoginName(ctx.Sh).PadRight(8)} pts/0    -                {LoginTime}    0.00s  0.05s  0.00s {string.Join(" ", new[] { "w" }.Concat(ctx.Args))}\n");
            return 0;
        },
    };
}
