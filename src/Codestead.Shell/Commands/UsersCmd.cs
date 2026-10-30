namespace Codestead.Shell.Commands;

// Port of src/shell/commands/users.ts
// User management: useradd, usermod, userdel, groupadd, groupdel, gpasswd, passwd, chpasswd, chage,
// adduser/deluser/addgroup/delgroup (Debian), chgrp, who, w, last and getent.
// Everything reads and writes /etc/passwd, /etc/group and /etc/shadow via Users.cs.

public static partial class UsersCmd
{
    // ---------- Helpers ----------

    private static string Dim(Shell sh, string key, params (string Name, object? Value)[] args) => $"{UtilCmd.Color.Dim}{sh.Msg(key, args)}{UtilCmd.Color.Reset}\n";

    private static bool IsRoot(Shell sh) => sh.CurrentUser().Uid == 0;

    /// <summary>Like shadow-utils: "useradd: Permission denied." followed by the file not being lockable.</summary>
    private static int Denied(CmdCtx ctx, string file = "/etc/passwd")
    {
        ctx.Err($"{ctx.Name}: Permission denied.\n{ctx.Name}: cannot lock {file}; try again later.\n");
        if (ctx.IsTTY) ctx.Err(Dim(ctx.Sh, "users.needsRoot"));
        return 1;
    }

    /// <summary>Defaults that differ between the families (/etc/default/useradd and /etc/login.defs).</summary>
    private static (bool CreateHome, string Shell, int HomeMode, string LockedHash) Defaults(Shell sh)
    {
        var fam = sh.Distro.Family;
        return (
            // Fedora creates the home directory even without -m (CREATE_HOME yes).
            fam == "redhat",
            fam == "debian" ? "/bin/sh" : fam == "arch" ? "/usr/bin/bash" : "/bin/bash",
            fam == "debian" ? Js.Oct(750) : Js.Oct(700),
            fam == "redhat" ? "!!" : "!");
    }

    private static ShadowEntry ShadowFor(UserDb db, string name)
    {
        var s = db.Shadow.Find(e => e.Name == name);
        if (s is null)
        {
            s = new ShadowEntry { Name = name, Hash = "!", LastChange = Js.Num(UsersLib.Today()), Min = "0", Max = "99999", Warn = "7", Inactive = "", Expire = "", Reserved = "" };
            db.Shadow.Add(s);
        }
        return s;
    }

    /// <summary>Creates the home directory and copies the files from /etc/skel into it.</summary>
    private static void MakeHome(Shell sh, Sink ctx, string prog, PasswdEntry entry, string group)
    {
        var vfs = sh.Vfs;
        if (vfs.TryLookup(entry.Home, UsersLib.Root) is not null)
        {
            ctx.Err($"{prog}: warning: the home directory {entry.Home} already exists.\n{prog}: Not copying any file from skel directory into it.\n");
            return;
        }
        try
        {
            vfs.Mkdir(entry.Home, UsersLib.Root);
        }
        catch (FsError e)
        {
            ctx.Err($"{prog}: cannot create directory {entry.Home}: {e.Message}\n");
            return;
        }
        var home = vfs.Lookup(entry.Home, UsersLib.Root);
        home.Owner = entry.Name;
        home.Group = group;
        home.Mode = Defaults(sh).HomeMode;
        var skel = vfs.TryLookup("/etc/skel", UsersLib.Root);
        void ChownTree(FsNode n)
        {
            n.Owner = entry.Name;
            n.Group = group;
            n.Mtime = Js.Now();
            foreach (var c in (n.Children ?? Js.Obj<FsNode>()).Values) ChownTree(c);
        }
        foreach (var (name, node) in skel?.Children ?? Js.Obj<FsNode>())
        {
            var copy = VfsLib.CloneNode(node);
            ChownTree(copy);
            home.Children![name] = copy;
        }
    }

    private static bool RemoveTree(Shell sh, string path)
    {
        try
        {
            sh.Vfs.Remove(path, UsersLib.Root);
            return true;
        }
        catch (FsError)
        {
            return false;
        }
    }

    private sealed class NewUser
    {
        public string Name = "";
        public int? Uid;
        /// <summary>Primary group (name or number). Missing: a private group with the same name is created.</summary>
        public string? Group;
        public List<string> Groups = new();
        public string Comment = "";
        public string? Home;
        public string Shell = "";
        public bool CreateHome;
        public bool System;
    }

