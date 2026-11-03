namespace Codestead.Shell.Commands;

// The chage command: show or change password and account expiry.

public static partial class UsersCmd
{
    private static string DayDate(double days)
    {
        var ms = days * 86_400_000;
        // An invalid date prints like JS: "undefined NaN, NaN".
        if (!double.IsFinite(ms) || Math.Abs(ms) > 8.64e15) return "undefined NaN, NaN";
        var d = DateTimeOffset.FromUnixTimeMilliseconds((long)ms).UtcDateTime;
        return $"{Months[d.Month - 1]} {d.Day:00}, {d.Year}";
    }

    private static readonly Regex DigitsRe = new(@"^[0-9]+\z", RegexOptions.CultureInvariant);

    private static readonly CommandDef Chage = new()
    {
        Name = "chage",
        Summary = "Visar eller ändrar när lösenord och konton går ut",
        SummaryEn = "Show or change password and account expiry",
        Man = """
        NAMN
               chage - ändra när lösenord och konton går ut

        SYNOPSIS
               chage -l ANVÄNDARE
               chage [FLAGGOR] ANVÄNDARE

        FLAGGOR
               -l          visa uppgifterna (fälten i /etc/shadow, i klartext)
               -M DAGAR    lösenordet måste bytas efter så här många dagar
               -m DAGAR    minsta antal dagar mellan byten
               -W DAGAR    varna så här många dagar innan lösenordet går ut
               -E DATUM    kontot slutar gälla (ÅÅÅÅ-MM-DD, -1 = aldrig)
               -d 0        tvinga fram ett lösenordsbyte vid nästa inloggning

        EXEMPEL
               chage -l $USER
               sudo chage -M 90 kim
               sudo chage -E 2026-12-31 vikarie
        """,
        ManEn = """
        NAME
               chage - change user password expiry information

        SYNOPSIS
               chage -l USER
               chage [OPTIONS] USER

        OPTIONS
               -l          list the information (the fields of /etc/shadow, in plain text)
               -M DAYS     the password must be changed after this many days
               -m DAYS     minimum number of days between changes
               -W DAYS     warn this many days before the password expires
               -E DATE     the account expires (YYYY-MM-DD, -1 = never)
               -d 0        force a password change at the next login

        EXAMPLES
               chage -l $USER
               sudo chage -M 90 kim
               sudo chage -E 2026-12-31 substitute
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "l",
                Values = "MmWEdI",
                Long = new() { ["list"] = "l", ["maxdays"] = "M", ["mindays"] = "m", ["warndays"] = "W", ["expiredate"] = "E", ["lastday"] = "d", ["inactive"] = "I" },
            });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error, 2);
            if (o.Operands.Count != 1)
            {
                ctx.Err("Usage: chage [options] LOGIN\n\nTry 'man chage' for the options.\n");
                return 2;
            }
            var name = o.Operands[0];
            var me = sh.CurrentUser();
            var list = o.Flags.Contains("l");
            if (me.Uid != 0 && !(list && name == me.Name))
            {
                ctx.Err("chage: Permission denied.\n");
                return 1;
            }
            if (UsersLib.FindUser(sh, name) is null)
            {
                ctx.Err($"chage: user '{name}' does not exist in /etc/passwd\n");
                return 1;
            }
            var db = UsersLib.LoadDb(sh);
            var s = ShadowFor(db, name);
            if (list)
            {
                double? last = s.LastChange == "" ? null : Js.Number(s.LastChange);
                double max = s.Max == "" ? 99999 : Js.Number(s.Max);
                double inactive = s.Inactive == "" ? -1 : Js.Number(s.Inactive);
                var expires = last == 0 ? "password must be changed" : last is null || max >= 99999 ? "never" : DayDate(last.Value + max);
                // `last && ...`: truthy means not null, not 0 and not NaN.
                bool lastTruthy = last is double lv && lv != 0 && !double.IsNaN(lv);
                var rows = new (string K, string V)[]
                {
                    ("Last password change", last == 0 ? "password must be changed" : last is null ? "never" : DayDate(last.Value)),
                    ("Password expires", expires),
                    ("Password inactive", lastTruthy && max < 99999 && inactive >= 0 ? DayDate(last!.Value + max + inactive) : "never"),
                    ("Account expires", s.Expire == "" ? "never" : DayDate(Js.Number(s.Expire))),
                    ("Minimum number of days between password change", s.Min != "" ? s.Min : "0"),
                    ("Maximum number of days between password change", s.Max != "" ? s.Max : "99999"),
                    ("Number of days of warning before password expires", s.Warn != "" ? s.Warn : "7"),
                };
                foreach (var (k, v) in rows) ctx.Out($"{k.PadRight(56)}: {v}\n");
                return 0;
            }
            void Num(string? v, Action<string> set)
            {
                if (v is not null) set(v == "-1" ? "" : v);
            }
            Num(o.Values.Get("M"), v => s.Max = v);
            Num(o.Values.Get("m"), v => s.Min = v);
            Num(o.Values.Get("W"), v => s.Warn = v);
            Num(o.Values.Get("I"), v => s.Inactive = v);
            if (o.Values.Get("d") is { } dv) s.LastChange = DigitsRe.IsMatch(dv) ? dv : Js.Num(DaysOf(dv));
            if (o.Values.Get("E") is { } ev)
            {
                var days = DaysOf(ev);
                if (ev == "-1") s.Expire = "";
                else if (double.IsFinite(days)) s.Expire = Js.Num(days);
                else
                {
                    ctx.Err($"chage: invalid date '{ev}'\n");
                    return 2;
                }
            }
            UsersLib.SaveDb(sh, db);
            return 0;
        },
    };
}
