namespace Codestead.Shell.Commands;

// The useradd command: create a new user (needs root).

public static partial class UsersCmd
{
    private static readonly Regex UpperRe = new("[A-ZÅÄÖåäö]", RegexOptions.CultureInvariant);

    private static readonly CommandDef Useradd = new()
    {
        Name = "useradd",
        Summary = "Skapar en ny användare (kräver root)",
        SummaryEn = "Create a new user (needs root)",
        Man = """
        NAMN
               useradd - skapa en ny användare

        SYNOPSIS
               useradd [FLAGGOR] ANVÄNDARE

        BESKRIVNING
               Lägger till användaren i /etc/passwd, /etc/shadow och (med en egen
               grupp med samma namn) i /etc/group. Nya användare får nästa lediga
               UID från 1000 och uppåt. Kontot har inget lösenord förrän du sätter
               ett med passwd.

               Standardvärdena skiljer sig mellan distributionerna: i Debian och
               Arch skapas ingen hemkatalog utan -m, och i Debian blir skalet
               /bin/sh om du inte anger -s. Fedora skapar hemkatalogen automatiskt.

        FLAGGOR
               -m           skapa hemkatalogen (och kopiera filerna i /etc/skel)
               -M           skapa ingen hemkatalog
               -s SKAL      inloggningsskal, t.ex. /bin/bash
               -G GRUPPER   extra grupper, kommaseparerade (t.ex. sudo,utvecklare)
               -g GRUPP     primär grupp i stället för en egen grupp
               -c TEXT      kommentar, oftast det fullständiga namnet
               -d KATALOG   annan hemkatalog än /home/ANVÄNDARE
               -u UID       välj UID själv
               -r           systemanvändare (UID under 1000, ingen hemkatalog)
               -D           visa standardvärdena

        EXEMPEL
               sudo useradd -m -s /bin/bash kim
               sudo useradd -m -c "Kim Svensson" -G utvecklare kim
        """,
        ManEn = """
        NAME
               useradd - create a new user

        SYNOPSIS
               useradd [OPTIONS] USER

        DESCRIPTION
               Adds the user to /etc/passwd, /etc/shadow and (with a private group
               of the same name) to /etc/group. New users get the next free UID
               from 1000 upwards. The account has no password until you set one
               with passwd.

               The defaults differ between distributions: Debian and Arch create
               no home directory without -m, and on Debian the shell is /bin/sh
               unless you give -s. Fedora creates the home directory by default.

        OPTIONS
               -m           create the home directory (copying the files in /etc/skel)
               -M           do not create a home directory
               -s SHELL     login shell, e.g. /bin/bash
               -G GROUPS    supplementary groups, comma separated (e.g. sudo,developers)
               -g GROUP     primary group instead of a private group
               -c TEXT      comment, usually the full name
               -d DIR       home directory other than /home/USER
               -u UID       choose the UID yourself
               -r           system user (UID below 1000, no home directory)
               -D           show the defaults

        EXAMPLES
               sudo useradd -m -s /bin/bash kim
               sudo useradd -m -c "Kim Svensson" -G developers kim
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
            {
                Flags = "mMrDUN",
                Values = "sGgcdue",
                Long = new()
                {
                    ["create-home"] = "m", ["no-create-home"] = "M", ["system"] = "r", ["defaults"] = "D", ["user-group"] = "U", ["no-user-group"] = "N",
                    ["shell"] = "s", ["groups"] = "G", ["gid"] = "g", ["comment"] = "c", ["home-dir"] = "d", ["uid"] = "u", ["expiredate"] = "e",
                },
            });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error, 2);
            var d = Defaults(sh);
            if (o.Flags.Contains("D"))
            {
                ctx.Out($"GROUP=100\nHOME=/home\nINACTIVE=-1\nEXPIRE=\nSHELL={d.Shell}\nSKEL=/etc/skel\nCREATE_MAIL_SPOOL=no\n");
                return 0;
            }
            if (o.Operands.Count != 1)
            {
                ctx.Err("Usage: useradd [options] LOGIN\n       useradd -D\n\nTry 'man useradd' for the options.\n");
                return 2;
            }
            var name = o.Operands[0];
            if (!IsRoot(sh)) return Denied(ctx);
            if (!UsersLib.ValidName(name))
            {
                ctx.Err($"useradd: invalid user name '{name}': use --badname to ignore\n");
                if (UpperRe.IsMatch(name)) ctx.Err(Dim(sh, "users.lowercaseNames"));
                return 3;
            }
            if (UsersLib.FindUser(sh, name) is not null)
            {
                ctx.Err($"useradd: user '{name}' already exists\n");
                return 9;
            }
            var groups = SplitList(o.Values.Get("G"));
            if (!CheckGroups(ctx, sh, "useradd", groups)) return 6;
            double? uid = o.Values.Get("u") is { } u ? Js.Number(u) : null;
            if (uid is not null && !IsInteger(uid.Value))
            {
                ctx.Err($"useradd: invalid user ID '{o.Values.Get("u")}'\n");
                return 3;
            }
            var system = o.Flags.Contains("r");
            var created = CreateUser(sh, ctx, "useradd", new NewUser
            {
                Name = name,
                Uid = uid is null ? null : ToId(uid.Value),
                Group = o.Values.Get("g"),
                Groups = groups,
                Comment = o.Values.Get("c") ?? "",
                Home = o.Values.Get("d"),
                Shell = o.Values.Get("s") ?? d.Shell,
                CreateHome = o.Flags.Contains("m") || (d.CreateHome && !system && !o.Flags.Contains("M")),
                System = system,
            });
            if (created is null) return 6;
            if (!string.IsNullOrEmpty(o.Values.Get("e")))
            {
                var db = UsersLib.LoadDb(sh);
                var days = DaysOf(o.Values.Get("e")!);
                if (double.IsFinite(days)) ShadowFor(db, name).Expire = Js.Num(days);
                UsersLib.SaveDb(sh, db);
            }
            return 0;
        },
    };
}