    /// <summary>Adds the user to the database (and maybe the home directory). Returns null on error.</summary>
    private static (PasswdEntry Entry, GroupEntry Group)? CreateUser(Shell sh, Sink io, string prog, NewUser opts)
    {
        var db = UsersLib.LoadDb(sh);
        var uids = db.Passwd.Select(e => e.Uid).ToList();
        var uid = opts.Uid ?? UsersLib.NextId(uids, opts.System);
        if (opts.Uid is not null && uids.Contains(opts.Uid.Value))
        {
            io.Err($"{prog}: UID {opts.Uid} is not unique\n");
            return null;
        }
        GroupEntry? group;
        if (opts.Group is not null)
        {
            group = db.Group.Find(g => g.Name == opts.Group || Js.Num(g.Gid) == opts.Group);
            if (group is null)
            {
                io.Err($"{prog}: group '{opts.Group}' does not exist\n");
                return null;
            }
        }
        else
        {
            var gids = db.Group.Select(g => g.Gid).ToList();
            var gid = gids.Contains(uid) ? UsersLib.NextId(gids, opts.System) : uid;
            group = new GroupEntry { Name = opts.Name, Password = "x", Gid = gid, Members = new() };
            db.Group.Add(group);
        }
        foreach (var g in opts.Groups)
        {
            var ge = db.Group.Find(e => e.Name == g);
            if (ge is not null && !ge.Members.Contains(opts.Name)) ge.Members.Add(opts.Name);
        }
        var entry = new PasswdEntry
        {
            Name = opts.Name,
            Password = "x",
            Uid = uid,
            Gid = group.Gid,
            Gecos = opts.Comment,
            Home = opts.Home ?? $"/home/{opts.Name}",
            Shell = opts.Shell,
        };
        db.Passwd.Add(entry);
        db.Shadow = db.Shadow.Where(s => s.Name != opts.Name).ToList();
        db.Shadow.Add(new ShadowEntry
        {
            Name = opts.Name,
            Hash = Defaults(sh).LockedHash,
            LastChange = Js.Num(UsersLib.Today()),
            Min = opts.System ? "" : "0",
            Max = opts.System ? "" : "99999",
            Warn = opts.System ? "" : "7",
            Inactive = "",
            Expire = "",
            Reserved = "",
        });
        UsersLib.SaveDb(sh, db);
        if (opts.CreateHome) MakeHome(sh, io, prog, entry, group.Name);
        return (entry, group);
    }

    private static bool CheckGroups(Sink io, Shell sh, string prog, List<string> list)
    {
        foreach (var g in list)
        {
            if (UsersLib.FindGroup(sh, g) is null)
            {
                io.Err($"{prog}: group '{g}' does not exist\n");
                return false;
            }
        }
        return true;
    }

    private static List<string> SplitList(string? s) => (s ?? "").Split(',').Where(x => x != "").ToList();

    /// <summary>Number(s) as an int for ids; NaN becomes -1 (JS would keep NaN).</summary>
    private static int ToId(double n) => double.IsFinite(n) ? (int)n : -1;

    private static bool IsInteger(double n) => double.IsFinite(n) && Math.Floor(n) == n;

    private static readonly Regex IsoDateOnly = new(@"^([+-][0-9]{6}|[0-9]{4})(?:-([0-9]{2})(?:-([0-9]{2}))?)?\z", RegexOptions.CultureInvariant);
    private static readonly Regex IsoDateTime = new(
        @"^([+-][0-9]{6}|[0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.([0-9]{1,9}))?)?(Z|[+-][0-9]{2}:[0-9]{2})?\z", RegexOptions.CultureInvariant);

