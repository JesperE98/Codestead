namespace Codestead.Shell.Commands;

// The getent command: look up users, groups and host names.

public static partial class UsersCmd
{
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
}
