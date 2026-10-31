namespace Codestead.Shell.Commands;

// Port of src/shell/commands/universal.ts
// Universal package formats that work on every distribution: Flatpak, Snap and AppImage.
// All state lives in the virtual file system, just like on a real system:
//   Flatpak: /var/lib/flatpak (system) and ~/.local/share/flatpak (--user)
//   Snap:    /snap/<name>/<revision> and /snap/bin
//   AppImage: a single executable file, e.g. ~/Downloads/Calculator.AppImage
// Graphical programs cannot be shown in the simulator – they print a dimmed line instead.

public static partial class UniversalCmd
{
    private static bool IsRoot(Shell sh) => sh.CurrentUser().Uid == 0;
    private static string Dim(Shell sh, string key, params (string Name, object? Value)[] args) => $"{UtilCmd.Color.Dim}{sh.Msg(key, args)}{UtilCmd.Color.Reset}\n";
    private static bool Flag(Shell sh, string key) => sh.Flags.TryGetValue(key, out var v) && v;

    /// <summary>The line shown instead of a window.</summary>
    private static string WindowNote(Shell sh, string app) =>
        Dim(sh, "universal.graphicalApp", ("app", app));

    private static FsNode SimBinary(string impl, string owner = "root", int mode = -1, string? group = null, string extra = "")
    {
        var node = VfsLib.MakeFile($"{VfsLib.Elf}\u0002\u0001\u0001 (simulated binary: {impl})\n{extra}", owner, mode < 0 ? Js.Oct(755) : mode, group ?? owner);
        node.Size = 40_000;
        return node;
    }

    private static FsNode? TryNode(Shell sh, string path) => sh.Vfs.TryLookup(path, sh.RootUser());
    private static List<string> Children(Shell sh, string path) => (TryNode(sh, path)?.Children?.Keys ?? Enumerable.Empty<string>()).ToList().SortJs();

    private static OrderedDictionary<string, FsNode> Kids(params (string Name, FsNode Node)[] items)
    {
        var d = Js.Obj<FsNode>();
        foreach (var (name, node) in items) d[name] = node;
        return d;
    }

    // ================================================================ Flatpak

    private sealed class FlatpakApp
    {
        public required string Id { get; init; }
        public required string Name { get; init; }
        public required string Summary { get; init; }
        public required string Version { get; init; }
        public required string Branch { get; init; }
        public required string Runtime { get; init; }
        /// <summary>MB to download.</summary>
        public int SizeMb { get; init; }
        /// <summary>Excerpt of the permissions (the sandbox).</summary>
        public required List<string> Permissions { get; init; }
        /// <summary>Also in Fedora's own Flatpak remote.</summary>
        public bool InFedora { get; init; }
    }

    private sealed class FlatpakRuntime
    {
        public required string Id { get; init; }
        public required string Name { get; init; }
        public required string Branch { get; init; }
        public int SizeMb { get; init; }
    }

    private static readonly Dictionary<string, FlatpakRuntime> Runtimes = new()
    {
        ["org.gnome.Platform//49"] = new FlatpakRuntime { Id = "org.gnome.Platform", Name = "GNOME Application Platform version 49", Branch = "49", SizeMb = 381 },
        ["org.freedesktop.Platform//25.08"] = new FlatpakRuntime { Id = "org.freedesktop.Platform", Name = "Freedesktop Platform", Branch = "25.08", SizeMb = 245 },
        ["org.kde.Platform//6.9"] = new FlatpakRuntime { Id = "org.kde.Platform", Name = "KDE Application Platform", Branch = "6.9", SizeMb = 412 },
    };

    private static readonly List<FlatpakApp> Flathub = new()
    {
        new FlatpakApp { Id = "org.gimp.GIMP", Name = "GNU Image Manipulation Program", Summary = "Create images and edit photographs", Version = "3.0.6", Branch = "stable", Runtime = "org.gnome.Platform//49", SizeMb = 130, Permissions = new() { "ipc", "network", "x11", "wayland", "dri", "file access: host" }, InFedora = true },
        new FlatpakApp { Id = "org.videolan.VLC", Name = "VLC", Summary = "VLC media player, the open-source multimedia player", Version = "3.0.21", Branch = "stable", Runtime = "org.kde.Platform//6.9", SizeMb = 92, Permissions = new() { "ipc", "network", "pulseaudio", "x11", "wayland", "dri", "file access: host" } },
        new FlatpakApp { Id = "org.mozilla.firefox", Name = "Firefox", Summary = "Fast, Private & Safe Web Browser", Version = "144.0", Branch = "stable", Runtime = "org.freedesktop.Platform//25.08", SizeMb = 105, Permissions = new() { "ipc", "network", "pulseaudio", "wayland", "x11", "dri", "file access: xdg-download" } },
        new FlatpakApp { Id = "org.libreoffice.LibreOffice", Name = "LibreOffice", Summary = "The LibreOffice productivity suite", Version = "25.8.2.2", Branch = "stable", Runtime = "org.freedesktop.Platform//25.08", SizeMb = 312, Permissions = new() { "ipc", "network", "x11", "wayland", "dri", "file access: host" }, InFedora = true },
        new FlatpakApp { Id = "org.inkscape.Inkscape", Name = "Inkscape", Summary = "Vector Graphics Editor", Version = "1.4.2", Branch = "stable", Runtime = "org.gnome.Platform//49", SizeMb = 118, Permissions = new() { "ipc", "x11", "wayland", "dri", "file access: host" } },
        new FlatpakApp { Id = "com.spotify.Client", Name = "Spotify", Summary = "Online music streaming service", Version = "1.2.74.477", Branch = "stable", Runtime = "org.freedesktop.Platform//25.08", SizeMb = 180, Permissions = new() { "ipc", "network", "pulseaudio", "x11", "dri", "file access: xdg-music:ro" } },
        new FlatpakApp { Id = "org.kde.krita", Name = "Krita", Summary = "Digital Painting, Creative Freedom", Version = "5.2.13", Branch = "stable", Runtime = "org.kde.Platform//6.9", SizeMb = 205, Permissions = new() { "ipc", "x11", "wayland", "dri", "file access: host" } },
    };

    private const string FlathubUrl = "https://dl.flathub.org/repo/flathub.flatpakrepo";
    private const string FedoraRemote = "oci+https://registry.fedoraproject.org";

    // Inst is "system" or "user".
    private static string InstBase(Shell sh, string inst) => inst == "system" ? "/var/lib/flatpak" : $"{sh.Home}/.local/share/flatpak";
    private static string ConfigPath(Shell sh, string inst) => $"{InstBase(sh, inst)}/repo/config";

    /// <summary>Creates a directory (with parents) as the right user: root for the system, the student for --user.</summary>
    private static void MkdirsAs(Shell sh, string path, string inst)
    {
        if (inst == "system")
        {
            ExtrarepoLib.EnsureDir(sh, path);
            return;
        }
        var user = sh.CurrentUser();
        var cur = "";
        foreach (var seg in path.Split('/').Where(s => s != ""))
        {
            cur += "/" + seg;
            if (sh.Vfs.TryLookup(cur, user) is null) sh.Vfs.Mkdir(cur, user);
        }
    }

