namespace Codestead.Shell.Commands;

// The adduser and addgroup commands.

public static partial class UsersCmd
{
    private const string UsersGroupInfo = "info: Adding new user `{0}' to supplemental / extra groups `users' ...\ninfo: Adding user `{0}' to group `users' ...\n";

    /// <summary>Asks for the full name, then whether the information is correct (like adduser does).</summary>
    private static void AskFullName(Shell sh, string name, Sink io)
    {
        io.Out($"Changing the user information for {name}\nEnter the new value, or press ENTER for the default\n");
        sh.AskText("\tFull Name []: ", (fullName, io2) =>
        {
            io2.Out(Dim(sh, "users.chfnSkips"));
            sh.Ask("Is the information correct? [Y/n] ", true, (yes, io3) =>
            {
                if (!yes)
                {
                    AskFullName(sh, name, io3);
                    return 0;
                }
                var db = UsersLib.LoadDb(sh);
                var entry = db.Passwd.Find(e => e.Name == name);
                if (entry is not null) entry.Gecos = $"{fullName.Trim()},,,";
                var users = db.Group.Find(g => g.Name == "users");
                if (users is not null)
                {
                    io3.Out(string.Format(CultureInfo.InvariantCulture, UsersGroupInfo, name));
                    if (!users.Members.Contains(name)) users.Members.Add(name);
                }
                UsersLib.SaveDb(sh, db);
                return 0;
            });
            return 0;
        });
    }

