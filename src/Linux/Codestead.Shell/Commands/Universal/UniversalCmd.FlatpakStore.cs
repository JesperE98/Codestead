namespace Codestead.Shell.Commands;

// Flatpak: the Flathub catalogue, remotes and installed refs in the virtual file system.

public static partial class UniversalCmd
{
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
}
