using System.Runtime.CompilerServices;

namespace Codestead.Shell;

// Port of src/shell/users.ts – users and groups. Everything is read from /etc/passwd, /etc/group and
// /etc/shadow in the virtual file system, just like on a real system, so useradd, usermod, passwd etc.
// only have to change the files.

public partial class PasswdEntry
{
    public string Name { get; set; } = "";
    public string Password { get; set; } = "";
    public int Uid { get; set; }
    public int Gid { get; set; }
    public string Gecos { get; set; } = "";
    public string Home { get; set; } = "";
    public string Shell { get; set; } = "";
}

public partial class GroupEntry
{
    public string Name { get; set; } = "";
    public string Password { get; set; } = "";
    public int Gid { get; set; }
    public List<string> Members { get; set; } = new();
}

public partial class ShadowEntry
{
    public string Name { get; set; } = "";
    /// <summary>Password hash. A leading "!" or "*" means locked/no password.</summary>
    public string Hash { get; set; } = "";
    /// <summary>Last password change, in days since 1970-01-01 (empty = never).</summary>
    public string LastChange { get; set; } = "";
    public string Min { get; set; } = "";
    public string Max { get; set; } = "";
    public string Warn { get; set; } = "";
    public string Inactive { get; set; } = "";
    public string Expire { get; set; } = "";
    public string Reserved { get; set; } = "";
}

public partial class UserDb
{
    public List<PasswdEntry> Passwd { get; set; } = new();
    public List<GroupEntry> Group { get; set; } = new();
    public List<ShadowEntry> Shadow { get; set; } = new();
}

public static partial class UsersLib
{
    public const string Passwd = "/etc/passwd";
    public const string Group = "/etc/group";
    public const string Shadow = "/etc/shadow";

    /// <summary>root as a constant – used to read the system files without asking the shell (avoids recursion).</summary>
    public static readonly User Root = new() { Name = "root", Uid = 0, Groups = new() { "root" }, Home = "/root" };

    // ---------- Parsing and writing the files ----------

    private static List<string> Lines(string text) =>
        text.Split('\n').Where(l => l.Trim() != "" && !l.StartsWith('#')).ToList();

    /// <summary>Number(s) for ids. A non-numeric field (NaN in JS) becomes -1.</summary>
    private static int Id(string? s)
    {
        var n = Js.Number(s);
        return double.IsFinite(n) ? (int)n : -1;
    }

    public static List<PasswdEntry> ParsePasswd(string text)
    {
        var result = new List<PasswdEntry>();
        foreach (var l in Lines(text))
        {
            var f = l.Split(':');
            if (f.Length < 7 || f[0] == "") continue;
            result.Add(new PasswdEntry
            {
                Name = f[0],
                Password = f[1],
                Uid = Id(f[2]),
                Gid = Id(f[3]),
                Gecos = f[4],
                Home = f[5],
                Shell = string.Join(":", f.Skip(6)),
            });
        }
        return result;
    }

    public static string FormatPasswd(List<PasswdEntry> list) =>
        string.Concat(list.Select(e => string.Join(":", e.Name, e.Password, Js.Num(e.Uid), Js.Num(e.Gid), e.Gecos, e.Home, e.Shell) + "\n"));

    public static List<GroupEntry> ParseGroup(string text)
    {
        var result = new List<GroupEntry>();
        foreach (var l in Lines(text))
        {
            var f = l.Split(':');
            if (f.Length < 3 || f[0] == "") continue;
            result.Add(new GroupEntry
            {
                Name = f[0],
                Password = f[1],
                Gid = Id(f[2]),
                Members = (f.Length > 3 ? f[3] : "").Split(',').Where(m => m != "").ToList(),
            });
        }
        return result;
    }

    public static string FormatGroup(List<GroupEntry> list) =>
        string.Concat(list.Select(g => $"{g.Name}:{g.Password}:{Js.Num(g.Gid)}:{string.Join(",", g.Members)}\n"));

    public static List<ShadowEntry> ParseShadow(string text)
    {
        var result = new List<ShadowEntry>();
        foreach (var l in Lines(text))
        {
            var f = l.Split(':');
            if (f[0] == "") continue;
            string F(int i, string def) => i < f.Length ? f[i] : def;
            result.Add(new ShadowEntry
            {
                Name = f[0],
                Hash = F(1, "!"),
                LastChange = F(2, ""),
                Min = F(3, ""),
                Max = F(4, ""),
                Warn = F(5, ""),
                Inactive = F(6, ""),
                Expire = F(7, ""),
                Reserved = F(8, ""),
            });
        }
        return result;
    }

