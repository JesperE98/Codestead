namespace Codestead.Shell.Commands;

// Port of src/shell/commands/users.ts
// User management: useradd, usermod, userdel, groupadd, groupdel, gpasswd, passwd, chpasswd, chage,
// adduser/deluser/addgroup/delgroup (Debian), chgrp, who, w, last and getent.
// Everything reads and writes /etc/passwd, /etc/group and /etc/shadow via Users/ (UsersLib).

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

    private static string StripBang(string hash) => hash.StartsWith('!') ? hash[1..] : hash;

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

    private static readonly string[] Months = { "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" };

    // ---------- who, w, last ----------

    /// <summary>The time the student "logged in" today.</summary>
    private const string LoginTime = "08:12";

    /// <summary>The user logged in at the terminal – not the one you switched to with su.</summary>
    private static string LoginName(Shell sh) => sh.UserStack.Count > 0 ? sh.UserStack[0] : sh.World.User;

    // Built on first use: the commands are static fields in the other files of this partial class, and
    // C# does not define the order in which static fields in different files are initialized.
    public static List<CommandDef> All => field ??= new()
    {
        Useradd, Usermod, Userdel, Groupadd, Groupdel, Gpasswd, Passwd, Chpasswd, Chage,
        Adduser, Deluser, Addgroup, Delgroup, Chgrp, Who, W, Last, Getent,
    };
}