    /// <summary>Fedora Workstation has Flatpak and Fedora's own remote from the start.</summary>
    private static void FlatpakSeed(Shell sh)
    {
        if (Flag(sh, "flatpak:seeded")) return;
        sh.Flags["flatpak:seeded"] = true;
        if (sh.Distro.Family != "redhat" || TryNode(sh, ConfigPath(sh, "system")) is not null) return;
        ExtrarepoLib.EnsureDir(sh, "/var/lib/flatpak/repo");
        sh.Vfs.WriteFile(ConfigPath(sh, "system"), $"[core]\nrepo_version=1\nmode=bare-user-only\n\n[remote \"fedora\"]\nurl={FedoraRemote}\nurl-is-set=true\ncollection-id=org.fedoraproject.Stable\n", sh.RootUser());
    }

    private static readonly Regex RemoteHeader = new(@"^\[remote ""([^""]+)""\]", RegexOptions.Multiline | RegexOptions.CultureInvariant);

    private static List<string> Remotes(Shell sh, string inst)
    {
        var c = TryNode(sh, ConfigPath(sh, inst))?.Content ?? "";
        return RemoteHeader.Matches(c).Select(m => m.Groups[1].Value).ToList();
    }

    private static List<FlatpakApp> RemoteApps(string remote)
    {
        if (remote == "flathub") return Flathub;
        if (remote == "fedora") return Flathub.Where(a => a.InFedora).ToList();
        return new List<FlatpakApp>();
    }

    private sealed class InstalledRef
    {
        public required string Ref { get; init; }
        public required string Inst { get; init; }
        /// <summary>"app" or "runtime".</summary>
        public required string Kind { get; init; }
        public required string Id { get; init; }
        public required string Branch { get; init; }
        public required string Meta { get; init; }
    }

    private static List<InstalledRef> InstalledRefs(Shell sh)
    {
        var result = new List<InstalledRef>();
        foreach (var inst in new[] { "system", "user" })
        {
            var @base = InstBase(sh, inst);
            foreach (var kind in new[] { "app", "runtime" })
            {
                foreach (var id in Children(sh, $"{@base}/{kind}"))
                {
                    foreach (var branch in Children(sh, $"{@base}/{kind}/{id}/x86_64"))
                    {
                        var meta = TryNode(sh, $"{@base}/{kind}/{id}/x86_64/{branch}/active/metadata")?.Content ?? "";
                        result.Add(new InstalledRef { Ref = $"{kind}/{id}/x86_64/{branch}", Inst = inst, Kind = kind, Id = id, Branch = branch, Meta = meta });
                    }
                }
            }
        }
        return result;
    }

    private static string MetaValue(string meta, string key)
    {
        var m = Regex.Match(meta, $"^{key}=(.*)$", RegexOptions.Multiline | RegexOptions.CultureInvariant);
        return m.Success ? m.Groups[1].Value : "";
    }

    /// <summary>Finds an app in flatpak's remotes: exact id, or a unique name/last part of the id (e.g. "gimp").</summary>
    private static FlatpakApp? MatchApp(string query, List<FlatpakApp> apps)
    {
        var q = query.ToLowerInvariant();
        var exact = apps.FirstOrDefault(a => a.Id.ToLowerInvariant() == q);
        if (exact is not null) return exact;
        var loose = apps.Where(a => a.Id.ToLowerInvariant().Split('.')[^1] == q || a.Name.ToLowerInvariant() == q).ToList();
        return loose.Count == 1 ? loose[0] : null;
    }

    private static void WriteRef(Shell sh, string inst, string kind, string id, string branch, string meta, int sizeMb)
    {
        var dir = $"{InstBase(sh, inst)}/{kind}/{id}/x86_64/{branch}/active";
        MkdirsAs(sh, dir, inst);
        var user = inst == "system" ? sh.RootUser() : sh.CurrentUser();
        sh.Vfs.WriteFile($"{dir}/metadata", meta, user);
        var files = sh.Vfs.Lookup(dir, user);
        var blob = VfsLib.MakeFile("(simulated program files)\n", user.Name, Js.Oct(644), user.Groups.FirstOrDefault());
        blob.Size = sizeMb * 1_000_000L;
        files.Children!["files"] = VfsLib.MakeDir(user.Name, Js.Oct(755), Kids(("program.bin", blob)), user.Groups.FirstOrDefault());
    }

    private const string FlatpakManSv = $"""
NAMN
       flatpak - installera och kör program i en sandlåda

SYNOPSIS
       flatpak KOMMANDO [FLAGGOR] [ARGUMENT]

BESKRIVNING
       Flatpak är ett paketformat för skrivbordsprogram som fungerar i alla
       distributioner. Programmen kommer från en "remote" – oftast Flathub –
       och körs i en sandlåda med bara de behörigheter de bett om. Gemensamma
       bibliotek finns i delade "runtimes" (t.ex. org.gnome.Platform).

       Program kan installeras för hela systemet (standard) eller bara för
       dig med --user. Användarinstallationen har egna remotes.

KOMMANDON
       remote-add NAMN URL    lägg till en källa (remote)
       remotes                lista källorna
       search ORD             sök efter program
       install REMOTE ID      installera ett program
       list                   lista installerade program och runtimes
       run ID                 starta ett program
       info ID                visa information om ett installerat program
       update                 uppdatera allt
       uninstall ID           ta bort ett program
       uninstall --unused     ta bort runtimes som inget program använder

FLAGGOR
       --user            använd din egen installation i ~/.local/share/flatpak
       --system          använd systemets installation (standard)
       --if-not-exists   inget fel om källan redan finns (remote-add)
       -y, --assumeyes   svara ja på frågor
       --app, --runtime  visa bara program eller runtimes (list)

EXEMPEL
       flatpak remote-add --if-not-exists flathub {FlathubUrl}
       flatpak install flathub org.gimp.GIMP
       flatpak run org.gimp.GIMP
""";

    private const string FlatpakManEn = $"""
NAME
       flatpak - install and run applications in a sandbox

SYNOPSIS
       flatpak COMMAND [OPTIONS] [ARGUMENTS]

DESCRIPTION
       Flatpak is a package format for desktop applications that works on
       every distribution. Applications come from a "remote" - usually
       Flathub - and run in a sandbox with only the permissions they asked
       for. Common libraries live in shared "runtimes" (e.g.
       org.gnome.Platform).

       Applications can be installed for the whole system (the default) or
       just for you with --user. The user installation has its own remotes.

COMMANDS
       remote-add NAME URL    add a source (remote)
       remotes                list the remotes
       search WORD            search for applications
       install REMOTE ID      install an application
       list                   list installed applications and runtimes
       run ID                 start an application
       info ID                show information about an installed app
       update                 update everything
       uninstall ID           remove an application
       uninstall --unused     remove runtimes no application uses

OPTIONS
       --user            use your own installation in ~/.local/share/flatpak
       --system          use the system installation (the default)
       --if-not-exists   no error if the remote already exists (remote-add)
       -y, --assumeyes   answer yes to questions
       --app, --runtime  only show applications or runtimes (list)

EXAMPLES
       flatpak remote-add --if-not-exists flathub {FlathubUrl}
       flatpak install flathub org.gimp.GIMP
       flatpak run org.gimp.GIMP
""";

    private static readonly CommandDef Flatpak = new()
    {
        Name = "flatpak",
        Summary = "Installerar och kör program i sandlåda (Flatpak/Flathub)",
        SummaryEn = "Installs and runs sandboxed applications (Flatpak/Flathub)",
        Man = FlatpakManSv,
        ManEn = FlatpakManEn,
        Run = RunFlatpak,
    };