    public static string FormatShadow(List<ShadowEntry> list) =>
        string.Concat(list.Select(s => string.Join(":", s.Name, s.Hash, s.LastChange, s.Min, s.Max, s.Warn, s.Inactive, s.Expire, s.Reserved) + "\n"));

    private static string? ReadEtc(VFS vfs, string path)
    {
        var node = vfs.TryLookup(path, Root);
        return node?.Type == "file" ? node.Content ?? "" : null;
    }

    // ---------- Lookups (cached) ----------

    private sealed class Cache
    {
        public string? PasswdText;
        public string? GroupText;
        public List<PasswdEntry> Passwd = new();
        public List<GroupEntry> Group = new();
        public Dictionary<string, User> Users = new();
    }

    private static readonly ConditionalWeakTable<VFS, Cache> Caches = new();

    /// <summary>
    /// Parsed /etc/passwd and /etc/group. GetUser is called very often, so the result is kept
    /// and only parsed again when the contents of the files have changed.
    /// </summary>
    private static Cache Cached(VFS vfs)
    {
        var passwdText = ReadEtc(vfs, Passwd);
        var groupText = ReadEtc(vfs, Group);
        lock (Caches)
        {
            if (!Caches.TryGetValue(vfs, out var c) || c.PasswdText != passwdText || c.GroupText != groupText)
            {
                c = new Cache
                {
                    PasswdText = passwdText,
                    GroupText = groupText,
                    Passwd = ParsePasswd(passwdText ?? ""),
                    Group = ParseGroup(groupText ?? ""),
                };
                Caches.AddOrUpdate(vfs, c);
            }
            return c;
        }
    }

    public static List<PasswdEntry> PasswdEntries(Shell sh) => Cached(sh.Vfs).Passwd;

    public static List<GroupEntry> GroupEntries(Shell sh) => Cached(sh.Vfs).Group;

    public static PasswdEntry? FindUser(Shell sh, string name) => PasswdEntries(sh).Find(e => e.Name == name);

    public static GroupEntry? FindGroup(Shell sh, string name) => GroupEntries(sh).Find(g => g.Name == name);

    public static bool UserExists(Shell sh, string name) => FindUser(sh, name) is not null;

    public static bool GroupExists(Shell sh, string name) => FindGroup(sh, name) is not null;

    public static string GroupName(Shell sh, int gid) => GroupEntries(sh).Find(g => g.Gid == gid)?.Name ?? Js.Num(gid);

    public static int? GidOf(Shell sh, string group) => FindGroup(sh, group)?.Gid;

    /// <summary>Used by Shell.GetUser: builds the User object from /etc/passwd and /etc/group.</summary>
    public static User LookupUser(Shell sh, string name)
    {
        var c = Cached(sh.Vfs);
        lock (c)
        {
            if (c.Users.TryGetValue(name, out var hit)) return hit;
        }
        var entry = c.Passwd.Find(e => e.Name == name);
        User user;
        if (entry is not null)
        {
            var primary = c.Group.Find(g => g.Gid == entry.Gid)?.Name ?? Js.Num(entry.Gid);
            var extra = c.Group.Where(g => g.Gid != entry.Gid && g.Members.Contains(name)).Select(g => g.Name);
            var groups = new List<string> { primary };
            groups.AddRange(extra.Where(g => g != primary));
            user = new User { Name = name, Uid = entry.Uid, Groups = groups, Home = entry.Home };
        }
        else if (name == "root")
        {
            user = Root;
        }
        else if (name == InitfsLib.Student)
        {
            // Fallback if someone has destroyed /etc/passwd – the student must always be able to continue.
            user = new User { Name = name, Uid = 1000, Groups = new() { name, sh.Distro.AdminGroup }, Home = $"/home/{name}" };
        }
        else
        {
            user = new User { Name = name, Uid = 65534, Groups = new() { name }, Home = $"/home/{name}" };
        }
        lock (c) c.Users[name] = user;
        return user;
    }

    // ---------- Changing the files ----------

    /// <summary>A fresh copy of the database to change. Save with SaveDb.</summary>
    public static UserDb LoadDb(Shell sh) => new()
    {
        Passwd = ParsePasswd(ReadEtc(sh.Vfs, Passwd) ?? ""),
        Group = ParseGroup(ReadEtc(sh.Vfs, Group) ?? ""),
        Shadow = ParseShadow(ReadEtc(sh.Vfs, Shadow) ?? ""),
    };

    /// <summary>Writes the files back (only those that changed, so mtime stays correct).</summary>
    public static void SaveDb(Shell sh, UserDb db)
    {
        void Write(string path, string text)
        {
            if (ReadEtc(sh.Vfs, path) != text) sh.Vfs.WriteFile(path, text, Root);
        }
        Write(Passwd, FormatPasswd(db.Passwd));
        Write(Group, FormatGroup(db.Group));
        Write(Shadow, FormatShadow(db.Shadow));
    }