    private static readonly CommandDef Adduser = new()
    {
        Name = "adduser",
        Summary = "Skapar en användare och frågar efter lösenord och namn (Debian)",
        SummaryEn = "Create a user, asking for password and name (Debian)",
        Man = """
        NAMN
               adduser - lägg till en användare (eller en användare i en grupp)

        SYNOPSIS
               adduser ANVÄNDARE
               adduser ANVÄNDARE GRUPP

        BESKRIVNING
               adduser är ett vänligare skript runt useradd som finns i Debian och
               Ubuntu. Det skapar hemkatalog, sätter /bin/bash som skal och frågar
               efter lösenord och fullständigt namn.

               "adduser kim sudo" lägger till en befintlig användare i en grupp.

        FLAGGOR
               --disabled-password   sätt inget lösenord (fråga inte)
               --comment TEXT        fullständigt namn (fråga inte); även --gecos
               --shell SKAL          annat skal än /bin/bash
               --home KATALOG        annan hemkatalog
               --system              skapa en systemanvändare

        EXEMPEL
               sudo adduser kim
               sudo adduser kim sudo
        """,
        ManEn = """
        NAME
               adduser - add a user (or a user to a group)

        SYNOPSIS
               adduser USER
               adduser USER GROUP

        DESCRIPTION
               adduser is a friendlier script around useradd found in Debian and
               Ubuntu. It creates the home directory, sets /bin/bash as the shell
               and asks for a password and full name.

               "adduser kim sudo" adds an existing user to a group.

        OPTIONS
               --disabled-password   set no password (don't ask)
               --comment TEXT        full name (don't ask); also --gecos
               --shell SHELL         a shell other than /bin/bash
               --home DIR            another home directory
               --system              create a system user

        EXAMPLES
               sudo adduser kim
               sudo adduser kim sudo
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            // --disabled-password (P), --system (S), --group (G), --no-create-home (N); c, s, h, i and u take values.
            var o2 = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "qPSGN",
                Values = "cshiu",
                Long = new()
                {
                    ["disabled-password"] = "P", ["disabled-login"] = "P", ["comment"] = "c", ["gecos"] = "c", ["shell"] = "s", ["home"] = "h", ["system"] = "S", ["quiet"] = "q",
                    ["group"] = "G", ["ingroup"] = "i", ["no-create-home"] = "N", ["uid"] = "u",
                },
            });
            if (o2.Error is not null)
            {
                ctx.Err($"adduser: {o2.Error}\n");
                return 1;
            }
            if (!IsRoot(sh))
            {
                ctx.Err("fatal: Only root may add a user or group to the system.\n");
                return 1;
            }
            var name = o2.Operands.Count > 0 ? o2.Operands[0] : null;
            var group = o2.Operands.Count > 1 ? o2.Operands[1] : null;
            if (string.IsNullOrEmpty(name) || o2.Operands.Count > 2)
            {
                ctx.Err("fatal: Only one or two names allowed.\n");
                return 1;
            }
            if (o2.Flags.Contains("G")) return AddGroupDeb(sh, ctx, name, o2.Flags.Contains("S"));
            if (group is not null)
            {
                // adduser USER GROUP
                var db = UsersLib.LoadDb(sh);
                var g = db.Group.Find(e => e.Name == group);
                if (!db.Passwd.Any(e => e.Name == name))
                {
                    ctx.Err($"fatal: The user `{name}' does not exist.\n");
                    return 1;
                }
                if (g is null)
                {
                    ctx.Err($"fatal: The group `{group}' does not exist.\n");
                    return 1;
                }
                if (g.Members.Contains(name))
                {
                    ctx.Err($"info: The user `{name}' is already a member of `{group}'.\n");
                    return 0;
                }
                ctx.Out($"info: Adding user `{name}' to group `{group}' ...\n");
                g.Members.Add(name);
                UsersLib.SaveDb(sh, db);
                return 0;
            }
            if (!UsersLib.ValidName(name))
            {
                ctx.Err("fatal: Please enter a username matching the regular expression\nconfigured via the NAME_REGEX configuration variable.  Use the `--allow-bad-names' option to relax this check or reconfigure NAME_REGEX.\n");
                return 1;
            }
            if (UsersLib.FindUser(sh, name) is not null)
            {
                ctx.Err($"fatal: The user `{name}' already exists.\n");
                return 1;
            }
            var system = o2.Flags.Contains("S");
            var ingroup = o2.Values.Get("i");
            if (!string.IsNullOrEmpty(ingroup) && UsersLib.FindGroup(sh, ingroup) is null)
            {
                ctx.Err($"fatal: The group `{ingroup}' does not exist.\n");
                return 1;
            }
            int? uid = o2.Values.Get("u") is { } u ? ToId(Js.Number(u)) : null;
            void Out(string s) => ctx.Out(s);
            Out($"info: Adding {(system ? "system " : "")}user `{name}' ...\n");
            Out(system ? "info: Selecting UID from range 100 to 999 ...\n" : "info: Selecting UID/GID from range 1000 to 59999 ...\n");
            var created = CreateUser(sh, new Sink(Out, s => ctx.Err(s)), "adduser", new NewUser
            {
                Name = name,
                Uid = uid,
                Group = ingroup ?? (system ? "nogroup" : null),
                Groups = new(),
                Comment = o2.Values.Get("c") ?? "",
                Home = o2.Values.Get("h") ?? (system ? "/nonexistent" : null),
                Shell = o2.Values.Get("s") ?? (system ? "/usr/sbin/nologin" : "/bin/bash"),
                CreateHome = !system && !o2.Flags.Contains("N"),
                System = system,
            });
            if (created is null) return 1;
            var (entry, ge) = created.Value;
            // The messages are written afterwards but in the same order as the real adduser.
            var info = new List<string>();
            if (!(!string.IsNullOrEmpty(ingroup) || system)) info.Add($"info: Adding new group `{name}' ({Js.Num(ge.Gid)}) ...");
            info.Add($"info: Adding new user `{name}' ({Js.Num(entry.Uid)}) with group `{ge.Name} ({Js.Num(ge.Gid)})' ...");
            if (system || o2.Flags.Contains("N")) info.Add($"info: Not creating home directory `{entry.Home}'.");
            else
            {
                info.Add($"info: Creating home directory `{entry.Home}' ...");
                info.Add("info: Copying files from `/etc/skel' ...");
            }
            Out(string.Join("\n", info) + "\n");
            if (system) return 0;
            int AfterPassword(Sink io)
            {
                if (o2.Values.Get("c") is not null)
                {
                    var db = UsersLib.LoadDb(sh);
                    var users = db.Group.Find(e => e.Name == "users");
                    if (users is not null && !users.Members.Contains(name))
                    {
                        io.Out(string.Format(CultureInfo.InvariantCulture, UsersGroupInfo, name));
                        users.Members.Add(name);
                        UsersLib.SaveDb(sh, db);
                    }
                    return 0;
                }
                if (!sh.CanAskInteractively()) return 0;
                AskFullName(sh, name, io);
                return 0;
            }
            if (o2.Flags.Contains("P") || !sh.CanAskInteractively()) return AfterPassword(ctx);
            AskNewPassword(sh, name, (ok, io) =>
            {
                if (!ok) io.Err(Dim(sh, "users.noPasswordSet", ("user", name)));
                return AfterPassword(io);
            });
            return 0;
        },
    };

    private static int AddGroupDeb(Shell sh, Sink ctx, string name, bool system)
    {
        if (UsersLib.FindGroup(sh, name) is not null)
        {
            ctx.Err($"fatal: The group `{name}' already exists.\n");
            return 1;
        }
        var code = AddGroup(sh, ctx, "addgroup", name, system);
        if (code == 0) ctx.Out($"info: Selecting GID from range {(system ? "100 to 999" : "1000 to 59999")} ...\ninfo: Adding group `{name}' (GID {Js.Num(UsersLib.FindGroup(sh, name)!.Gid)}) ...\n");
        return code;
    }

    private static readonly CommandDef Addgroup = new()
    {
        Name = "addgroup",
        Summary = "Skapar en grupp (Debian)",
        SummaryEn = "Create a group (Debian)",
        Man = """
        NAMN
               addgroup - skapa en grupp

        SYNOPSIS
               addgroup [--system] GRUPP

        BESKRIVNING
               Debians vänligare variant av groupadd.
        """,
        ManEn = """
        NAME
               addgroup - create a group

        SYNOPSIS
               addgroup [--system] GROUP

        DESCRIPTION
               Debian's friendlier variant of groupadd.
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            if (!IsRoot(sh))
            {
                ctx.Err("fatal: Only root may add a user or group to the system.\n");
                return 1;
            }
            var system = ctx.Args.Contains("--system");
            var names = ctx.Args.Where(a => !a.StartsWith("--", StringComparison.Ordinal)).ToList();
            if (names.Count == 2) return Adduser.Run(new CmdCtx(ctx, ctx.Sh, "adduser", names));
            if (names.Count != 1)
            {
                ctx.Err("fatal: Only one or two names allowed.\n");
                return 1;
            }
            return AddGroupDeb(sh, ctx, names[0], system);
        },
    };
}
