namespace Codestead.Shell.Commands;

// The usermod command: modify a user: groups, shell, locking (needs root).

public static partial class UsersCmd
{
    private static readonly CommandDef Usermod = new()
    {
        Name = "usermod",
        Summary = "Ändrar en användare: grupper, skal, låsning (kräver root)",
        SummaryEn = "Modify a user: groups, shell, locking (needs root)",
        Man = """
        NAMN
               usermod - ändra ett användarkonto

        SYNOPSIS
               usermod [FLAGGOR] ANVÄNDARE

        FLAGGOR
               -aG GRUPPER  lägg till användaren i grupperna (append)
               -G GRUPPER   sätt EXAKT vilka extra grupper användaren har – utan -a
                            försvinner användaren ur alla andra grupper!
               -g GRUPP     byt primär grupp
               -s SKAL      byt inloggningsskal
               -c TEXT      byt kommentar (fullständigt namn)
               -d KATALOG   byt hemkatalog (-m flyttar också innehållet)
               -L           lås kontot (sätter ! framför lösenordshashen)
               -U           lås upp kontot
               -e DATUM     kontot slutar gälla DATUM (ÅÅÅÅ-MM-DD)

        BESKRIVNING
               Ändringar i gruppmedlemskap gäller först nästa gång användaren
               loggar in.

        EXEMPEL
               sudo usermod -aG sudo kim       (Debian/Ubuntu)
               sudo usermod -aG wheel kim      (Arch/Fedora)
               sudo usermod -s /bin/bash kim
               sudo usermod -L kim
        """,
        ManEn = """
        NAME
               usermod - modify a user account

        SYNOPSIS
               usermod [OPTIONS] USER

        OPTIONS
               -aG GROUPS   add the user to the groups (append)
               -G GROUPS    set EXACTLY which supplementary groups the user has –
                            without -a the user is removed from all other groups!
               -g GROUP     change the primary group
               -s SHELL     change the login shell
               -c TEXT      change the comment (full name)
               -d DIR       change the home directory (-m also moves the contents)
               -L           lock the account (puts ! in front of the password hash)
               -U           unlock the account
               -e DATE      the account expires on DATE (YYYY-MM-DD)

        DESCRIPTION
               Group membership changes take effect the next time the user logs in.

        EXAMPLES
               sudo usermod -aG sudo kim       (Debian/Ubuntu)
               sudo usermod -aG wheel kim      (Arch/Fedora)
               sudo usermod -s /bin/bash kim
               sudo usermod -L kim
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "aLUm",
                Values = "Ggscde",
                Long = new()
                {
                    ["append"] = "a", ["lock"] = "L", ["unlock"] = "U", ["move-home"] = "m", ["groups"] = "G", ["gid"] = "g", ["shell"] = "s",
                    ["comment"] = "c", ["home"] = "d", ["expiredate"] = "e",
                },
            });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error, 2);
            var changes = new[] { "L", "U" }.Any(f => o.Flags.Contains(f)) || o.Values.Count > 0;
            if (o.Operands.Count != 1 || !changes)
            {
                ctx.Err("Usage: usermod [options] LOGIN\n\nTry 'man usermod' for the options.\n");
                return 2;
            }
            if (o.Flags.Contains("a") && o.Values.Get("G") is null)
            {
                ctx.Err("usermod: -a flag is ONLY allowed with the -G flag\nTry 'man usermod' for the options.\n");
                return 2;
            }
            var name = o.Operands[0];
            if (!IsRoot(sh)) return Denied(ctx);
            var db = UsersLib.LoadDb(sh);
            var entry = db.Passwd.Find(e => e.Name == name);
            if (entry is null)
            {
                ctx.Err($"usermod: user '{name}' does not exist\n");
                return 6;
            }
            if (o.Values.Get("G") is { } gList)
            {
                var list = SplitList(gList);
                if (!CheckGroups(ctx, sh, "usermod", list)) return 6;
                foreach (var g in db.Group)
                {
                    var wanted = list.Contains(g.Name);
                    if (wanted && !g.Members.Contains(name)) g.Members.Add(name);
                    if (!wanted && !o.Flags.Contains("a") && g.Members.Contains(name)) g.Members = g.Members.Where(m => m != name).ToList();
                }
            }
            if (o.Values.Get("g") is { } gv)
            {
                var g = db.Group.Find(e => e.Name == gv || Js.Num(e.Gid) == gv);
                if (g is null)
                {
                    ctx.Err($"usermod: group '{gv}' does not exist\n");
                    return 6;
                }
                entry.Gid = g.Gid;
            }
            if (o.Values.Get("s") is { } sv) entry.Shell = sv;
            if (o.Values.Get("c") is { } cv) entry.Gecos = cv;
            if (o.Values.Get("d") is { } dv)
            {
                var old = entry.Home;
                entry.Home = dv;
                if (o.Flags.Contains("m"))
                {
                    var node = sh.Vfs.TryLookup(old, UsersLib.Root);
                    if (node is not null)
                    {
                        try
                        {
                            sh.Vfs.Insert(dv, node, UsersLib.Root);
                            sh.Vfs.Remove(old, UsersLib.Root);
                        }
                        catch (FsError e)
                        {
                            ctx.Err($"usermod: cannot rename directory {old} to {dv}: {e.Message}\n");
                            return 12;
                        }
                    }
                }
            }
            var shadow = ShadowFor(db, name);
            if (o.Flags.Contains("L") && !shadow.Hash.StartsWith('!')) shadow.Hash = "!" + shadow.Hash;
            if (o.Flags.Contains("U"))
            {
                var unlocked = StripBang(shadow.Hash);
                if (unlocked == "" || unlocked == "!")
                {
                    ctx.Err("usermod: unlocking the user's password would result in a passwordless account.\nYou should set a password with usermod -p to unlock this user's password.\n");
                }
                else shadow.Hash = unlocked;
            }
            if (o.Values.Get("e") is { } ev)
            {
                var days = DaysOf(ev);
                shadow.Expire = ev == "" || ev == "-1" ? "" : double.IsFinite(days) ? Js.Num(days) : shadow.Expire;
            }
            UsersLib.SaveDb(sh, db);
            return 0;
        },
    };
}