    private static readonly Regex UnrecognizedRe = new("^unrecognized option", RegexOptions.CultureInvariant);
    private static readonly Regex EpochRe = new(@"^[0-9]+:", RegexOptions.CultureInvariant);
    private static readonly Regex FlathubRepoFile = new(@"flathub\.org/repo/flathub\.flatpakrepo\z", RegexOptions.CultureInvariant);
    private static readonly Regex FlathubRepoDir = new(@"dl\.flathub\.org/repo/?\z", RegexOptions.CultureInvariant);
    private static readonly Regex AppPrefix = new("^app/", RegexOptions.CultureInvariant);

    private static int RunFlatpak(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        FlatpakSeed(sh);
        var cmd = ctx.Args.Count > 0 ? ctx.Args[0] : null;
        var rest = ctx.Args.Skip(1).ToList();
        if (string.IsNullOrEmpty(cmd) || cmd == "--help" || cmd == "-h")
        {
            ctx.Out("Usage:\n  flatpak [OPTION…] COMMAND\n\nBuiltin Commands:\n Manage installed applications and runtimes\n  install        Install an application or runtime\n  update         Update an installed application or runtime\n  uninstall      Uninstall an installed application or runtime\n  list           List installed apps and/or runtimes\n  info           Show info for installed app or runtime\n  run            Run an application\n  search         Search for remote apps/runtimes\n  remotes        List all configured remotes\n  remote-add     Add a new remote repository (by URL)\n  remote-delete  Delete a configured remote\n");
            return !string.IsNullOrEmpty(cmd) ? 0 : 1;
        }
        if (cmd == "--version")
        {
            ctx.Out($"Flatpak {EpochRe.Replace(sh.Installed.Get("flatpak") ?? "1.16.1", "", 1).Split('-')[0]}\n");
            return 0;
        }
        var o = UtilCmd.ParseOpts(rest, new OptSpec
        {
            Flags = "y",
            Long = new()
            {
                ["user"] = "U", ["system"] = "S", ["if-not-exists"] = "E", ["assumeyes"] = "y", ["noninteractive"] = "y", ["app"] = "a",
                ["runtime"] = "r", ["unused"] = "u", ["show-permissions"] = "P", ["columns"] = "c", ["from"] = "F",
            },
            Values = "c",
        });
        if (o.Error is not null)
        {
            ctx.Err($"error: {UnrecognizedRe.Replace(o.Error, "Unknown option", 1)}\n");
            return 1;
        }
        var inst = o.Flags.Contains("U") ? "user" : "system";
        var where = inst == "system" ? "system" : "user";
        var args = o.Operands;

        void NeedRoot()
        {
            // On a desktop polkit asks for the password in a window; here we pretend you answered.
            if (inst == "system" && !IsRoot(sh) && !Flag(sh, "flatpak:polkitNote"))
            {
                sh.Flags["flatpak:polkitNote"] = true;
                ctx.Out(Dim(sh, "universal.flatpakPolkit"));
            }
        }

        switch (cmd)
        {
            case "remote-add":
            {
                var name = args.Count > 0 ? args[0] : null;
                var url = args.Count > 1 ? args[1] : null;
                if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(url))
                {
                    ctx.Err("error: NAME and LOCATION must be specified\n");
                    return 1;
                }
                if (Remotes(sh, inst).Contains(name))
                {
                    if (o.Flags.Contains("E")) return 0;
                    ctx.Err($"error: Remote {name} already exists\n");
                    return 1;
                }
                if (!FlathubRepoFile.IsMatch(url) && !FlathubRepoDir.IsMatch(url))
                {
                    ctx.Err($"error: Can't load uri {url}: Could not resolve hostname\n");
                    ctx.Err(Dim(sh, "universal.flathubOnly", ("url", FlathubUrl)));
                    return 1;
                }
                NeedRoot();
                var path = ConfigPath(sh, inst);
                MkdirsAs(sh, path.Slice(0, path.LastIndexOf('/')), inst);
                var user = inst == "system" ? sh.RootUser() : sh.CurrentUser();
                var old = TryNode(sh, path)?.Content ?? "[core]\nrepo_version=1\nmode=bare-user-only\n";
                sh.Vfs.WriteFile(path, $"{old}\n[remote \"{name}\"]\nurl=https://dl.flathub.org/repo/\ngpg-verify=true\ngpg-verify-summary=true\nxa.title=Flathub\nxa.homepage=https://flathub.org/\n", user);
                return 0;
            }
            case "remote-delete":
            {
                var name = args.Count > 0 ? args[0] : null;
                if (string.IsNullOrEmpty(name) || !Remotes(sh, inst).Contains(name))
                {
                    ctx.Err($"error: Remote \"{name ?? ""}\" not found\n");
                    return 1;
                }
                NeedRoot();
                var user = inst == "system" ? sh.RootUser() : sh.CurrentUser();
                var path = ConfigPath(sh, inst);
                var re = new Regex($@"\n?\[remote ""{name.Replace(".", "\\.")}""\][^\[]*", RegexOptions.CultureInvariant);
                var content = re.Replace(sh.Vfs.ReadFile(path, sh.RootUser()), "\n", 1);
                sh.Vfs.WriteFile(path, content, user);
                return 0;
            }
            case "remotes":
            case "remote-list":
            {
                var both = o.Flags.Contains("U") || o.Flags.Contains("S") ? new[] { inst } : new[] { "system", "user" };
                if (ctx.IsTTY) ctx.Out("Name    Options\n");
                foreach (var i in both) foreach (var r in Remotes(sh, i)) ctx.Out($"{r.PadRight(8)}{i}{(r == "fedora" ? ",oci" : "")}\n");
                return 0;
            }
            case "search":
            {
                var q = string.Join(" ", args).ToLowerInvariant();
                if (q == "")
                {
                    ctx.Err("error: TEXT must be specified\n");
                    return 1;
                }
                var rs = Remotes(sh, "system").Concat(Remotes(sh, "user")).Distinct().ToList();
                var hits = Flathub.Where(a => (a.Id + " " + a.Name + " " + a.Summary).ToLowerInvariant().Contains(q))
                    .Select(a => (A: a, In: rs.Where(r => RemoteApps(r).Contains(a)).ToList()))
                    .Where(h => h.In.Count != 0)
                    .ToList();
                if (hits.Count == 0)
                {
                    ctx.Out("No matches found\n");
                    if (rs.Count == 0) ctx.Out(Dim(sh, "universal.noRemotes"));
                    return 0;
                }
                if (ctx.IsTTY) ctx.Out("Name                              Description                                          Application ID                 Version    Branch  Remotes\n");
                foreach (var h in hits)
                {
                    ctx.Out($"{h.A.Name.PadRight(33)} {h.A.Summary.PadRight(52)} {h.A.Id.PadRight(30)} {h.A.Version.PadRight(10)} {h.A.Branch.PadRight(7)} {string.Join(",", h.In)}\n");
                }
                return 0;
            }
            case "install":
            {
                if (args.Count == 0)
                {
                    ctx.Err("error: At least one REF must be specified\n");
                    return 1;
                }
                var rs = Remotes(sh, inst);
                string? remote = null;
                var refs = args;
                if (args.Count > 1 && (rs.Contains(args[0]) || new[] { "flathub", "fedora", "flathub-beta" }.Contains(args[0])))
                {
                    remote = args[0];
                    refs = args.Skip(1).ToList();
                }
                ctx.Out("Looking for matches…\n");
                if (remote is not null && !rs.Contains(remote))
                {
                    ctx.Err($"error: No remote refs found for ‘{remote}’\n");
                    if (inst == "user" && Remotes(sh, "system").Contains(remote))
                    {
                        ctx.Err(Dim(sh, "universal.remoteSystemOnly", ("remote", remote)));
                    }
                    else
                    {
                        ctx.Err(Dim(sh, "universal.addRemoteFirst", ("url", FlathubUrl)));
                    }
                    return 1;
                }
                var plan = new List<(FlatpakApp App, string Remote)>();
                foreach (var r in refs)
                {
                    var searchIn = remote is not null ? new List<string> { remote } : rs;
                    var query = AppPrefix.Replace(r, "", 1).Split('/')[0];
                    var found = searchIn.Select(rem => (Rem: rem, App: MatchApp(query, RemoteApps(rem)))).FirstOrDefault(x => x.App is not null);
                    if (found.App is null)
                    {
                        ctx.Err($"error: Nothing matches {r} in {(remote is not null ? $"remote {remote}" : $"{where} installation")}\n");
                        return 1;
                    }
                    if (remote is null) ctx.Out($"Found ref ‘app/{found.App.Id}/x86_64/{found.App.Branch}’ in remote ‘{found.Rem}’ ({where}).\n");
                    if (InstalledRefs(sh).Any(i => i.Inst == inst && i.Id == found.App.Id))
                    {
                        ctx.Out($"Skipping: {found.App.Id}/x86_64/{found.App.Branch} is already installed\n");
                        continue;
                    }
                    plan.Add((found.App, found.Rem));
                }
                if (plan.Count == 0) return 0;
                NeedRoot();
                var have = InstalledRefs(sh).Where(i => i.Inst == inst && i.Kind == "runtime").Select(i => $"{i.Id}//{i.Branch}").ToList();
                var runtimes = plan.Select(p => p.App.Runtime).Distinct().Where(r => !have.Contains(r)).ToList();
                var rows = new List<string>();
                foreach (var rt in runtimes)
                {
                    var r = Runtimes[rt];
                    rows.Add($"{r.Id}.Locale".PadRight(43) + $" {r.Branch.PadRight(9)} i    {plan[0].Remote.PadRight(9)} < 18.5 kB");
                    rows.Add($"{r.Id}".PadRight(43) + $" {r.Branch.PadRight(9)} i    {plan[0].Remote.PadRight(9)} < {r.SizeMb} MB");
                }
                foreach (var p in plan) rows.Add($"{p.App.Id}".PadRight(43) + $" {p.App.Branch.PadRight(9)} i    {p.Remote.PadRight(9)} < {p.App.SizeMb} MB");
                foreach (var p in plan)
                {
                    ctx.Out($"\n{p.App.Id} permissions:\n    {string.Join("    ", p.App.Permissions)}\n");
                }
                ctx.Out($"\n        {"ID".PadRight(43)} {"Branch".PadRight(9)} Op   {"Remote".PadRight(9)} Download\n");
                for (int i = 0; i < rows.Count; i++) ctx.Out($" {(i + 1).ToString(CultureInfo.InvariantCulture).PadLeft(2)}. [ ] {rows[i]}\n");
                ctx.Out("\n");
                return ReposCmd.AskYesNo(
                    ctx,
                    $"Proceed with these changes to the {where} installation? [Y/n]: ",
                    true,
                    o.Flags.Contains("y"),
                    io =>
                    {
                        foreach (var rt in runtimes)
                        {
                            var r = Runtimes[rt];
                            WriteRef(sh, inst, "runtime", r.Id, r.Branch, $"[Runtime]\nname={r.Id}\nbranch={r.Branch}\ntitle={r.Name}\n", r.SizeMb);
                        }
                        foreach (var p in plan)
                        {
                            var runtime = ReplaceFirst(p.App.Runtime, "//", "/x86_64/");
                            var shared = string.Join(";", p.App.Permissions.Where(x => !x.Contains(':')));
                            WriteRef(sh, inst, "app", p.App.Id, p.App.Branch, $"[Application]\nname={p.App.Id}\ntitle={p.App.Name}\nversion={p.App.Version}\nruntime={runtime}\norigin={p.Remote}\n\n[Context]\nshared={shared};\n", p.App.SizeMb);
                        }
                        for (int i = 0; i < rows.Count; i++) io.Out($" {(i + 1).ToString(CultureInfo.InvariantCulture).PadLeft(2)}. [✓] {rows[i]}\n");
                        io.Out("\nInstallation complete.\n");
                        return 0;
                    },
                    io =>
                    {
                        io.Out("error: Aborted by user\n");
                        return 1;
                    });
            }
            case "list":
            {
                var list = InstalledRefs(sh);
                if (o.Flags.Contains("U")) list = list.Where(i => i.Inst == "user").ToList();
                if (o.Flags.Contains("S")) list = list.Where(i => i.Inst == "system").ToList();
                if (o.Flags.Contains("a")) list = list.Where(i => i.Kind == "app").ToList();
                if (o.Flags.Contains("r")) list = list.Where(i => i.Kind == "runtime").ToList();
                if (ctx.IsTTY && list.Count != 0) ctx.Out($"{"Name".PadRight(40)} {"Application ID".PadRight(30)} {"Version".PadRight(10)} {"Branch".PadRight(7)} Installation\n");
                foreach (var i in list)
                {
                    var title = MetaValue(i.Meta, "title");
                    if (title == "") title = i.Id;
                    var version = MetaValue(i.Meta, "version");
                    ctx.Out(ctx.IsTTY ? $"{title.PadRight(40)} {i.Id.PadRight(30)} {version.PadRight(10)} {i.Branch.PadRight(7)} {i.Inst}\n" : $"{title}\t{i.Id}\t{version}\t{i.Branch}\t{i.Inst}\n");
                }
                return 0;
            }
            case "info":
            {
                var id = args.Count > 0 ? args[0] : null;
                var i = InstalledRefs(sh).FirstOrDefault(x => x.Id == id || (id is not null && x.Id.ToLowerInvariant() == id.ToLowerInvariant()));
                if (string.IsNullOrEmpty(id) || i is null)
                {
                    ctx.Err($"error: {id ?? ""}/*unspecified*/*unspecified* not installed\n");
                    return 1;
                }
                if (o.Flags.Contains("P"))
                {
                    var parts = i.Meta.Split("[Context]");
                    var context = parts.Length > 1 ? parts[1].Trim() : "";
                    ctx.Out(context != "" ? $"[Context]\n{context}\n" : "");
                    return 0;
                }
                var title = MetaValue(i.Meta, "title");
                var version = MetaValue(i.Meta, "version");
                var origin = MetaValue(i.Meta, "origin");
                var runtime = MetaValue(i.Meta, "runtime");
                ctx.Out(
                    $"\n{(title != "" ? title : i.Id)}\n\n          ID: {i.Id}\n         Ref: {i.Ref}\n        Arch: x86_64\n      Branch: {i.Branch}\n" +
                    (version != "" ? $"     Version: {version}\n" : "") +
                    $"      Origin: {(origin != "" ? origin : "flathub")}\nInstallation: {i.Inst}\n" +
                    (i.Kind == "app" ? $"     Runtime: {runtime}\n     Sdk: {ReplaceFirst(runtime, "Platform", "Sdk")}\n" : "") +
                    "\n");
                return 0;
            }
            case "run":
            {
                var id = args.Count > 0 ? args[0] : null;
                if (string.IsNullOrEmpty(id))
                {
                    ctx.Err("error: APP must be specified\n");
                    return 1;
                }
                var i = InstalledRefs(sh).FirstOrDefault(x => x.Kind == "app" && x.Id == id);
                if (i is null)
                {
                    ctx.Err($"error: app/{id}/x86_64/master not installed\n");
                    return 1;
                }
                var title = MetaValue(i.Meta, "title");
                ctx.Out(WindowNote(sh, title != "" ? title : id));
                return 0;
            }
            case "update":
            case "upgrade":
            {
                ctx.Out("Looking for updates…\n");
                // Everything in the simulator is already the latest version.
                ctx.Out("Nothing to do.\n");
                return 0;
            }
            case "uninstall":
            case "remove":
            {
                var installed = InstalledRefs(sh).Where(i => i.Inst == inst).ToList();
                List<InstalledRef> targets;
                if (o.Flags.Contains("u"))
                {
                    var used = installed.Where(i => i.Kind == "app").Select(i => MetaValue(i.Meta, "runtime").Split("/x86_64/")).ToList();
                    targets = installed.Where(i => i.Kind == "runtime" && !used.Any(u => u[0] == i.Id && u.Length > 1 && u[1] == i.Branch)).ToList();
                    if (targets.Count == 0)
                    {
                        ctx.Out("Nothing unused to uninstall\n");
                        return 0;
                    }
                }
                else
                {
                    if (args.Count == 0)
                    {
                        ctx.Err("error: Must specify at least one REF, --unused, --all or --delete-data\n");
                        return 1;
                    }
                    targets = new List<InstalledRef>();
                    foreach (var a in args)
                    {
                        var i = installed.FirstOrDefault(x => x.Id == a);
                        if (i is null)
                        {
                            ctx.Err($"error: {a}/*unspecified*/*unspecified* not installed\n");
                            return 1;
                        }
                        targets.Add(i);
                    }
                }
                NeedRoot();
                ctx.Out($"\n        {"ID".PadRight(43)} {"Branch".PadRight(9)} Op\n");
                for (int i = 0; i < targets.Count; i++) ctx.Out($" {(i + 1).ToString(CultureInfo.InvariantCulture).PadLeft(2)}. [-] {targets[i].Id.PadRight(43)} {targets[i].Branch.PadRight(9)} r\n");
                ctx.Out("\n");
                return ReposCmd.AskYesNo(
                    ctx,
                    $"Proceed with these changes to the {where} installation? [Y/n]: ",
                    true,
                    o.Flags.Contains("y"),
                    io =>
                    {
                        var user = inst == "system" ? sh.RootUser() : sh.CurrentUser();
                        foreach (var t in targets)
                        {
                            var dir = $"{InstBase(sh, inst)}/{t.Kind}/{t.Id}";
                            sh.Vfs.Remove(dir, user);
                        }
                        io.Out("Uninstall complete.\n");
                        if (!o.Flags.Contains("u") && targets.Any(t => t.Kind == "app"))
                        {
                            io.Out(Dim(sh, "universal.unusedRuntimes"));
                        }
                        return 0;
                    },
                    io =>
                    {
                        io.Out("error: Aborted by user\n");
                        return 1;
                    });
            }
        }
        ctx.Err($"error: Unknown command '{cmd}'\n\nSee 'flatpak --help'\n");
        return 1;
    }

    private static string ReplaceFirst(string s, string find, string replacement)
    {
        int i = s.IndexOf(find, StringComparison.Ordinal);
        return i < 0 ? s : s[..i] + replacement + s[(i + find.Length)..];
    }

    // ================================================================ Snap

    private sealed class SnapDef
    {
        public required string Name { get; init; }
        public required string Version { get; init; }
        public int Rev { get; init; }
        public required string Publisher { get; init; }
        public required string Summary { get; init; }
        /// <summary>Graphical program (otherwise it runs in the terminal).</summary>
        public bool Gui { get; init; }
        public bool Classic { get; init; }
        public string? Base { get; init; }
        /// <summary>Commands in /snap/bin.</summary>
        public List<string>? Apps { get; init; }
        public string? Notes { get; init; }
        public int SizeMb { get; init; }
    }

    private static readonly List<SnapDef> Snaps = new()
    {
        new SnapDef { Name = "bare", Version = "1.0", Rev = 5, Publisher = "canonical✓", Summary = "Empty base snap, useful for testing and fully statically linked snaps", Gui = false, Notes = "base", SizeMb = 0, Apps = new() },
        new SnapDef { Name = "core22", Version = "20250923", Rev = 2133, Publisher = "canonical✓", Summary = "Runtime environment based on Ubuntu 22.04", Gui = false, Notes = "base", SizeMb = 77, Apps = new() },
        new SnapDef { Name = "core24", Version = "20250926", Rev = 1196, Publisher = "canonical✓", Summary = "Runtime environment based on Ubuntu 24.04", Gui = false, Notes = "base", SizeMb = 70, Apps = new() },
        new SnapDef { Name = "snapd", Version = "2.71", Rev = 25202, Publisher = "canonical✓", Summary = "Daemon and tooling that enable snap packages", Gui = false, Notes = "snapd", SizeMb = 50, Apps = new() },
        new SnapDef { Name = "gtk-common-themes", Version = "0.1-81-g442e511", Rev = 1535, Publisher = "canonical✓", Summary = "Common GTK themes for snaps", Gui = false, SizeMb = 92, Apps = new() },
        new SnapDef { Name = "gnome-42-2204", Version = "0+git.38ea591", Rev = 202, Publisher = "canonical✓", Summary = "Shared GNOME 42 Ubuntu stack", Gui = false, SizeMb = 516, Apps = new() },
        new SnapDef { Name = "firefox", Version = "144.0-2", Rev = 7084, Publisher = "mozilla✓", Summary = "Mozilla Firefox web browser", Gui = true, Base = "core22", SizeMb = 265 },
        new SnapDef { Name = "hello-world", Version = "6.4", Rev = 29, Publisher = "canonical✓", Summary = "The 'hello-world' of snaps", Gui = false, Base = "core22", SizeMb = 1, Apps = new() { "hello-world" } },
        new SnapDef { Name = "vlc", Version = "3.0.21", Rev = 3777, Publisher = "videolan✓", Summary = "The ultimate media player", Gui = true, Base = "core22", SizeMb = 340 },
        new SnapDef { Name = "gimp", Version = "3.0.6", Rev = 532, Publisher = "snapcrafters✪", Summary = "GNU Image Manipulation Program", Gui = true, Base = "core24", SizeMb = 380 },
        new SnapDef { Name = "code", Version = "1.105.1", Rev = 208, Publisher = "vscode✓", Summary = "Code editing. Redefined.", Gui = true, Classic = true, Base = "core22", SizeMb = 330 },
        new SnapDef { Name = "spotify", Version = "1.2.74.477", Rev = 88, Publisher = "spotify✓", Summary = "Music for everyone", Gui = true, Base = "core22", SizeMb = 190 },
        new SnapDef { Name = "calculator", Version = "2.3.1", Rev = 12, Publisher = "calclab", Summary = "A simple calculator (also available as an AppImage)", Gui = true, Base = "core24", SizeMb = 48 },
    };

    private static readonly string[] UbuntuSeed = { "bare", "core22", "core24", "firefox", "gnome-42-2204", "gtk-common-themes", "snapd" };

    private static SnapDef? GetSnapDef(string name) => Snaps.FirstOrDefault(s => s.Name == name);

    private sealed class InstalledSnap
    {
        public required SnapDef Def { get; init; }
        public double Rev { get; init; }
        public bool Classic { get; init; }
    }

    private static readonly Regex ClassicRe = new("confinement: classic", RegexOptions.CultureInvariant);

    /// <summary>Installed snaps: /snap/&lt;name&gt;/&lt;revision&gt;/meta/snap.yaml</summary>
    private static List<InstalledSnap> InstalledSnaps(Shell sh)
    {
        var result = new List<InstalledSnap>();
        foreach (var name in Children(sh, "/snap"))
        {
            if (name == "bin") continue;
            var def = GetSnapDef(name);
            var revs = Children(sh, $"/snap/{name}").Select(Js.Number).Where(n => !double.IsNaN(n)).ToList();
            if (def is null || revs.Count == 0) continue;
            var rev = revs.Max();
            var yaml = TryNode(sh, $"/snap/{name}/{Js.Num(rev)}/meta/snap.yaml")?.Content ?? "";
            result.Add(new InstalledSnap { Def = def, Rev = rev, Classic = ClassicRe.IsMatch(yaml) });
        }
        return result;
    }

    private static void PlaceSnap(Shell sh, SnapDef def, bool classic)
    {
        ExtrarepoLib.EnsureDir(sh, $"/snap/{def.Name}/{def.Rev}/meta");
        sh.Vfs.WriteFile(
            $"/snap/{def.Name}/{def.Rev}/meta/snap.yaml",
            $"name: {def.Name}\nversion: '{def.Version}'\nsummary: {def.Summary}\n{(def.Base is not null ? $"base: {def.Base}\n" : "")}confinement: {(classic ? "classic" : "strict")}\n",
            sh.RootUser());
        ExtrarepoLib.EnsureDir(sh, "/var/lib/snapd/snaps");
        var blob = VfsLib.MakeFile("hsqs (simulated squashfs image)\n", "root", Js.Oct(600));
        blob.Size = def.SizeMb * 1_000_000L;
        sh.Vfs.Insert($"/var/lib/snapd/snaps/{def.Name}_{def.Rev}.snap", blob, sh.RootUser());
        if (def.Notes == "base" || def.Notes == "snapd" || def.Apps?.Count == 0) return;
        ExtrarepoLib.EnsureDir(sh, "/snap/bin");
        // Just like for real, /snap/bin/<program> points to the snap command itself.
        foreach (var app in def.Apps ?? new List<string> { def.Name }) sh.Vfs.Insert($"/snap/bin/{app}", SimBinary("snap"), sh.RootUser());
    }

    /// <summary>Ubuntu ships with a few snaps (Firefox among them).</summary>
    private static void SnapSeed(Shell sh)
    {
        if (Flag(sh, "snap:seeded")) return;
        sh.Flags["snap:seeded"] = true;
        if (sh.Distro.Id != "ubuntu" || TryNode(sh, "/snap") is not null) return;
        foreach (var n in UbuntuSeed) PlaceSnap(sh, GetSnapDef(n)!, false);
    }

    private static int RunSnapApp(CmdCtx ctx, string name)
    {
        var sh = ctx.Sh;
        var inst = InstalledSnaps(sh).FirstOrDefault(s => s.Def.Name == name || (s.Def.Apps?.Contains(name) ?? false));
        if (inst is null)
        {
            ctx.Err($"error: cannot find current revision for snap {name}: readlink /snap/{name}/current: no such file or directory\n");
            return 1;
        }
        if (inst.Def.Name == "hello-world")
        {
            ctx.Out("Hello World!\n");
            return 0;
        }
        ctx.Out(WindowNote(sh, inst.Def.Name));
        return 0;
    }

    private const string SnapManSv = """
NAMN
       snap - installera och hantera snap-paket

SYNOPSIS
       snap KOMMANDO [FLAGGOR] [SNAP]...

BESKRIVNING
       Snap är Canonicals paketformat och standard i Ubuntu. Snaps kommer
       från Snap Store, körs i en sandlåda (confinement) och uppdateras
       automatiskt i bakgrunden. Tjänsten snapd sköter allt.

       Program som behöver komma åt hela systemet (t.ex. kodeditorer)
       publiceras med "classic confinement" och måste installeras med
       --classic – då körs de utan sandlåda.

KOMMANDON
       find ORD          sök i Snap Store
       info SNAP         visa information och kanaler
       install SNAP      installera (kräver root)
       list              lista installerade snaps
       run SNAP          kör ett program från en snap
       refresh           uppdatera alla snaps nu
       remove SNAP       ta bort en snap

FLAGGOR
       --classic         tillåt classic confinement (ingen sandlåda)
       --channel=KANAL   t.ex. latest/beta eller latest/edge

EXEMPEL
       sudo snap install hello-world
       snap run hello-world
       sudo snap install code --classic
""";

    private const string SnapManEn = """
NAME
       snap - install and manage snap packages

SYNOPSIS
       snap COMMAND [OPTIONS] [SNAP]...

DESCRIPTION
       Snap is Canonical's package format and the default in Ubuntu. Snaps
       come from the Snap Store, run in a sandbox (confinement) and are
       updated automatically in the background. The snapd service handles
       everything.

       Programs that need access to the whole system (e.g. code editors)
       are published with "classic confinement" and must be installed
       with --classic - then they run without a sandbox.

COMMANDS
       find WORD         search the Snap Store
       info SNAP         show information and channels
       install SNAP      install (needs root)
       list              list installed snaps
       run SNAP          run a program from a snap
       refresh           update all snaps now
       remove SNAP       remove a snap

OPTIONS
       --classic         allow classic confinement (no sandbox)
       --channel=CHANNEL e.g. latest/beta or latest/edge

EXAMPLES
       sudo snap install hello-world
       snap run hello-world
       sudo snap install code --classic
""";

    private static readonly CommandDef Snap = new()
    {
        Name = "snap",
        Summary = "Installerar och hanterar snap-paket (Canonical/Ubuntu)",
        SummaryEn = "Installs and manages snap packages (Canonical/Ubuntu)",
        Man = SnapManSv,
        ManEn = SnapManEn,
        Run = RunSnap,
    };

    private static readonly Regex PublisherMark = new("[✓✪]\\z", RegexOptions.CultureInvariant);

    private static int RunSnap(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        SnapSeed(sh);
        // /snap/bin/hello-world is really snap itself – then run the program.
        var invokedAs = VfsLib.Basename(ctx.Name);
        if (invokedAs != "snap") return RunSnapApp(ctx, invokedAs);

        var cmd = ctx.Args.Count > 0 ? ctx.Args[0] : null;
        var rest = ctx.Args.Skip(1).ToList();
        var o = UtilCmd.ParseOpts(rest, new OptSpec
        {
            Long = new() { ["classic"] = "c", ["channel"] = "C", ["beta"] = "b", ["edge"] = "e", ["candidate"] = "d", ["stable"] = "s", ["all"] = "a", ["purge"] = "p", ["list"] = "l" },
            Values = "C",
        });
        if (o.Error is not null)
        {
            ctx.Err($"error: {o.Error}\n");
            return 1;
        }
        int Denied()
        {
            ctx.Err("error: access denied (try with sudo)\n");
            return 1;
        }
        switch (cmd)
        {
            case null:
            case "help":
            case "--help":
                ctx.Out("The snap command lets you install, configure, refresh and remove snaps.\nSnaps are packages that work across many different Linux distributions,\nenabling secure delivery and operation of the latest apps and utilities.\n\nUsage: snap <command> [<options>...]\n\nCommonly used commands can be classified as follows:\n\n         Basics: find, info, install, remove, list\n        ...more: refresh, revert, switch, disable, enable\n            Run: run\n");
                return cmd is not null ? 0 : 1;
            case "version":
            case "--version":
                ctx.Out($"snap    2.71\nsnapd   2.71\nseries  16\n{sh.Distro.Id}  {sh.Distro.Version}\nkernel  {sh.Distro.Kernel}\n");
                return 0;
            case "list":
            {
                var list = InstalledSnaps(sh);
                if (list.Count == 0)
                {
                    ctx.Out("No snaps are installed yet. Try 'snap install hello-world'.\n");
                    return 0;
                }
                ctx.Out($"{"Name".PadRight(19)}{"Version".PadRight(17)}{"Rev".PadRight(7)}{"Tracking".PadRight(17)}{"Publisher".PadRight(14)}Notes\n");
                foreach (var s in list)
                {
                    var notes = s.Classic ? "classic" : (s.Def.Notes ?? "-");
                    ctx.Out($"{s.Def.Name.PadRight(19)}{s.Def.Version.PadRight(17)}{Js.Num(s.Rev).PadRight(7)}{"latest/stable".PadRight(17)}{s.Def.Publisher.PadRight(14)}{notes}\n");
                }
                return 0;
            }
            case "find":
            case "search":
            {
                var q = string.Join(" ", o.Operands).ToLowerInvariant();
                var hits = Snaps.Where(s => string.IsNullOrEmpty(s.Notes) && (s.Name.Contains(q) || s.Summary.ToLowerInvariant().Contains(q))).ToList();
                if (hits.Count == 0)
                {
                    ctx.Err($"No matching snaps for \"{q}\"\n");
                    return 1;
                }
                ctx.Out($"{"Name".PadRight(13)}{"Version".PadRight(13)}{"Publisher".PadRight(15)}{"Notes".PadRight(9)}Summary\n");
                foreach (var s in hits) ctx.Out($"{s.Name.PadRight(13)}{s.Version.PadRight(13)}{s.Publisher.PadRight(15)}{(s.Classic ? "classic" : "-").PadRight(9)}{s.Summary}\n");
                return 0;
            }
            case "info":
            {
                var def = o.Operands.Count > 0 && o.Operands[0] != "" ? GetSnapDef(o.Operands[0]) : null;
                if (def is null)
                {
                    ctx.Err($"error: no snap found for \"{(o.Operands.Count > 0 ? o.Operands[0] : "")}\"\n");
                    return 1;
                }
                var inst = InstalledSnaps(sh).FirstOrDefault(s => s.Def == def);
                ctx.Out(
                    $"name:      {def.Name}\nsummary:   {def.Summary}\npublisher: {PublisherMark.Replace(def.Publisher, "", 1)}\nlicense:   unset\n" +
                    (def.Classic ? "notes:     classic confinement – runs without the sandbox\n" : "") +
                    $"channels:\n  latest/stable:    {def.Version.PadRight(16)} ({def.Rev}) {def.SizeMb}MB{(def.Classic ? " classic" : "")}\n" +
                    $"  latest/candidate: ↑\n  latest/beta:      ↑\n  latest/edge:      {def.Version}+git ({def.Rev + 7}) {def.SizeMb}MB{(def.Classic ? " classic" : "")}\n" +
                    (inst is not null ? $"installed:          {def.Version.PadRight(16)} ({Js.Num(inst.Rev)}) {def.SizeMb}MB{(inst.Classic ? " classic" : "")}\n" : ""));
                return 0;
            }
            case "install":
            {
                if (o.Operands.Count == 0)
                {
                    ctx.Err("error: the required argument `<snap> (at least 1 argument)` was not provided\n");
                    return 1;
                }
                if (!IsRoot(sh)) return Denied();
                int code = 0;
                foreach (var name in o.Operands)
                {
                    var def = GetSnapDef(name);
                    if (def is null)
                    {
                        ctx.Err($"error: snap \"{name}\" not found\n");
                        code = 1;
                        continue;
                    }
                    if (InstalledSnaps(sh).Any(s => s.Def == def))
                    {
                        ctx.Out($"snap \"{name}\" is already installed, see 'snap help refresh'\n");
                        continue;
                    }
                    if (def.Classic && !o.Flags.Contains("c"))
                    {
                        ctx.Err(
                            $"error: This revision of snap \"{name}\" was published using classic confinement and thus may\n" +
                            "       perform arbitrary system changes outside of the security sandbox that snaps are usually\n" +
                            "       confined to, which may put your system at risk.\n\n       If you understand and want to proceed repeat the command including --classic.\n");
                        code = 1;
                        continue;
                    }
                    // The base (core22, core24 ...) and snapd come along if they are missing.
                    foreach (var dep in new[] { "snapd", def.Base }.Where(x => !string.IsNullOrEmpty(x)))
                    {
                        if (!InstalledSnaps(sh).Any(s => s.Def.Name == dep)) PlaceSnap(sh, GetSnapDef(dep!)!, false);
                    }
                    PlaceSnap(sh, def, def.Classic);
                    var channel = o.Values.Get("C") ?? (o.Flags.Contains("b") ? "beta" : o.Flags.Contains("e") ? "edge" : o.Flags.Contains("d") ? "candidate" : "");
                    ctx.Out($"{name}{(channel != "" ? $" ({channel})" : "")} {def.Version} from {def.Publisher} installed\n");
                }
                if (!(sh.Env.Get("PATH") ?? "").Split(':').Contains("/snap/bin"))
                {
                    sh.Env["PATH"] = $"{sh.Env.Get("PATH") ?? "/usr/bin:/bin"}:/snap/bin";
                    ctx.Out(Dim(sh, "universal.snapPathAdded"));
                }
                return code;
            }
            case "remove":
            {
                if (o.Operands.Count == 0)
                {
                    ctx.Err("error: the required argument `<snap> (at least 1 argument)` was not provided\n");
                    return 1;
                }
                if (!IsRoot(sh)) return Denied();
                foreach (var name in o.Operands)
                {
                    var inst = InstalledSnaps(sh).FirstOrDefault(s => s.Def.Name == name);
                    if (inst is null)
                    {
                        ctx.Out($"snap \"{name}\" is not installed\n");
                        continue;
                    }
                    sh.Vfs.Remove($"/snap/{name}", sh.RootUser());
                    foreach (var app in inst.Def.Apps ?? new List<string> { name })
                    {
                        if (TryNode(sh, $"/snap/bin/{app}") is not null) sh.Vfs.Remove($"/snap/bin/{app}", sh.RootUser());
                    }
                    var blob = $"/var/lib/snapd/snaps/{name}_{Js.Num(inst.Rev)}.snap";
                    if (TryNode(sh, blob) is not null) sh.Vfs.Remove(blob, sh.RootUser());
                    ctx.Out($"{name} removed{(o.Flags.Contains("p") ? "" : " (snap data snapshot saved)")}\n");
                }
                return 0;
            }
            case "refresh":
            {
                if (o.Flags.Contains("l"))
                {
                    ctx.Out("All snaps up to date.\n");
                    return 0;
                }
                if (!IsRoot(sh)) return Denied();
                ctx.Out("All snaps up to date.\n");
                return 0;
            }
            case "run":
            {
                var name = o.Operands.Count > 0 ? o.Operands[0] : null;
                if (string.IsNullOrEmpty(name))
                {
                    ctx.Err("error: need the application to run as argument\n");
                    return 1;
                }
                return RunSnapApp(ctx, name);
            }
        }
        ctx.Err($"error: unknown command \"{cmd}\", see 'snap help'.\n");
        return 1;
    }

    // ================================================================ AppImage

    /// <summary>
    /// A downloaded AppImage (as in the initial file system): a single file, not yet executable.
    /// Its name is the world's {{calculator}} in {{downloads}}, e.g. ~/Downloads/Calculator.AppImage.
    /// </summary>
    public static FsNode AppImageNode(World w, string owner, string? group = null)
    {
        var desktop = w["calculator"].Replace(".AppImage", "", StringComparison.Ordinal).ToLowerInvariant();
        var node = SimBinary("appimage-runtime", owner, Js.Oct(644), group ?? owner, $"AppImage: {w["calcName"]} 2.3.1\nDesktop: {desktop}.desktop\nType 2 AppImage (squashfs)\n");
        node.Size = 48_312_832;
        return node;
    }

    private const string FuseError =
        "dlopen(): error loading libfuse.so.2\n\nAppImages require FUSE to run. \nYou might still be able to extract the contents of this AppImage \n" +
        "if you run it with the --appimage-extract option. \nSee https://github.com/AppImage/AppImageKit/wiki/FUSE \nfor more information\n";

    private static readonly Dictionary<string, string> FusePkg = new() { ["debian"] = "libfuse2t64", ["arch"] = "fuse2", ["redhat"] = "fuse-libs" };

    private static readonly Regex AppImageHeader = new(@"^AppImage: (.+?)(?: [0-9][0-9.]*)?$", RegexOptions.Multiline | RegexOptions.CultureInvariant);
    private static readonly Regex DesktopHeader = new(@"^Desktop: (\S+)\.desktop$", RegexOptions.Multiline | RegexOptions.CultureInvariant);
    private static readonly Regex AppImageExt = new(@"\.AppImage\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    /// <summary>Runs when an AppImage (or its extracted AppRun) is started.</summary>
    private static readonly CommandDef AppImageRuntime = new()
    {
        Name = "appimage-runtime",
        Summary = "Startprogrammet inuti en AppImage",
        SummaryEn = "The launcher inside an AppImage",
        Man = """
NAMN
       AppImage - ett helt program i en enda körbar fil

BESKRIVNING
       En AppImage startas som vilket program som helst: gör filen körbar
       med chmod +x och kör den med ./Fil.AppImage. Den monterar sig själv
       med FUSE (biblioteket libfuse.so.2).

FLAGGOR
       --appimage-extract           packa upp innehållet till squashfs-root/
       --appimage-extract-and-run   packa upp tillfälligt och kör (utan FUSE)
""",
        ManEn = """
NAME
       AppImage - a whole program in a single executable file

DESCRIPTION
       An AppImage is started like any program: make the file executable
       with chmod +x and run it with ./File.AppImage. It mounts itself
       with FUSE (the library libfuse.so.2).

OPTIONS
       --appimage-extract           unpack the contents to squashfs-root/
       --appimage-extract-and-run   unpack temporarily and run (no FUSE)
""",
        Run = RunAppImage,
    };

    private static int RunAppImage(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var path = sh.Resolve(ctx.Name);
        var self = sh.Vfs.TryLookup(path, sh.CurrentUser())?.Content ?? "";
        var hm = AppImageHeader.Match(self);
        var appName = hm.Success ? hm.Groups[1].Value : AppImageExt.Replace(VfsLib.Basename(path), "", 1).Split('-')[0];
        var extracted = VfsLib.Basename(path) == "AppRun" || path.Contains("/squashfs-root/");
        var arg = ctx.Args.Count > 0 ? ctx.Args[0] : null;
        if (arg == "--appimage-version")
        {
            ctx.Out("AppImage runtime version: continuous build\n");
            return 0;
        }
        if (arg == "--appimage-help")
        {
            ctx.Out("AppImage options:\n\n  --appimage-extract [<pattern>]  Extract content from embedded filesystem image\n  --appimage-extract-and-run      Temporarily extract and run without FUSE\n  --appimage-help                 Print this help\n  --appimage-version              Print version of AppImage runtime\n");
            return 0;
        }
        if (arg == "--appimage-extract" && !extracted)
        {
            var user = sh.CurrentUser();
            var g = user.Groups.FirstOrDefault();
            // File names come from the desktop id (ASCII), not from the app's name in the student's language.
            var dm = DesktopHeader.Match(self);
            var lower = dm.Success ? dm.Groups[1].Value : appName.ToLowerInvariant();
            var files = new List<(string Name, FsNode Node)>
            {
                ("AppRun", SimBinary("appimage-runtime", user.Name, Js.Oct(755), g, $"AppImage: {appName}\nDesktop: {lower}.desktop\n")),
                ($"{lower}.desktop", VfsLib.MakeFile($"[Desktop Entry]\nType=Application\nName={appName}\nExec={lower}\nIcon={lower}\nCategories=Utility;Calculator;\n", user.Name, Js.Oct(644), g)),
                ($"{lower}.png", VfsLib.MakeFile("\u0089PNG (simulated icon)\n", user.Name, Js.Oct(644), g)),
                (".DirIcon", VfsLib.MakeFile("\u0089PNG (simulated icon)\n", user.Name, Js.Oct(644), g)),
            };
            var tree = VfsLib.MakeDir(user.Name, Js.Oct(755), Kids(files.ToArray()), g);
            tree.Children!["usr"] = VfsLib.MakeDir(user.Name, Js.Oct(755), Kids(
                ("bin", VfsLib.MakeDir(user.Name, Js.Oct(755), Kids((lower, SimBinary("appimage-runtime", user.Name, Js.Oct(755), g, $"AppImage: {appName}\nDesktop: {lower}.desktop\n"))), g)),
                ("lib", VfsLib.MakeDir(user.Name, Js.Oct(755), Kids(("libQt6Core.so.6", VfsLib.MakeFile("(simulated library)\n", user.Name, Js.Oct(644), g))), g))), g);
            try
            {
                sh.Vfs.Insert(sh.Resolve("squashfs-root"), tree, user);
            }
            catch (FsError e)
            {
                ctx.Err($"Failed to create squashfs-root: {e.Message}\n");
                return 1;
            }
            foreach (var (n, _) in files) ctx.Out($"squashfs-root/{n}\n");
            ctx.Out($"squashfs-root/usr\nsquashfs-root/usr/bin\nsquashfs-root/usr/bin/{lower}\nsquashfs-root/usr/lib\nsquashfs-root/usr/lib/libQt6Core.so.6\n");
            return 0;
        }
        if (!extracted && arg != "--appimage-extract-and-run" && string.IsNullOrEmpty(sh.Installed.Get("fuse2")))
        {
            ctx.Err(FuseError);
            var fusePkg = FusePkg.GetValueOrDefault(sh.Distro.Family);
            ctx.Err(Dim(sh, "universal.appImageFuse", ("distro", sh.Distro.Name), ("pkg", fusePkg)));
            return 127;
        }
        ctx.Out(WindowNote(sh, appName));
        return 0;
    }

    public static List<CommandDef> All { get; } = new() { Flatpak, Snap, AppImageRuntime };
}