    /// <summary>Date.parse(s): ISO dates without time are UTC, with time (and no zone) local; other formats best effort (local). NaN on failure.</summary>
    private static double DateParse(string s)
    {
        try
        {
            var m = IsoDateOnly.Match(s);
            if (m.Success)
            {
                int y = int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
                int mo = m.Groups[2].Success ? int.Parse(m.Groups[2].Value, CultureInfo.InvariantCulture) : 1;
                int d = m.Groups[3].Success ? int.Parse(m.Groups[3].Value, CultureInfo.InvariantCulture) : 1;
                return new DateTimeOffset(y, mo, d, 0, 0, 0, TimeSpan.Zero).ToUnixTimeMilliseconds();
            }
            m = IsoDateTime.Match(s);
            if (m.Success)
            {
                int Part(int i) => m.Groups[i].Success ? int.Parse(m.Groups[i].Value, CultureInfo.InvariantCulture) : 0;
                var frac = m.Groups[7].Success ? m.Groups[7].Value.PadRight(3, '0')[..3] : "000";
                var dt = new DateTime(Part(1), Part(2), Part(3), Part(4), Part(5), Part(6), int.Parse(frac, CultureInfo.InvariantCulture));
                if (!m.Groups[8].Success) return new DateTimeOffset(dt, TimeZoneInfo.Local.GetUtcOffset(dt)).ToUnixTimeMilliseconds();
                var zone = m.Groups[8].Value;
                var offset = zone == "Z" ? TimeSpan.Zero : TimeSpan.ParseExact(zone[1..], @"hh\:mm", CultureInfo.InvariantCulture) * (zone[0] == '-' ? -1 : 1);
                return new DateTimeOffset(dt, offset).ToUnixTimeMilliseconds();
            }
            if (DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var parsed))
                return new DateTimeOffset(parsed).ToUnixTimeMilliseconds();
        }
        catch (Exception e) when (e is ArgumentException or FormatException or OverflowException)
        {
        }
        return double.NaN;
    }

    /// <summary>Math.floor(Date.parse(s) / 86_400_000)</summary>
    private static double DaysOf(string s) => Math.Floor(DateParse(s) / 86_400_000);

    private static string ReplaceFirst(string s, string find, string repl)
    {
        int i = s.IndexOf(find, StringComparison.Ordinal);
        return i < 0 ? s : s[..i] + repl + s[(i + find.Length)..];
    }

    private static string StripBang(string hash) => hash.StartsWith('!') ? hash[1..] : hash;

    // ---------- useradd ----------

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

    // ---------- usermod ----------

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

    // ---------- userdel ----------

    private static int DeleteUser(Shell sh, Sink io, string prog, string name, bool removeHome, bool force)
    {
        var db = UsersLib.LoadDb(sh);
        var entry = db.Passwd.Find(e => e.Name == name);
        if (entry is null)
        {
            io.Err($"{prog}: user '{name}' does not exist\n");
            return 6;
        }
        if (sh.UserStack.Contains(name) && !force)
        {
            io.Err($"{prog}: user {name} is currently used by process 1290\n");
            return 8;
        }
        db.Passwd = db.Passwd.Where(e => e.Name != name).ToList();
        db.Shadow = db.Shadow.Where(s => s.Name != name).ToList();
        foreach (var g in db.Group) g.Members = g.Members.Where(m => m != name).ToList();
        // The private group is removed if nobody else uses it.
        var own = db.Group.Find(g => g.Gid == entry.Gid && g.Name == name);
        if (own is not null && own.Members.Count == 0 && !db.Passwd.Any(e => e.Gid == own.Gid)) db.Group = db.Group.Where(g => g != own).ToList();
        UsersLib.SaveDb(sh, db);
        if (removeHome)
        {
            if (sh.Distro.Family == "debian") io.Err($"{prog}: {name} mail spool (/var/mail/{name}) not found\n");
            if (!RemoveTree(sh, entry.Home)) io.Err($"{prog}: {name} home directory ({entry.Home}) not found\n");
        }
        return 0;
    }

    private static readonly CommandDef Userdel = new()
    {
        Name = "userdel",
        Summary = "Tar bort en användare (kräver root)",
        SummaryEn = "Delete a user (needs root)",
        Man = """
        NAMN
               userdel - ta bort ett användarkonto

        SYNOPSIS
               userdel [-r] ANVÄNDARE

        BESKRIVNING
               Tar bort användaren ur /etc/passwd, /etc/shadow och /etc/group.
               Utan -r ligger hemkatalogen och filerna kvar.

        FLAGGOR
               -r    ta också bort hemkatalogen
               -f    ta bort även om användaren är inloggad

        EXEMPEL
               sudo userdel -r vikarie
        """,
        ManEn = """
        NAME
               userdel - delete a user account

        SYNOPSIS
               userdel [-r] USER

        DESCRIPTION
               Removes the user from /etc/passwd, /etc/shadow and /etc/group.
               Without -r the home directory and files are left behind.

        OPTIONS
               -r    also remove the home directory
               -f    remove even if the user is logged in

        EXAMPLES
               sudo userdel -r substitute
        """,
        Run = ctx =>
        {
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "rf", Long = new() { ["remove"] = "r", ["force"] = "f" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error, 2);
            if (o.Operands.Count != 1)
            {
                ctx.Err("Usage: userdel [options] LOGIN\n\nOptions:\n  -f, --force    force removal of files, even if not owned by user\n  -r, --remove   remove home directory and mail spool\n");
                return 2;
            }
            if (!IsRoot(ctx.Sh)) return Denied(ctx);
            return DeleteUser(ctx.Sh, ctx, "userdel", o.Operands[0], o.Flags.Contains("r"), o.Flags.Contains("f"));
        },
    };

    // ---------- groupadd, groupdel, gpasswd ----------

    private static int AddGroup(Shell sh, Sink io, string prog, string name, bool system, string? gidArg = null)
    {
        if (!UsersLib.ValidName(name))
        {
            io.Err($"{prog}: '{name}' is not a valid group name\n");
            return 3;
        }
        var db = UsersLib.LoadDb(sh);
        if (db.Group.Any(g => g.Name == name))
        {
            io.Err($"{prog}: group '{name}' already exists\n");
            return 9;
        }
        var gids = db.Group.Select(g => g.Gid).ToList();
        double gid = gidArg is not null ? Js.Number(gidArg) : UsersLib.NextId(gids, system);
        if (!IsInteger(gid))
        {
            io.Err($"{prog}: invalid group ID '{gidArg}'\n");
            return 3;
        }
        if (gidArg is not null && gids.Contains(ToId(gid)))
        {
            io.Err($"{prog}: GID '{Js.Num(gid)}' already exists\n");
            return 4;
        }
        db.Group.Add(new GroupEntry { Name = name, Password = "x", Gid = ToId(gid), Members = new() });
        UsersLib.SaveDb(sh, db);
        return 0;
    }

    private static readonly CommandDef Groupadd = new()
    {
        Name = "groupadd",
        Summary = "Skapar en ny grupp (kräver root)",
        SummaryEn = "Create a new group (needs root)",
        Man = """
        NAMN
               groupadd - skapa en ny grupp

        SYNOPSIS
               groupadd [-g GID] [-r] GRUPP

        BESKRIVNING
               Lägger till gruppen i /etc/group. Nya grupper får nästa lediga GID
               från 1000 och uppåt. Lägg till medlemmar med "usermod -aG" eller
               "gpasswd -a".

        FLAGGOR
               -g GID   välj grupp-id själv
               -r       systemgrupp (GID under 1000)
               -f       inget fel om gruppen redan finns

        EXEMPEL
               sudo groupadd utvecklare
        """,
        ManEn = """
        NAME
               groupadd - create a new group

        SYNOPSIS
               groupadd [-g GID] [-r] GROUP

        DESCRIPTION
               Adds the group to /etc/group. New groups get the next free GID from
               1000 upwards. Add members with "usermod -aG" or "gpasswd -a".

        OPTIONS
               -g GID   choose the group ID yourself
               -r       system group (GID below 1000)
               -f       no error if the group already exists

        EXAMPLES
               sudo groupadd developers
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "rf", Values = "g", Long = new() { ["system"] = "r", ["force"] = "f", ["gid"] = "g" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error, 2);
            if (o.Operands.Count != 1)
            {
                ctx.Err("Usage: groupadd [options] GROUP\n\nTry 'man groupadd' for the options.\n");
                return 2;
            }
            if (!IsRoot(sh))
            {
                ctx.Err("groupadd: Permission denied.\ngroupadd: cannot lock /etc/group; try again later.\n");
                return 10;
            }
            if (o.Flags.Contains("f") && UsersLib.FindGroup(sh, o.Operands[0]) is not null) return 0;
            return AddGroup(sh, ctx, "groupadd", o.Operands[0], o.Flags.Contains("r"), o.Values.Get("g"));
        },
    };

    private static int DelGroup(Shell sh, Sink io, string prog, string name)
    {
        var db = UsersLib.LoadDb(sh);
        var group = db.Group.Find(g => g.Name == name);
        if (group is null)
        {
            io.Err($"{prog}: group '{name}' does not exist\n");
            return 6;
        }
        var user = db.Passwd.Find(e => e.Gid == group.Gid);
        if (user is not null)
        {
            io.Err($"{prog}: cannot remove the primary group of user '{user.Name}'\n");
            return 8;
        }
        db.Group = db.Group.Where(g => g != group).ToList();
        UsersLib.SaveDb(sh, db);
        return 0;
    }

    private static readonly CommandDef Groupdel = new()
    {
        Name = "groupdel",
        Summary = "Tar bort en grupp (kräver root)",
        SummaryEn = "Delete a group (needs root)",
        Man = """
        NAMN
               groupdel - ta bort en grupp

        SYNOPSIS
               groupdel GRUPP

        BESKRIVNING
               Det går inte att ta bort en grupp som är någons primära grupp.
        """,
        ManEn = """
        NAME
               groupdel - delete a group

        SYNOPSIS
               groupdel GROUP

        DESCRIPTION
               A group that is someone's primary group cannot be removed.
        """,
        Run = ctx =>
        {
            if (ctx.Args.Count != 1 || ctx.Args[0].StartsWith('-'))
            {
                ctx.Err("Usage: groupdel [options] GROUP\n");
                return 2;
            }
            if (!IsRoot(ctx.Sh))
            {
                ctx.Err("groupdel: Permission denied.\ngroupdel: cannot lock /etc/group; try again later.\n");
                return 10;
            }
            return DelGroup(ctx.Sh, ctx, "groupdel", ctx.Args[0]);
        },
    };

    private static readonly CommandDef Gpasswd = new()
    {
        Name = "gpasswd",
        Summary = "Lägger till eller tar bort medlemmar i en grupp",
        SummaryEn = "Add or remove members of a group",
        Man = """
        NAMN
               gpasswd - administrera /etc/group

        SYNOPSIS
               gpasswd -a ANVÄNDARE GRUPP
               gpasswd -d ANVÄNDARE GRUPP

        FLAGGOR
               -a ANVÄNDARE   lägg till användaren i gruppen
               -d ANVÄNDARE   ta bort användaren ur gruppen
               -M LISTA       sätt hela medlemslistan (kommaseparerad)

        EXEMPEL
               sudo gpasswd -a kim utvecklare
               sudo gpasswd -d kim utvecklare
        """,
        ManEn = """
        NAME
               gpasswd - administer /etc/group

        SYNOPSIS
               gpasswd -a USER GROUP
               gpasswd -d USER GROUP

        OPTIONS
               -a USER   add the user to the group
               -d USER   remove the user from the group
               -M LIST   set the whole member list (comma separated)

        EXAMPLES
               sudo gpasswd -a kim developers
               sudo gpasswd -d kim developers
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Values = "adM", Long = new() { ["add"] = "a", ["delete"] = "d", ["members"] = "M" } });
            if (o.Error is not null || o.Operands.Count != 1 || o.Values.Count != 1)
            {
                ctx.Err("Usage: gpasswd [option] GROUP\n\nOptions:\n  -a, --add USER                add USER to GROUP\n  -d, --delete USER             remove USER from GROUP\n  -M, --members USER,...        set the list of members of GROUP\n");
                return 2;
            }
            var groupName = o.Operands[0];
            if (!IsRoot(sh))
            {
                ctx.Err("gpasswd: Permission denied.\n");
                return 1;
            }
            var db = UsersLib.LoadDb(sh);
            var group = db.Group.Find(g => g.Name == groupName);
            if (group is null)
            {
                ctx.Err($"gpasswd: group '{groupName}' does not exist in /etc/group\n");
                return 3;
            }
            var a = o.Values.Get("a");
            var d = o.Values.Get("d");
            var users = o.Values.Get("M") is { } mv ? SplitList(mv) : new List<string> { (a ?? d)! };
            foreach (var u in users)
            {
                if (!db.Passwd.Any(e => e.Name == u))
                {
                    ctx.Err($"gpasswd: user '{u}' does not exist\n");
                    return 3;
                }
            }
            if (a is not null)
            {
                ctx.Out($"Adding user {a} to group {groupName}\n");
                if (!group.Members.Contains(a)) group.Members.Add(a);
            }
            else if (d is not null)
            {
                if (!group.Members.Contains(d))
                {
                    ctx.Err($"gpasswd: user '{d}' is not a member of '{groupName}'\n");
                    return 3;
                }
                ctx.Out($"Removing user {d} from group {groupName}\n");
                group.Members = group.Members.Where(m => m != d).ToList();
            }
            else
            {
                group.Members = users;
            }
            UsersLib.SaveDb(sh, db);
            return 0;
        },
    };

    // ---------- passwd, chpasswd, chage ----------

    /// <summary>Asks for the new password twice and saves it. done() is called afterwards.</summary>
    private static void AskNewPassword(Shell sh, string name, Func<bool, Sink, int> done)
    {
        sh.AskText(
            "New password: ",
            (first, _) =>
            {
                sh.AskText(
                    "Retype new password: ",
                    (second, io) =>
                    {
                        var redhat = sh.Distro.Family == "redhat";
                        if (first != second || first == "")
                        {
                            io.Err(first == "" ? "No password has been supplied.\n" : "Sorry, passwords do not match.\n");
                            io.Err($"passwd: Authentication token manipulation error\n{(redhat ? "" : "passwd: password unchanged\n")}");
                            return done(false, io);
                        }
                        SetPassword(sh, name, first);
                        io.Out(redhat ? "passwd: all authentication tokens updated successfully.\n" : "passwd: password updated successfully\n");
                        return done(true, io);
                    },
                    true);
                return 0;
            },
            true);
    }

    private static void SetPassword(Shell sh, string name, string password)
    {
        var db = UsersLib.LoadDb(sh);
        var s = ShadowFor(db, name);
        s.Hash = UsersLib.HashPassword(password);
        s.LastChange = Js.Num(UsersLib.Today());
        UsersLib.SaveDb(sh, db);
    }

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

    private static readonly CommandDef Chpasswd = new()
    {
        Name = "chpasswd",
        Summary = "Sätter lösenord från rader \"användare:lösenord\" (kräver root)",
        SummaryEn = "Set passwords from \"user:password\" lines (needs root)",
        Man = """
        NAMN
               chpasswd - sätt lösenord för många användare på en gång

        SYNOPSIS
               echo 'ANVÄNDARE:LÖSENORD' | sudo chpasswd

        BESKRIVNING
               Läser rader på formen användare:lösenord från standard in.
               Praktiskt i skript.
        """,
        ManEn = """
        NAME
               chpasswd - update passwords in batch

        SYNOPSIS
               echo 'USER:PASSWORD' | sudo chpasswd

        DESCRIPTION
               Reads lines of the form user:password from standard input.
               Handy in scripts.
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            if (!IsRoot(sh))
            {
                ctx.Err("chpasswd: Permission denied.\nchpasswd: cannot lock /etc/shadow; try again later.\n");
                return 1;
            }
            int code = 0;
            var lines = (ctx.Stdin ?? "").Split('\n');
            for (int i = 0; i < lines.Length; i++)
            {
                var line = lines[i];
                if (line.Trim() == "") continue;
                int colon = line.IndexOf(':');
                var name = line.Slice(0, colon);
                if (colon < 0)
                {
                    ctx.Err($"chpasswd: line {i + 1}: missing new password\n");
                    code = 1;
                }
                else if (UsersLib.FindUser(sh, name) is null)
                {
                    ctx.Err($"chpasswd: line {i + 1}: user '{name}' does not exist\n");
                    code = 1;
                }
                else SetPassword(sh, name, line.Slice(colon + 1));
            }
            return code;
        },
    };

    private static readonly string[] Months = { "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" };

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
               chage -l elev
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
               chage -l elev
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

    // ---------- adduser, deluser, addgroup, delgroup (the Debian family) ----------

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

    private static readonly CommandDef Deluser = new()
    {
        Name = "deluser",
        Summary = "Tar bort en användare, eller en användare ur en grupp (Debian)",
        SummaryEn = "Remove a user, or a user from a group (Debian)",
        Man = """
        NAMN
               deluser - ta bort en användare (eller en användare ur en grupp)

        SYNOPSIS
               deluser [--remove-home] ANVÄNDARE
               deluser ANVÄNDARE GRUPP

        EXEMPEL
               sudo deluser --remove-home vikarie
               sudo deluser kim sudo
        """,
        ManEn = """
        NAME
               deluser - remove a user (or a user from a group)

        SYNOPSIS
               deluser [--remove-home] USER
               deluser USER GROUP

        EXAMPLES
               sudo deluser --remove-home substitute
               sudo deluser kim sudo
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            if (!IsRoot(sh))
            {
                ctx.Err("fatal: Only root may remove a user or group from the system.\n");
                return 1;
            }
            var removeHome = ctx.Args.Contains("--remove-home") || ctx.Args.Contains("--remove-all-files");
            var rest = ctx.Args.Where(a => !a.StartsWith("--", StringComparison.Ordinal)).ToList();
            var name = rest.Count > 0 ? rest[0] : null;
            var group = rest.Count > 1 ? rest[1] : null;
            if (string.IsNullOrEmpty(name))
            {
                ctx.Err("fatal: No options allowed after names.\n");
                return 1;
            }
            var db = UsersLib.LoadDb(sh);
            if (!db.Passwd.Any(e => e.Name == name))
            {
                ctx.Err($"fatal: The user `{name}' does not exist.\n");
                return 2;
            }
            if (group is not null)
            {
                var g = db.Group.Find(e => e.Name == group);
                if (g is null)
                {
                    ctx.Err($"fatal: The group `{group}' does not exist.\n");
                    return 3;
                }
                if (!g.Members.Contains(name))
                {
                    ctx.Err($"fatal: The user `{name}' is not a member of group `{group}'.\n");
                    return 6;
                }
                ctx.Out($"info: Removing user `{name}' from group `{group}' ...\n");
                g.Members = g.Members.Where(m => m != name).ToList();
                UsersLib.SaveDb(sh, db);
                return 0;
            }
            if (removeHome) ctx.Out("info: Looking for files to backup/remove ...\ninfo: Removing files ...\n");
            ctx.Out($"info: Removing crontab ...\ninfo: Removing user `{name}' ...\n");
            var quiet = new Sink(_ => { }, s =>
            {
                if (!s.Contains("mail spool", StringComparison.Ordinal)) ctx.Err(s);
            });
            return DeleteUser(sh, quiet, "userdel", name, removeHome, false);
        },
    };

    private static readonly CommandDef Delgroup = new()
    {
        Name = "delgroup",
        Summary = "Tar bort en grupp (Debian)",
        SummaryEn = "Remove a group (Debian)",
        Man = """
        NAMN
               delgroup - ta bort en grupp

        SYNOPSIS
               delgroup GRUPP
        """,
        ManEn = """
        NAME
               delgroup - remove a group

        SYNOPSIS
               delgroup GROUP
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            if (!IsRoot(sh))
            {
                ctx.Err("fatal: Only root may remove a user or group from the system.\n");
                return 1;
            }
            var name = ctx.Args.Count > 0 ? ctx.Args[0] : null;
            if (string.IsNullOrEmpty(name)) return 1;
            if (UsersLib.FindGroup(sh, name) is null)
            {
                ctx.Err($"fatal: The group `{name}' does not exist.\n");
                return 3;
            }
            var code = DelGroup(sh, new Sink(s => ctx.Out(s), s => ctx.Err(ReplaceFirst(s, "groupdel: ", "fatal: "))), "groupdel", name);
            if (code == 0) ctx.Out($"info: Removing group `{name}' ...\n");
            return code;
        },
    };

    // ---------- chgrp ----------

    private static readonly CommandDef Chgrp = new()
    {
        Name = "chgrp",
        Summary = "Byter grupp på filer",
        SummaryEn = "Change the group of files",
        Man = """
        NAMN
               chgrp - byt grupp på filer

        SYNOPSIS
               chgrp [-R] GRUPP FIL...

        BESKRIVNING
               Du får byta grupp på dina egna filer till en grupp som du själv är
               medlem i. root får byta till vilken grupp som helst.

        FLAGGOR
               -R    ändra rekursivt i kataloger

        EXEMPEL
               chgrp utvecklare projekt.txt
               sudo chgrp -R utvecklare /srv/projekt
        """,
        ManEn = """
        NAME
               chgrp - change the group of files

        SYNOPSIS
               chgrp [-R] GROUP FILE...

        DESCRIPTION
               You may change the group of your own files to a group you are a
               member of. root may change to any group.

        OPTIONS
               -R    operate recursively on directories

        EXAMPLES
               chgrp developers project.txt
               sudo chgrp -R developers /srv/project
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec { Flags = "Rv", Long = new() { ["recursive"] = "R", ["verbose"] = "v" } });
            if (o.Error is not null) return UtilCmd.BadOption(ctx, o.Error);
            if (o.Operands.Count == 0) return UtilCmd.BadOption(ctx, "missing operand");
            var group = o.Operands[0];
            var files = o.Operands.Skip(1).ToList();
            if (files.Count == 0) return UtilCmd.BadOption(ctx, $"missing operand after '{group}'");
            if (UsersLib.FindGroup(sh, group) is null)
            {
                ctx.Err($"chgrp: invalid group: '{group}'\n");
                return 1;
            }
            var user = sh.CurrentUser();
            int code = 0;
            void Apply(string label, FsNode node)
            {
                if (user.Uid != 0 && (node.Owner != user.Name || !user.Groups.Contains(group)))
                {
                    ctx.Err($"chgrp: changing group of '{label}': Operation not permitted\n");
                    code = 1;
                    return;
                }
                node.Group = group;
                if (o.Flags.Contains("R") && node.Type == "dir")
                    foreach (var (n, c) in node.Children!) Apply($"{label}/{n}", c);
            }
            foreach (var f in files)
            {
                try
                {
                    Apply(f, sh.Vfs.Lookup(sh.Resolve(f), user));
                }
                catch (FsError e)
                {
                    ctx.Err($"chgrp: cannot access '{f}': {e.Message}\n");
                    code = 1;
                }
            }
            return code;
        },
    };

    // ---------- who, w, last ----------

    /// <summary>The time the student "logged in" today.</summary>
    private const string LoginTime = "08:12";

    private static string IsoDay(int offsetDays = 0)
    {
        var d = Js.LocalDate(Js.Now() - offsetDays * 86_400_000L);
        return $"{d.Year}-{d.Month:00}-{d.Day:00}";
    }

    /// <summary>The user logged in at the terminal – not the one you switched to with su.</summary>
    private static string LoginName(Shell sh) => sh.UserStack.Count > 0 ? sh.UserStack[0] : "elev";

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

    // ---------- getent ----------

    private static readonly Regex HashCommentRe = new("#.*", RegexOptions.CultureInvariant);
    private static readonly Regex WsRe = new(@"\s+", RegexOptions.CultureInvariant);

    private static readonly CommandDef Getent = new()
    {
        Name = "getent",
        Summary = "Slår upp användare, grupper och värdnamn",
        SummaryEn = "Look up users, groups and host names",
        Man = """
        NAMN
               getent - slå upp poster i systemets databaser

        SYNOPSIS
               getent DATABAS [NYCKEL]...

        BESKRIVNING
               Databaserna passwd, group, shadow och hosts. Utan NYCKEL visas
               alla poster. Fungerar även när användarna kommer från en server
               (t.ex. LDAP) och inte bara från /etc/passwd.

        EXEMPEL
               getent passwd kim
               getent group sudo
        """,
        ManEn = """
        NAME
               getent - get entries from the system databases

        SYNOPSIS
               getent DATABASE [KEY]...

        DESCRIPTION
               The databases passwd, group, shadow and hosts. Without KEY all
               entries are shown. Also works when users come from a server (e.g.
               LDAP) and not just from /etc/passwd.

        EXAMPLES
               getent passwd kim
               getent group sudo
        """,
        Run = ctx =>
        {
            var sh = ctx.Sh;
            var db = ctx.Args.Count > 0 ? ctx.Args[0] : null;
            var keys = ctx.Args.Skip(1).ToList();
            if (string.IsNullOrEmpty(db))
            {
                ctx.Err("getent: wrong number of arguments\nTry `getent --help' or `getent --usage' for more information.\n");
                return 1;
            }
            List<(List<string?> Keys, string Line)> lines;
            if (db == "passwd" || db == "group" || db == "shadow")
            {
                var path = $"/etc/{db}";
                string text;
                try
                {
                    text = sh.Vfs.ReadFile(path, sh.CurrentUser());
                }
                catch (FsError)
                {
                    return 2;
                }
                lines = text
                    .Split('\n')
                    .Where(l => l.Trim() != "" && !l.StartsWith('#'))
                    .Select(l =>
                    {
                        var f = l.Split(':');
                        var k = db == "shadow" ? new List<string?> { f[0] } : new List<string?> { f[0], f.Length > 2 ? f[2] : null };
                        return (k, l);
                    })
                    .ToList();
            }
            else if (db == "hosts")
            {
                var text = sh.Vfs.TryLookup("/etc/hosts", UsersLib.Root)?.Content ?? "";
                lines = text
                    .Split('\n')
                    .Select(l => HashCommentRe.Replace(l, "", 1).Trim())
                    .Where(l => l != "")
                    .Select(l =>
                    {
                        var parts = WsRe.Split(l);
                        var ip = parts[0];
                        var names = parts.Skip(1).ToList();
                        var k = new List<string?> { ip };
                        k.AddRange(names);
                        return (k, $"{ip.PadRight(15)} {string.Join(" ", names)}");
                    })
                    .ToList();
            }
            else
            {
                ctx.Err($"Unknown database: {db}\nTry `getent --help' or `getent --usage' for more information.\n");
                return 1;
            }
            if (keys.Count == 0)
            {
                foreach (var l in lines) ctx.Out(l.Line + "\n");
                return 0;
            }
            int code = 0;
            foreach (var k in keys)
            {
                var hit = lines.FirstOrDefault(l => l.Keys.Contains(k));
                if (hit.Line is not null) ctx.Out(hit.Line + "\n");
                else code = 2;
            }
            return code;
        },
    };

    public static List<CommandDef> All { get; } = new()
    {
        Useradd, Usermod, Userdel, Groupadd, Groupdel, Gpasswd, Passwd, Chpasswd, Chage,
        Adduser, Deluser, Addgroup, Delgroup, Chgrp, Who, W, Last, Getent,
    };
}