    /// <summary>Days since 1970-01-01, as in /etc/shadow.</summary>
    public static int Today() => (int)Math.Floor(Js.Now() / 86_400_000.0);

    public const int UidMin = 1000;
    public const int UidMax = 60000;
    public const int SysUidMin = 100;
    public const int SysUidMax = 999;

    /// <summary>The next free UID: one more than the highest one used in the range (like useradd).</summary>
    public static int NextId(List<int> used, bool system)
    {
        if (system)
        {
            for (int id = SysUidMax; id >= SysUidMin; id--) if (!used.Contains(id)) return id;
            return SysUidMax;
        }
        var inRange = used.Where(n => n >= UidMin && n <= UidMax).ToList();
        return inRange.Count > 0 ? inRange.Max() + 1 : UidMin;
    }

    private static readonly Regex ValidNameRe = new(@"^[a-z_][a-z0-9_-]*\$?\z", RegexOptions.CultureInvariant);

    public static bool ValidName(string name) => ValidNameRe.IsMatch(name) && name.Length <= 32;

    // ---------- Passwords ----------

    private const string SaltChars = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

    private static string Digest(string text, int length)
    {
        // No real cryptography – just a deterministic "hash" that looks like yescrypt.
        uint h1 = 0x811c9dc5;
        uint h2 = 0x01000193;
        var @out = new StringBuilder();
        for (int round = 0; @out.Length < length; round++)
        {
            for (int i = 0; i < text.Length; i++)
            {
                uint c = (uint)(text[i] + round);
                unchecked
                {
                    h1 = (h1 ^ c) * 0x01000193u;
                    h2 = (h2 ^ (c + h1)) * 0x5bd1e995u;
                }
            }
            @out.Append(SaltChars[(int)(h1 % 64)]).Append(SaltChars[(int)(h2 % 64)]).Append(SaltChars[(int)((h1 >> 8) % 64)]);
        }
        return @out.ToString().Slice(0, length);
    }

    public static string HashPassword(string password, string? salt = null)
    {
        var s = salt ?? string.Concat(Enumerable.Range(0, 22).Select(_ => SaltChars[(int)Math.Floor(Js.Random() * 64)]));
        return $"$y$j9T${s}${Digest(s + password, 43)}";
    }

    private static readonly Regex HashRe = new(@"^\$y\$j9T\$([^$]+)\$", RegexOptions.CultureInvariant);

    public static bool CheckPassword(string hash, string password)
    {
        var m = HashRe.Match(hash);
        return m.Success && HashPassword(password, m.Groups[1].Value) == hash;
    }

    /// <summary>"P" (has a password), "L" (locked) or "NP" (no password).</summary>
    public static string PasswordStatus(string hash)
    {
        if (hash == "") return "NP";
        if (hash.StartsWith('!') || hash.StartsWith('*')) return "L";
        return "P";
    }

    /// <summary>The password field in /etc/shadow, or null if the user is missing there.</summary>
    public static string? ShadowHash(Shell sh, string name) => LoadDb(sh).Shadow.Find(s => s.Name == name)?.Hash;

    /// <summary>Checks a password against /etc/shadow (used by su).</summary>
    public static bool VerifyPassword(Shell sh, string name, string password)
    {
        var entry = LoadDb(sh).Shadow.Find(s => s.Name == name);
        if (entry is null) return false;
        if (entry.Hash == "") return true;
        return CheckPassword(entry.Hash, password);
    }

    // ---------- Switching user ----------

    /// <summary>
    /// Makes <paramref name="name"/> the active user (su, sudo -i). `exit` takes you back.
    /// With login (su -, sudo -i) you end up in the user's home directory.
    /// </summary>
    public static void SwitchUser(Shell sh, string name, bool login, Action<string> warn)
    {
        var entry = FindUser(sh, name);
        var user = sh.GetUser(name);
        sh.UserStack.Add(name);
        sh.Env["USER"] = name;
        sh.Env["LOGNAME"] = name;
        sh.Env["HOME"] = user.Home;
        if (!string.IsNullOrEmpty(entry?.Shell)) sh.Env["SHELL"] = entry.Shell;
        if (!login) return;
        var home = sh.Vfs.TryLookup(user.Home, user);
        if (home?.Type == "dir") sh.Cwd = user.Home;
        else warn($"cannot change directory to {user.Home}: No such file or directory");
    }

    private static readonly Regex NologinRe = new(@"/(nologin|false)\z", RegexOptions.CultureInvariant);

    /// <summary>Shells you cannot log in with (system users).</summary>
    public static bool IsNologin(string shell) => NologinRe.IsMatch(shell);
}
