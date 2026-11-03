namespace Codestead.Shell;

// Port of src/shell/extrarepo.ts – extra repositories outside the distribution's own: PPA
// (Ubuntu/Debian) and COPR (Fedora). The state lives as files in the virtual file system – just
// like in a real system – so it is saved automatically and the student can look at it with ls and cat.
// AUR (Arch) is no repository for pacman at all; there you build the packages yourself (Commands/Repos/).

public static partial class ExtrarepoLib
{
    public const string PpaHost = "ppa.launchpadcontent.net";
    public const string CoprHost = "copr.fedorainfracloud.org";
    /// <summary>PPAs are built for Ubuntu's versions – hence "noble" even when added in Debian.</summary>
    public const string PpaSuite = "noble";

    private static readonly Regex PpaRe = new(
        @"^ppa:([a-z0-9][a-z0-9.+-]*)(?:/([a-z0-9][a-z0-9.+-]*))?\z",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Regex CoprRe = new(
        @"^(?:copr:)?(?:copr\.fedorainfracloud\.org/)?(@?[A-Za-z0-9_.+-]+)/([A-Za-z0-9_.+-]+)\z",
        RegexOptions.CultureInvariant);

    private static readonly Regex EnabledRe = new(
        @"^enabled\s*=\s*(1|true)\s*$",
        RegexOptions.IgnoreCase | RegexOptions.Multiline | RegexOptions.CultureInvariant);

    /// <summary>"ppa:user/name" (or "ppa:user", which means "ppa:user/ppa").</summary>
    public static Ppa? ParsePpa(string spec)
    {
        var m = PpaRe.Match(spec);
        return m.Success
            ? new Ppa
            {
                User = m.Groups[1].Value.ToLowerInvariant(),
                Name = (m.Groups[2].Success ? m.Groups[2].Value : "ppa").ToLowerInvariant(),
            }
            : null;
    }

    public static string PpaUri(Ppa p) => $"https://{PpaHost}/{p.User}/{p.Name}/ubuntu/";

    public static string PpaSourcesPath(Ppa p) => $"/etc/apt/sources.list.d/{p.User}-ubuntu-{p.Name}-{PpaSuite}.sources";

    /// <summary>The package list `apt update` fetches for the PPA. If it exists, apt can install from here.</summary>
    public static string PpaListPath(Ppa p) => $"/var/lib/apt/lists/{PpaHost}_{p.User}_{p.Name}_ubuntu_dists_{PpaSuite}_InRelease";

    /// <summary>"owner/project", "copr:owner/project" or "copr.fedorainfracloud.org/owner/project".</summary>
    public static Copr? ParseCopr(string spec)
    {
        var m = CoprRe.Match(spec);
        return m.Success ? new Copr { Owner = m.Groups[1].Value, Project = m.Groups[2].Value } : null;
    }

    public static string CoprId(Copr c) => $"copr:{CoprHost}:{ReplaceFirst(c.Owner, "@", "group_")}:{c.Project}";

    public static string CoprRepoPath(Copr c) => $"/etc/yum.repos.d/_{CoprId(c)}.repo";

    /// <summary>JS str.replace(string, string): only the first occurrence.</summary>
    private static string ReplaceFirst(string s, string find, string repl)
    {
        var i = s.IndexOf(find, StringComparison.Ordinal);
        return i < 0 ? s : s[..i] + repl + s[(i + find.Length)..];
    }

    private static string? FileContent(Shell sh, string path)
    {
        var node = sh.Vfs.TryLookup(path, sh.RootUser());
        return node?.Type == "file" ? (node.Content ?? "") : null;
    }

    /// <summary>Is the COPR repository added and enabled (enabled=1)?</summary>
    public static bool CoprEnabled(Shell sh, Copr c) => EnabledRe.IsMatch(FileContent(sh, CoprRepoPath(c)) ?? "");

    /// <summary>
    /// Can the package manager install from the extra repository right now?
    /// PPA: once `apt update` has fetched its package list. COPR: when the .repo file is enabled.
    /// AUR: never – AUR packages are built with makepkg (or a helper such as yay).
    /// </summary>
    public static bool ExtraRepoEnabled(Shell sh, string repo)
    {
        var ppa = ParsePpa(repo);
        if (ppa is not null) return FileContent(sh, PpaListPath(ppa)) is not null && FileContent(sh, PpaSourcesPath(ppa)) is not null;
        if (repo.StartsWith("copr:", StringComparison.Ordinal))
        {
            var copr = ParseCopr(repo);
            return copr is not null && CoprEnabled(sh, copr);
        }
        return false;
    }

    /// <summary>Creates the directory and any missing parents (like `mkdir -p`), as root.</summary>
    public static void EnsureDir(Shell sh, string path)
    {
        var root = sh.RootUser();
        var cur = "";
        foreach (var seg in path.Split('/').Where(s => s.Length > 0))
        {
            cur += "/" + seg;
            if (sh.Vfs.TryLookup(cur, root) is null) sh.Vfs.Mkdir(cur, root);
        }
    }
}
