namespace Codestead.Shell.Commands;

// The passwd command: change a password (your own, or other users' as root).

public static partial class UsersCmd
{
    /// <summary>new Date(days * 86_400_000).toISOString().slice(0, 10)</summary>
    private static string IsoDate(double days)
    {
        var ms = days * 86_400_000;
        if (!double.IsFinite(ms)) throw new InvalidOperationException("Invalid time value");
        return DateTimeOffset.FromUnixTimeMilliseconds((long)ms).UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    private static readonly CommandDef Passwd = new()
    {
        Name = "passwd",
        Summary = "Byter lösenord (ditt eget, eller andras som root)",
        SummaryEn = "Change a password (your own, or other users' as root)",
        Man = """
        NAMN
               passwd - byt lösenord

        SYNOPSIS
               passwd [FLAGGOR] [ANVÄNDARE]

        BESKRIVNING
               Utan ANVÄNDARE byter du ditt eget lösenord. Bara root får byta
               lösenord åt andra: sudo passwd kim. Lösenordet skrivs två gånger
               och syns inte när du skriver. Det sparas som en hash i /etc/shadow.

        FLAGGOR
               -l    lås lösenordet (kontot går inte att logga in på med lösenord)
               -u    lås upp
               -d    ta bort lösenordet
               -e    tvinga användaren att byta lösenord vid nästa inloggning
               -S    visa status: P (har lösenord), L (låst), NP (inget lösenord)

        EXEMPEL
               passwd
               sudo passwd kim
               sudo passwd -S kim
        """,
        ManEn = """
        NAME
               passwd - change a password

        SYNOPSIS
               passwd [OPTIONS] [USER]

        DESCRIPTION
               Without USER you change your own password. Only root may change
               other users' passwords: sudo passwd kim. The password is typed
               twice and is not shown as you type. It is stored as a hash in
               /etc/shadow.

        OPTIONS
               -l    lock the password (no password logins for the account)
               -u    unlock
               -d    delete the password
               -e    force the user to change password at the next login
               -S    show status: P (has a password), L (locked), NP (no password)

        EXAMPLES
               passwd
               sudo passwd kim
               sudo passwd -S kim
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var redhat = sh.Distro.Family == "redhat";
            var longs = new Dictionary<string, string> { ["lock"] = "l", ["unlock"] = "u", ["delete"] = "d", ["expire"] = "e", ["status"] = "S" };
            if (redhat) longs["stdin"] = "i";
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "luedS", Long = longs });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error, 2);
            var me = sh.CurrentUser();
            var name = o.Operands.Count > 0 ? o.Operands[0] : me.Name;
            if (name != me.Name && me.Uid != 0)
            {
                ctx.Err(redhat ? "passwd: Only root can specify a user name.\n" : $"passwd: You may not view or modify password information for {name}.\n");
                return 1;
            }
            if (UsersLib.FindUser(sh, name) is null)
            {
                ctx.Err(redhat ? $"passwd: Unknown user name '{name}'.\n" : $"passwd: user '{name}' does not exist\n");
                return 1;
            }
            var action = new[] { "l", "u", "d", "e", "S" }.FirstOrDefault(f => o.Flags.Contains(f));
            if (action is not null)
            {
                if (me.Uid != 0 && action != "S")
                {
                    ctx.Err("passwd: Permission denied.\n");
                    return 1;
                }
                var db = UsersLib.LoadDb(sh);
                var s = ShadowFor(db, name);
                if (action == "S")
                {
                    var date = s.LastChange != "" ? IsoDate(Js.Number(s.LastChange)) : "";
                    string Or(string v, string def) => v != "" ? v : def;
                    ctx.Out($"{name} {UsersLib.PasswordStatus(s.Hash)} {date} {Or(s.Min, "0")} {Or(s.Max, "99999")} {Or(s.Warn, "7")} {Or(s.Inactive, "-1")}\n");
                    return 0;
                }
                var verbs = new Dictionary<string, string> { ["l"] = "Locking password", ["u"] = "Unlocking password", ["d"] = "Removing password", ["e"] = "Expiring password" };
                if (action == "l" && !s.Hash.StartsWith('!')) s.Hash = "!" + s.Hash;
                if (action == "u")
                {
                    var unlocked = StripBang(s.Hash);
                    if (unlocked == "" || unlocked == "!")
                    {
                        ctx.Err("passwd: unlocking the password would result in a passwordless account.\nYou should set a password with usermod -p to unlock the password of this account.\n");
                        return 3;
                    }
                    s.Hash = unlocked;
                }
                if (action == "d") s.Hash = "";
                if (action == "e") s.LastChange = "0";
                UsersLib.SaveDb(sh, db);
                ctx.Out(redhat ? $"{verbs[action]} for user {name}.\npasswd: Success\n" : "passwd: password changed.\n");
                return 0;
            }
            if (o.Flags.Contains("i") || (ctx.Stdin is not null && !sh.CanAskInteractively()))
            {
                // Read the password from stdin (Fedora's passwd --stdin, or in scripts).
                var pw = (ctx.Stdin ?? "").Split('\n')[0];
                if (pw == "")
                {
                    ctx.Err("passwd: Authentication token manipulation error\n");
                    return 10;
                }
                SetPassword(sh, name, pw);
                ctx.Out(redhat ? $"Changing password for user {name}.\npasswd: all authentication tokens updated successfully.\n" : "passwd: password updated successfully\n");
                return 0;
            }
            if (!sh.CanAskInteractively())
            {
                ctx.Err("passwd: Authentication token manipulation error\npasswd: password unchanged\n");
                return 10;
            }
            if (redhat) ctx.Out($"Changing password for user {name}.\n");
            else if (me.Uid != 0) ctx.Out($"Changing password for {name}.\n");
            if (me.Uid != 0)
            {
                ctx.Out(Dim(sh, "users.skipsCurrentPassword"));
            }
            if (ctx.IsTTY && !sh.Flags.GetValue("passwdNoticeShown").GetValueOrDefault())
            {
                sh.Flags["passwdNoticeShown"] = true;
                ctx.Out(Dim(sh, "users.passwordHidden"));
            }
            AskNewPassword(sh, name, (ok, _) => ok ? 0 : 10);
            return 0;
        },
    };
}
