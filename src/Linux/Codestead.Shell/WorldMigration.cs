using Codestead.Shell.Commands;

namespace Codestead.Shell;

// Changing the language of a computer that is already in use (see World.cs): when the student switches
// language, the exercise files, the folders and the user are renamed and the untouched files get the text
// of the new language. What the student has written or changed stays as it is, and so do git repositories
// (renaming or rewriting tracked files would show up as changes in git).
//
// Terminals saved before the world existed are Swedish and use the old program names (minserver,
// rapportd); MigrateLegacy brings them up to date first.

public static class WorldMigration
{
    /// <summary>The world of terminals saved before there was one.</summary>
    public const string LegacyWorld = "sv";

    /// <summary>
    /// Translates the student's computer to <paramref name="lang"/>: names and untouched contents of the
    /// exercise files, the user name (passwd, group, shadow, the home directory, file owners, processes,
    /// the journal) and $LANG.
    /// </summary>
    public static void Translate(Shell sh, string lang)
    {
        var from = sh.World;
        var to = World.Get(lang);
        if (from.Lang == to.Lang) return;

        var names = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (key, oldName) in from.Names)
            if (key != "user" && to.Names.TryGetValue(key, out var newName) && newName != oldName) names.TryAdd(oldName, newName);
        var contents = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (key, oldText) in from.Files)
            if (to.Files.TryGetValue(key, out var newText) && newText != oldText) contents.TryAdd(oldText, newText);
        // The downloaded AppImage carries its name inside.
        var oldApp = UniversalCmd.AppImageNode(from, "root").Content;
        var newApp = UniversalCmd.AppImageNode(to, "root").Content;
        if (oldApp is not null && newApp is not null && oldApp != newApp) contents.TryAdd(oldApp, newApp);

        var root = sh.RootUser();
        var renamedPaths = new Dictionary<string, string>(StringComparer.Ordinal);

        // oldPath is where the folder was, newPath where it is now (a parent may have been renamed).
        void Walk(FsNode dir, string oldPath, string newPath)
        {
            if (dir.Children is null) return;
            // A git work tree is left as it is (the folder itself may still be renamed by its parent).
            if (dir.Children.ContainsKey(".git")) return;
            foreach (var name in dir.Children.Keys.ToList())
            {
                var node = dir.Children[name];
                var current = name;
                if (names.TryGetValue(name, out var renamed) && !dir.Children.ContainsKey(renamed))
                {
                    RenameChild(dir, name, renamed);
                    current = renamed;
                }
                if (oldPath != "" && (current != name || oldPath != newPath)) renamedPaths[$"{oldPath}/{name}"] = $"{newPath}/{current}";
                if (node.Type == "file" && node.Content is not null && contents.TryGetValue(node.Content, out var text))
                {
                    node.Content = text;
                    node.Size = null;
                }
                else if (node.Type == "dir") Walk(node, oldPath == "" ? "" : $"{oldPath}/{name}", oldPath == "" ? "" : $"{newPath}/{current}");
            }
        }

        var home = sh.Vfs.TryLookup(from.Home, root);
        if (home?.Type == "dir") Walk(home, from.Home, from.Home);
        foreach (var mountDir in new[] { "/mnt", "/media" })
            if (sh.Vfs.TryLookup(mountDir, root) is { Type: "dir" } m) Walk(m, mountDir, mountDir);
        // The partitions' own copies (a stick that is not mounted): no paths to follow.
        foreach (var disk in sh.Disks.Disks)
            foreach (var part in disk.Partitions)
                if (part.Root is not null) Walk(part.Root, "", "");

        // Which exercise files were already put in place (see Shell.AddMissingDefaults) follows the new names,
        // and so does the working directory if it is in a renamed folder.
        RenameFlagPaths(sh, renamedPaths);
        string Moved(string p)
        {
            var hit = renamedPaths.Keys
                .Where(r => p == r || p.StartsWith(r + "/", StringComparison.Ordinal))
                .OrderByDescending(r => r.Length)
                .FirstOrDefault();
            return hit is null ? p : renamedPaths[hit] + p[hit.Length..];
        }
        void MoveEnv(OrderedDictionary<string, string> env)
        {
            foreach (var k in new[] { "PWD", "OLDPWD" }) if (env.TryGetValue(k, out var v)) env[k] = Moved(v);
        }
        sh.Cwd = Moved(sh.Cwd);
        MoveEnv(sh.Env);
        foreach (var frame in sh.ShellStack)
        {
            frame.Saved.Cwd = Moved(frame.Saved.Cwd);
            MoveEnv(frame.Saved.Env);
        }

        if (from.User != to.User) RenameUser(sh, from, to);

        if (sh.Env.TryGetValue("LANG", out var l) && l == from.Locale) sh.Env["LANG"] = to.Locale;
        sh.World = to;
    }

    private static void RenameChild(FsNode dir, string oldName, string newName)
    {
        var kids = Js.Obj<FsNode>();
        foreach (var (k, v) in dir.Children!) kids[k == oldName ? newName : k] = v;
        dir.Children = kids;
    }

    private static void RenameFlagPaths(Shell sh, Dictionary<string, string> renamedPaths)
    {
        if (renamedPaths.Count == 0) return;
        const string prefix = "default:file:";
        foreach (var key in sh.Flags.Keys.Where(k => k.StartsWith(prefix, StringComparison.Ordinal)).ToList())
        {
            var path = key[prefix.Length..];
            // The longest renamed folder that the path is in (or the path itself).
            var hit = renamedPaths.Keys
                .Where(p => path == p || path.StartsWith(p + "/", StringComparison.Ordinal))
                .OrderByDescending(p => p.Length)
                .FirstOrDefault();
            if (hit is null) continue;
            var value = sh.Flags[key];
            sh.Flags.Remove(key);
            sh.Flags[prefix + renamedPaths[hit] + path[hit.Length..]] = value;
        }
    }

    /// <summary>Renames the student's account everywhere it is stored.</summary>
    private static void RenameUser(Shell sh, World from, World to)
    {
        var (oldUser, newUser) = (from.User, to.User);
        var (oldHome, newHome) = (from.Home, to.Home);
        var root = sh.RootUser();
        string Path(string p) => p == oldHome ? newHome : p.StartsWith(oldHome + "/", StringComparison.Ordinal) ? newHome + p[oldHome.Length..] : p;

        // passwd, shadow, group and gshadow: the name, the full name, the home directory and group memberships.
        string Fields(string content, Func<string[], string[]> edit) =>
            string.Join("\n", content.Split('\n').Select(line =>
            {
                if (line == "" || line.StartsWith('#')) return line;
                return string.Join(":", edit(line.Split(':')));
            }));
        void EditFile(string file, Func<string[], string[]> edit)
        {
            var node = sh.Vfs.TryLookup(file, root);
            if (node?.Type == "file" && node.Content is not null) node.Content = Fields(node.Content, edit);
        }
        EditFile("/etc/passwd", f =>
        {
            if (f[0] != oldUser) return f;
            f[0] = newUser;
            if (f.Length > 4 && f[4] == $"{from["userFull"]},,,") f[4] = $"{to["userFull"]},,,";
            if (f.Length > 5) f[5] = Path(f[5]);
            return f;
        });
        foreach (var file in new[] { "/etc/shadow", "/etc/gshadow" })
            EditFile(file, f =>
            {
                if (f[0] == oldUser) f[0] = newUser;
                for (int i = 2; i < f.Length; i++) f[i] = MemberList(f[i], oldUser, newUser);
                return f;
            });
        EditFile("/etc/group", f =>
        {
            if (f[0] == oldUser) f[0] = newUser;
            if (f.Length > 3) f[3] = MemberList(f[3], oldUser, newUser);
            return f;
        });

        // The home directory, and the user's mail and cron files.
        var homes = sh.Vfs.TryLookup("/home", root);
        if (homes?.Children is not null && homes.Children.ContainsKey(oldUser) && !homes.Children.ContainsKey(newUser))
            RenameChild(homes, oldUser, newUser);
        foreach (var spool in new[] { "/var/mail", "/var/spool/mail", "/var/spool/cron/crontabs", "/var/spool/cron" })
        {
            var d = sh.Vfs.TryLookup(spool, root);
            if (d?.Children is not null && d.Children.ContainsKey(oldUser) && !d.Children.ContainsKey(newUser)) RenameChild(d, oldUser, newUser);
        }

        // Owners of every file.
        void Owners(FsNode n)
        {
            if (n.Owner == oldUser) n.Owner = newUser;
            if (n.Group == oldUser) n.Group = newUser;
            if (n.Children is not null) foreach (var c in n.Children.Values) Owners(c);
        }
        Owners(sh.Vfs.Root);

        // The session: environment, working directory, logged-in users, saved shells.
        void Env(OrderedDictionary<string, string> env)
        {
            foreach (var k in env.Keys.ToList())
            {
                var v = env[k];
                if ((k == "USER" || k == "LOGNAME") && v == oldUser) env[k] = newUser;
                else if (k is "HOME" or "PWD" or "OLDPWD") env[k] = Path(v);
            }
        }
        Env(sh.Env);
        sh.Cwd = Path(sh.Cwd);
        for (int i = 0; i < sh.UserStack.Count; i++) if (sh.UserStack[i] == oldUser) sh.UserStack[i] = newUser;
        foreach (var frame in sh.ShellStack)
        {
            Env(frame.Saved.Env);
            frame.Saved.Cwd = Path(frame.Saved.Cwd);
        }

        // Processes and the system journal.
        var word = new Regex($@"(?<![\w-]){Regex.Escape(oldUser)}(?![\w-])", RegexOptions.CultureInvariant);
        foreach (var p in sh.Proc.Procs)
        {
            if (p.User == oldUser) p.User = newUser;
            p.Cmd = p.Cmd.Replace(oldHome + "/", newHome + "/", StringComparison.Ordinal);
        }
        foreach (var e in sh.Services.Journal) e.Msg = word.Replace(e.Msg.Replace(oldHome, newHome, StringComparison.Ordinal), newUser);

        // Flags that carry the user name or a path in the home directory.
        foreach (var key in sh.Flags.Keys.ToList())
        {
            var renamed = word.Replace(key.Replace(oldHome, newHome, StringComparison.Ordinal), newUser);
            if (renamed == key) continue;
            var value = sh.Flags[key];
            sh.Flags.Remove(key);
            sh.Flags[renamed] = value;
        }
    }

    private static string MemberList(string field, string oldUser, string newUser) =>
        field.Contains(oldUser, StringComparison.Ordinal)
            ? string.Join(",", field.Split(',').Select(m => m == oldUser ? newUser : m))
            : field;

    // ---------- Terminals saved before the world ----------

    /// <summary>Old program names and Swedish system texts, as they were saved.</summary>
    private static readonly (string Old, string New)[] LegacyText =
    {
        ("minserver", "myserver"),
        ("Minserver", "Myserver"),
        ("rapportd", "reportd"),
        ("USBMINNE", "USBSTICK"),
        ("Rapportd", "Reportd"),
        ("# Exempelkonfiguration för reportd.", "# Example configuration for reportd."),
        ("# Kopiera den till /etc/reportd.conf och ändra efter behov:", "# Copy it to /etc/reportd.conf and change it as needed:"),
        ("rapportkatalog = ", "report_dir = "),
        ("intervall = ", "interval = "),
        ("# Reportd skapar rapporter varje timme. Installerad av administratören.", "# reportd creates reports every hour. Installed by the administrator."),
        ("# Övningsservern från kapitlet om processer.", "# The practice server from the chapter about processes."),
        ("(simulerad binärfil: ", "(simulated binary: "),
        ("(simulerade programfiler)", "(simulated program files)"),
        ("hsqs (simulerad squashfs-avbild)", "hsqs (simulated squashfs image)"),
        ("(simulerad ikon)", "(simulated icon)"),
        ("(simulerat bibliotek)", "(simulated library)"),
        ("(simulerad privat nyckel – visa den aldrig för någon!)", "(simulated private key - never show it to anyone!)"),
        ("(simulerad bild)", "(simulated image)"),
        ("(kärnan – simulerad)", "(the kernel - simulated)"),
        ("(simulerad) #1 SMP", "(simulated) #1 SMP"),
        ("Simulerad CPU @", "Simulated CPU @"),
        ("...simulerad...hash", "...simulated...hash"),
        ("# Se sudoers(5). Redigera alltid med visudo!", "# See sudoers(5). Always edit with visudo!"),
        ("# /etc/login.defs – inställningar för useradd, passwd m.fl. (utdrag)", "# /etc/login.defs - settings for useradd, passwd and others (excerpt)"),
    };

    /// <summary>Whole files that were Swedish and are English now (programs write English).</summary>
    private static readonly (string Old, string New)[] LegacyFiles =
    {
        ("""
            2026-10-28 08:00:01 INFO  Servern startar
            2026-10-28 08:00:02 INFO  Läser konfiguration från /etc/myserver.conf
            2026-10-28 08:00:02 WARN  Konfigurationsnyckeln "timeout" saknas, använder 30s
            2026-10-28 08:00:03 INFO  Lyssnar på port 8080
            2026-10-28 09:14:55 INFO  GET /index.html 200
            2026-10-28 09:15:10 ERROR Kunde inte ansluta till databasen
            2026-10-28 09:15:11 INFO  Försöker igen om 5 sekunder
            2026-10-28 09:15:16 INFO  Ansluten till databasen
            2026-10-28 11:42:03 WARN  Långsam förfrågan: GET /rapport tog 4.2s
            2026-10-28 12:01:37 INFO  GET /om.html 200
            2026-10-28 13:30:00 ERROR Disken /var är 95% full
            2026-10-28 14:05:12 INFO  GET /bilder/logo.png 404
            2026-10-28 16:20:44 warn  Certifikatet går ut om 14 dagar
            2026-10-28 18:00:00 ERROR Tidsgräns överskriden för jobbet "backup"
            2026-10-28 23:59:59 INFO  Dagens loggar roteras

            """, InitfsLib.ServerLog),
        ("""
            # ~/.bashrc: körs av bash för interaktiva skal.
            # Här brukar man lägga alias och egna inställningar.

            # Exempel:
            # alias ll='ls -la'
            # export EDITOR=nano

            """, InitfsLib.Bashrc),
        ("""
            # ~/.profile: körs av inloggningsskal.
            if [ -d "$HOME/bin" ] ; then
                PATH="$HOME/bin:$PATH"
            fi

            """, InitfsLib.Profile),
    };

    /// <summary>Brings a terminal saved before the world existed up to date. It is Swedish afterwards.</summary>
    public static ShellSnapshot MigrateLegacy(ShellSnapshot s)
    {
        var json = Js.Stringify(s);
        foreach (var (o, n) in LegacyText) json = json.Replace(Js.Stringify(o)[1..^1], Js.Stringify(n)[1..^1], StringComparison.Ordinal);
        var migrated = Js.Parse<ShellSnapshot>(json)!;
        var files = LegacyFiles.ToDictionary(f => f.Old, f => f.New, StringComparer.Ordinal);
        void Walk(FsNode n)
        {
            if (n.Type == "file" && n.Content is not null && files.TryGetValue(n.Content, out var text))
            {
                n.Content = text;
                n.Size = null;
            }
            if (n.Children is not null) foreach (var c in n.Children.Values) Walk(c);
        }
        Walk(migrated.Fs);
        migrated.World = LegacyWorld;
        return migrated;
    }
}
