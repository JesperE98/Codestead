namespace Codestead.Shell.Commands;

// The last command: show the latest logins.

public static partial class UsersCmd
{
    private static readonly CommandDef Last = new()
    {
        Name = "last",
        Summary = "Visar de senaste inloggningarna",
        SummaryEn = "Show the latest logins",
        Man = """
        NAMN
               last - visa de senaste inloggningarna

        SYNOPSIS
               last [-n ANTAL] [ANVÄNDARE]

        BESKRIVNING
               Läser loggen /var/log/wtmp och visar inloggningar och omstarter,
               nyaste först.
        """,
        ManEn = """
        NAME
               last - show a listing of the latest logins

        SYNOPSIS
               last [-n NUMBER] [USER]

        DESCRIPTION
               Reads the log /var/log/wtmp and shows logins and reboots, newest
               first.
        """,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Values = "n" });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            var kernel = ctx.Sh.Distro.Kernel.Slice(0, 16).PadRight(16);
            string Day(int offset)
            {
                var d = Js.LocalDate(Js.Now() - offset * 86_400_000L);
                return $"{UtilCmd.Days[(int)d.DayOfWeek]} {Months[d.Month - 1]} {d.Day,2}";
            }
            var me = LoginName(ctx.Sh);
            var rows = new List<(string User, string Line)>
            {
                (me, $"{me.PadRight(8)} pts/0        :0               {Day(0)} {LoginTime}   still logged in"),
                ("reboot", $"reboot   system boot  {kernel} {Day(0)} 08:11   still running"),
                (me, $"{me.PadRight(8)} pts/0        :0               {Day(1)} 13:55 - 17:02  (03:07)"),
                ("reboot", $"reboot   system boot  {kernel} {Day(1)} 13:54 - 17:03  (03:08)"),
            }.Where(r => o.Operands.Count == 0 || o.Operands.Contains(r.User)).ToList();
            // rows.slice(0, n): NaN counts as 0, fractions are truncated.
            int n = rows.Count;
            if (o.Values.Get("n") is { } nv)
            {
                var num = Js.Number(nv);
                n = double.IsNaN(num) ? 0 : (int)Math.Clamp(Math.Truncate(num), -1e9, 1e9);
            }
            foreach (var r in Js.Slice(rows, 0, n)) ctx.Out(r.Line + "\n");
            ctx.Out($"\nwtmp begins {Day(10)} 10:10:12 {Js.LocalNow().Year}\n");
            return 0;
        },
    };
}
