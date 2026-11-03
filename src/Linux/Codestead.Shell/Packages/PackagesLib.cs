namespace Codestead.Shell;

// Port of src/shell/packages.ts – the package database used by apt, pacman and dnf in the simulator.
// The same program can be called different things in different families – an important point!

public static partial class PackagesLib
{
    public static string? PackageName(PackageDef pkg, Family family) => pkg.Names.Get(family);

    /// <summary>
    /// Is the package in the repositories enabled in the shell? Packages from an extra repository
    /// (PPA, COPR) only show up once the repository has been added; AUR packages never (they are built
    /// with makepkg). Without a shell only the normal repositories count.
    /// </summary>
    public static bool InRepos(Shell? sh, PackageDef pkg)
    {
        var family = sh?.Distro.Family;
        if (string.IsNullOrEmpty(family) || pkg.ExtraRepo is null) return pkg.ExtraRepo is null;
        var repo = pkg.ExtraRepo.Get(family);
        return string.IsNullOrEmpty(repo) || ExtrarepoLib.ExtraRepoEnabled(sh!, repo);
    }

    /// <summary>The package is in the repositories or already installed.</summary>
    public static bool IsKnown(Shell? sh, PackageDef pkg) => InRepos(sh, pkg) || (sh is not null && IsInstalled(sh, pkg));

    public static PackageDef? FindPackage(Family family, string name, Shell? sh = null) =>
        Packages.FirstOrDefault(p => p.Names.Get(family) == name && IsKnown(sh, p));

    /// <summary>Packages that do not come from the distribution's own repositories (e.g. AUR – `pacman -Qm`).</summary>
    public static bool IsForeign(Family family, PackageDef pkg) => !string.IsNullOrEmpty(pkg.ExtraRepo?.Get(family));

    /// <summary>The package that provides a certain command (for "command not found" hints).</summary>
    public static PackageDef? PackageProviding(Family family, string command) =>
        Packages.FirstOrDefault(p =>
            !string.IsNullOrEmpty(p.Names.Get(family)) && p.Provides.Contains(command) && string.IsNullOrEmpty(p.ExtraRepo?.Get(family)));

    public static string AvailableVersion(Shell sh, PackageDef pkg)
    {
        var fam = sh.Distro.Family;
        var newV = pkg.NewVersion?.Get(fam);
        var v = sh.Flags.GetValue("repoSynced") == true && !string.IsNullOrEmpty(newV) ? newV : pkg.Version[fam];
        // Debian and Ubuntu share a family, but the version numbers look a little different.
        return sh.Distro.Id == "debian" ? v.Replace("ubuntu", "+deb13u", StringComparison.Ordinal) : v;
    }

    public static bool IsInstalled(Shell sh, PackageDef pkg) => sh.Installed.ContainsKey(pkg.Id);

    public static List<PackageDef> Upgradable(Shell sh) =>
        Packages.Where(p => IsInstalled(sh, p) && sh.Installed[p.Id] != AvailableVersion(sh, p)).ToList();

    public static List<PackageDef> SearchPackages(Family family, string query, Shell? sh = null)
    {
        var q = query.ToLowerInvariant();
        return Packages
            .Where(p =>
                !string.IsNullOrEmpty(p.Names.Get(family)) &&
                IsKnown(sh, p) &&
                (p.Names[family].ToLowerInvariant().Contains(q, StringComparison.Ordinal) ||
                 p.Description.ToLowerInvariant().Contains(q, StringComparison.Ordinal)))
            .ToList()
            .StableSort((a, b) => Js.LocaleCompare(a.Names[family], b.Names[family]));
    }

    /// <summary>Installs (or upgrades) the package: puts the commands in /usr/bin.</summary>
    public static void InstallPackage(Shell sh, PackageDef pkg)
    {
        sh.Installed[pkg.Id] = AvailableVersion(sh, pkg);
        foreach (var cmd in pkg.Provides) InstallCommand(sh, cmd);
        if (pkg.Shells is not null) UpdateEtcShells(sh, pkg.Shells, true);
        if (pkg.Id == "cron" && sh.Distro.Family == "arch") ServicesLib.CronieUnit(sh, true);
    }

    /// <summary>Puts the package's commands in /usr/bin.</summary>
    public static void PlaceBinaries(Shell sh, PackageDef pkg)
    {
        foreach (var cmd in pkg.Provides) InstallCommand(sh, cmd);
    }

    /// <summary>Puts a simulated binary for the command in /usr/bin.</summary>
    public static void InstallCommand(Shell sh, string cmd)
    {
        var bin = sh.Vfs.Lookup("/usr/bin", sh.RootUser());
        var node = VfsLib.MakeFile($"{VfsLib.Elf}\u0002\u0001\u0001 (simulated binary: {cmd})", "root", cmd == "sudo" ? Js.Oct(4755) : Js.Oct(755));
        node.Size = 30_000 + ((cmd.Length * 7919L) % 150_000);
        bin.Children![cmd] = node;
    }

    /// <summary>Adds or removes shells in /etc/shells (as the packages' install scripts do).</summary>
    private static void UpdateEtcShells(Shell sh, List<string> shells, bool add)
    {
        var root = sh.RootUser();
        var node = sh.Vfs.TryLookup("/etc/shells", root);
        if (node?.Type != "file") return;
        var lines = (node.Content ?? "").Split('\n').Where(l => l != "" && !shells.Contains(l)).ToList();
        if (add) lines.AddRange(shells);
        node.Content = string.Join("\n", lines) + "\n";
    }

    public static void RemovePackage(Shell sh, PackageDef pkg)
    {
        sh.Installed.Remove(pkg.Id);
        var bin = sh.Vfs.Lookup("/usr/bin", sh.RootUser());
        foreach (var cmd in pkg.Provides) bin.Children!.Remove(cmd);
        if (pkg.Shells is not null) UpdateEtcShells(sh, pkg.Shells, false);
        if (pkg.Id == "cron" && sh.Distro.Family == "arch") ServicesLib.CronieUnit(sh, false);
    }

    public static string FormatKb(double kb)
    {
        if (kb >= 1000)
        {
            var s = Js.ToFixed(kb / 1000, 1);
            var i = s.IndexOf(".0", StringComparison.Ordinal);
            if (i >= 0) s = s[..i] + s[(i + 2)..];
            return $"{s} MB";
        }
        return $"{Js.Num(kb)} kB";
    }

    public static string FormatMiB(double kb) => $"{Js.ToFixed(kb / 1024, 2)} MiB";
}
