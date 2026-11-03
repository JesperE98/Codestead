namespace Codestead.Shell.Commands;

// The apt and apt-get commands.

using static PackagesLib;

public static partial class PkgCmd
{
    /// <summary>Math.round for non-negative numbers.</summary>
    private static long Round(double v) => (long)Math.Floor(v + 0.5);

    private const string AptReading = "Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\n";

    private static string AptMirror(CmdCtx ctx)
    {
        var d = ctx.Sh.Distro;
        var @base = d.Mirrors.Count > 0 ? d.Mirrors[0].Split(' ')[0] : "http://deb.debian.org/debian";
        return $"{@base} {d.Codename}/main amd64";
    }

    private static int AptUpdate(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        if (!IsRoot(ctx))
        {
            ctx.Out("Reading package lists... Done\n");
            ctx.Err("E: Could not open lock file /var/lib/apt/lists/lock - open (13: Permission denied)\nE: Unable to lock directory /var/lib/apt/lists/\n");
            return 100;
        }
        var already = Flag(sh, "repoSynced");
        for (int i = 0; i < sh.Distro.Mirrors.Count; i++)
        {
            var m = sh.Distro.Mirrors[i];
            if (already || i == 0) ctx.Out($"Hit:{i + 1} {m}\n");
            else ctx.Out($"Get:{i + 1} {m} [{Js.ToFixed(118.6 + i * 7.3, 1)} kB]\n");
        }
        // Added PPAs (see ReposCmd.cs).
        ReposCmd.AptUpdatePpas(ctx, sh.Distro.Mirrors.Count + 1);
        if (!already) ctx.Out("Fetched 1,284 kB in 1s (1,107 kB/s)\n");
        sh.Flags["repoSynced"] = true;
        ctx.Out(AptReading);
        var n = Upgradable(sh).Count;
        ctx.Out(n != 0 ? $"{n} packages can be upgraded. Run 'apt list --upgradable' to see them.\n" : "All packages are up to date.\n");
        return 0;
    }

    private static int AptLockError(CmdCtx ctx)
    {
        ctx.Err(
            "E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\n" +
            "E: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?\n");
        return 100;
    }

    private static int AptInstall(CmdCtx ctx, List<string> names)
    {
        var sh = ctx.Sh;
        if (!IsRoot(ctx)) return AptLockError(ctx);
        ctx.Out(AptReading);
        var toInstall = new List<PackageDef>();
        foreach (var n in names)
        {
            var p = FindPackage(sh.Distro.Family, n, sh);
            // Without "apt update" the package lists are empty and apt finds nothing.
            if (p is null || (!Flag(sh, "repoSynced") && !IsInstalled(sh, p)))
            {
                ctx.Err($"E: Unable to locate package {n}\n");
                if (!Flag(sh, "repoSynced"))
                {
                    ctx.Err($"{UtilCmd.Color.Dim}{ctx.Sh.Msg("pkg.aptListsEmpty")}{UtilCmd.Color.Reset}\n");
                }
                return 100;
            }
            if (IsInstalled(sh, p) && sh.Installed.Get(p.Id) == AvailableVersion(sh, p))
            {
                ctx.Out($"{n} is already the newest version ({sh.Installed.Get(p.Id)}).\n");
            }
            else if (!toInstall.Contains(p))
            {
                toInstall.Add(p);
            }
        }
        var notUpgraded = Upgradable(sh).Count;
        if (toInstall.Count == 0)
        {
            ctx.Out($"0 upgraded, 0 newly installed, 0 to remove and {notUpgraded} not upgraded.\n");
            return 0;
        }
        var size = toInstall.Sum(p => p.SizeKb);
        ctx.Out($"The following NEW packages will be installed:\n  {string.Join(" ", toInstall.Select(p => PkgName(ctx, p)))}\n");
        ctx.Out(
            $"0 upgraded, {toInstall.Count} newly installed, 0 to remove and {notUpgraded} not upgraded.\n" +
            $"Need to get {FormatKb(Round(size * 0.4))} of archives.\n" +
            $"After this operation, {FormatKb(size)} of additional disk space will be used.\n");
        for (int i = 0; i < toInstall.Count; i++)
        {
            var p = toInstall[i];
            ctx.Out($"Get:{i + 1} {ReposCmd.AptPpaMirror(p) ?? AptMirror(ctx)} {PkgName(ctx, p)} amd64 {AvailableVersion(sh, p)} [{FormatKb(Round(p.SizeKb * 0.4))}]\n");
        }
        ctx.Out($"Fetched {FormatKb(Round(size * 0.4))} in 0s (2,511 kB/s)\n");
        foreach (var p in toInstall)
        {
            var n = PkgName(ctx, p);
            var v = AvailableVersion(sh, p);
            ctx.Out(
                $"Selecting previously unselected package {n}.\n(Reading database ... 74213 files and directories currently installed.)\n" +
                $"Preparing to unpack .../{n}_{v}_amd64.deb ...\nUnpacking {n} ({v}) ...\n");
        }
        foreach (var p in toInstall)
        {
            ctx.Out($"Setting up {PkgName(ctx, p)} ({AvailableVersion(sh, p)}) ...\n");
            InstallPackage(sh, p);
        }
        ctx.Out("Processing triggers for man-db (2.12.0-4build2) ...\n");
        return 0;
    }

    private static int AptRemove(CmdCtx ctx, List<string> names, bool assumeYes)
    {
        var sh = ctx.Sh;
        if (!IsRoot(ctx)) return AptLockError(ctx);
        ctx.Out(AptReading);
        var toRemove = new List<PackageDef>();
        foreach (var n in names)
        {
            var p = FindPackage(sh.Distro.Family, n, sh);
            if (p is null)
            {
                ctx.Err($"E: Unable to locate package {n}\n");
                return 100;
            }
            if (!IsInstalled(sh, p))
            {
                ctx.Out($"Package '{n}' is not installed, so not removed\n");
                continue;
            }
            if (p.Essential == true)
            {
                ctx.Err("E: Removing essential system-critical packages is not permitted. This might break the system.\n");
                ctx.Err($"{UtilCmd.Color.Dim}({ctx.Sh.Msg("pkg.essentialPackage", ("pkg", n))}){UtilCmd.Color.Reset}\n");
                return 100;
            }
            toRemove.Add(p);
        }
        var notUpgraded = Upgradable(sh).Count;
        if (toRemove.Count == 0)
        {
            ctx.Out($"0 upgraded, 0 newly installed, 0 to remove and {notUpgraded} not upgraded.\n");
            return 0;
        }
        var size = toRemove.Sum(p => p.SizeKb);
        ctx.Out(
            $"The following packages will be REMOVED:\n  {string.Join(" ", toRemove.Select(p => PkgName(ctx, p)))}\n" +
            $"0 upgraded, 0 newly installed, {toRemove.Count} to remove and {notUpgraded} not upgraded.\n" +
            $"After this operation, {FormatKb(size)} disk space will be freed.\n");
        return Confirm(
            ctx,
            "Do you want to continue? [Y/n] ",
            true,
            assumeYes,
            io =>
            {
                io.Out("(Reading database ... 74213 files and directories currently installed.)\n");
                foreach (var p in toRemove)
                {
                    io.Out($"Removing {PkgName(ctx, p)} ({sh.Installed.Get(p.Id)}) ...\n");
                    RemovePackage(sh, p);
                }
                io.Out("Processing triggers for man-db (2.12.0-4build2) ...\n");
                return 0;
            },
            io =>
            {
                io.Out("Abort.\n");
                return 1;
            });
    }

    private static int AptUpgrade(CmdCtx ctx, bool assumeYes)
    {
        var sh = ctx.Sh;
        if (!IsRoot(ctx)) return AptLockError(ctx);
        ctx.Out(AptReading + "Calculating upgrade... Done\n");
        var ups = Upgradable(sh);
        if (ups.Count == 0)
        {
            ctx.Out("0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n");
            if (Flag(sh, "repoSynced")) sh.Flags["upgraded"] = true;
            else ctx.Out($"{UtilCmd.Color.Dim}{ctx.Sh.Msg("pkg.aptUpgradeNeedsUpdate")}{UtilCmd.Color.Reset}\n");
            return 0;
        }
        var size = ups.Sum(p => p.SizeKb);
        ctx.Out(
            $"The following packages will be upgraded:\n  {string.Join(" ", ups.Select(p => PkgName(ctx, p)))}\n" +
            $"{ups.Count} upgraded, 0 newly installed, 0 to remove and 0 not upgraded.\n" +
            $"Need to get {FormatKb(Round(size * 0.4))} of archives.\n" +
            "After this operation, 12.3 kB of additional disk space will be used.\n");
        return Confirm(
            ctx,
            "Do you want to continue? [Y/n] ",
            true,
            assumeYes,
            io =>
            {
                for (int i = 0; i < ups.Count; i++) io.Out($"Get:{i + 1} {AptMirror(ctx)} {PkgName(ctx, ups[i])} amd64 {AvailableVersion(sh, ups[i])}\n");
                foreach (var p in ups)
                {
                    io.Out($"Preparing to unpack .../{PkgName(ctx, p)}_{AvailableVersion(sh, p)}_amd64.deb ...\n");
                    io.Out($"Unpacking {PkgName(ctx, p)} ({AvailableVersion(sh, p)}) over ({sh.Installed.Get(p.Id)}) ...\n");
                }
                foreach (var p in ups)
                {
                    io.Out($"Setting up {PkgName(ctx, p)} ({AvailableVersion(sh, p)}) ...\n");
                    InstallPackage(sh, p);
                }
                sh.Flags["upgraded"] = true;
                return 0;
            },
            io =>
            {
                io.Out("Abort.\n");
                return 1;
            });
    }

    private const string AptManExtra =
        "\n       search ORD      sök efter paket\n       show PAKET      visa information om ett paket" +
        "\n       list --installed   lista installerade paket\n       list --upgradable  lista paket som kan uppgraderas";

    private static readonly string[] AptYesFlags = { "-y", "--yes", "--assume-yes" };

    private static CommandDef MakeApt(string name) => new()
    {
        Name = name,
        Summary = name == "apt" ? "Pakethanteraren i Debian och Ubuntu" : "Äldre, skriptvänlig variant av apt",
        Man = $"""
NAMN
       {name} - pakethanterare för Debian, Ubuntu och liknande

SYNOPSIS
       {name} [-y] KOMMANDO [PAKET]...

KOMMANDON
       update          hämta nya paketlistor från förråden (repositories)
       upgrade         uppgradera alla installerade paket
       install PAKET   installera paket
       remove PAKET    ta bort paket (inställningsfiler blir kvar)
       purge PAKET     ta bort paket och dess inställningsfiler
       autoremove      ta bort beroenden som inte längre behövs{(name == "apt" ? AptManExtra : "")}

FLAGGOR
       -y, --yes       svara ja på alla frågor

BESKRIVNING
       De flesta kommandon kräver root, så de körs med sudo:
           sudo apt update && sudo apt upgrade
""",
        Run = ctx => RunApt(ctx, name),
    };

    private static int RunApt(CmdCtx ctx, string name)
    {
        var sh = ctx.Sh;
        var assumeYes = ctx.Args.Any(a => AptYesFlags.Contains(a));
        var args = ctx.Args.Where(a => !AptYesFlags.Contains(a) && a != "-q").ToList();
        var sub = args.Count > 0 ? args[0] : null;
        var rest = args.Skip(1).ToList();
        var pkgs = rest.Where(a => !a.StartsWith('-')).ToList();
        switch (sub)
        {
            case null:
            case "-h":
            case "--help":
                ctx.Out(
                    $"{name} 2.8.3 (amd64)\nUsage: {name} [options] command\n\nMost used commands:\n" +
                    "  list - list packages based on package names\n  search - search in package descriptions\n" +
                    "  show - show package details\n  install - install packages\n  remove - remove packages\n" +
                    "  autoremove - automatically remove all unused packages\n  update - update list of available packages\n" +
                    "  upgrade - upgrade the system by installing/upgrading packages\n");
                return sub is not null ? 0 : 1;
            case "update":
                return AptUpdate(ctx);
            case "install":
                if (pkgs.Count == 0)
                {
                    if (!IsRoot(ctx)) return AptLockError(ctx);
                    ctx.Out(AptReading + $"0 upgraded, 0 newly installed, 0 to remove and {Upgradable(sh).Count} not upgraded.\n");
                    return 0;
                }
                return AptInstall(ctx, pkgs);
            case "remove":
            case "purge":
                return AptRemove(ctx, pkgs, assumeYes);
            case "upgrade":
            case "full-upgrade":
            case "dist-upgrade":
                return AptUpgrade(ctx, assumeYes);
            case "autoremove":
                if (!IsRoot(ctx)) return AptLockError(ctx);
                ctx.Out(AptReading + $"0 upgraded, 0 newly installed, 0 to remove and {Upgradable(sh).Count} not upgraded.\n");
                return 0;
            case "search":
            {
                if (name == "apt-get") break;
                if (pkgs.Count == 0)
                {
                    ctx.Err("E: You must give at least one search pattern\n");
                    return 100;
                }
                ctx.Out("Sorting... Done\nFull Text Search... Done\n");
                var results = SearchPackages(sh.Distro.Family, string.Join(" ", pkgs), sh);
                foreach (var p in results)
                {
                    var n = ctx.IsTTY ? $"{UtilCmd.Color.Green}{PkgName(ctx, p)}{UtilCmd.Color.Reset}" : PkgName(ctx, p);
                    ctx.Out($"{n}/{sh.Distro.Codename} {AvailableVersion(sh, p)} amd64{(IsInstalled(sh, p) ? " [installed]" : "")}\n  {p.Description}\n\n");
                }
                return 0;
            }
            case "show":
            {
                if (name == "apt-get") break;
                int code = 0;
                foreach (var n in pkgs)
                {
                    var p = FindPackage(sh.Distro.Family, n, sh);
                    if (p is null)
                    {
                        ctx.Err($"N: Unable to locate package {n}\nE: No packages found\n");
                        code = 100;
                        continue;
                    }
                    ctx.Out(
                        $"Package: {n}\nVersion: {AvailableVersion(sh, p)}\nPriority: {(p.Essential == true ? "required" : "optional")}\n" +
                        $"Section: utils\nInstalled-Size: {FormatKb(p.SizeKb)}\n" +
                        $"APT-Manual-Installed: {(IsInstalled(sh, p) ? "yes" : "no")}\nDescription: {p.Description}\n\n");
                }
                return code;
            }
            case "policy":
                if (name == "apt-get") break;
                return ReposCmd.AptPolicy(ctx, pkgs);
            case "list":
            {
                if (name == "apt-get") break;
                ctx.Out("Listing... Done\n");
                var cn = sh.Distro.Codename;
                if (rest.Contains("--upgradable"))
                {
                    foreach (var p in Upgradable(sh))
                    {
                        ctx.Out($"{PkgName(ctx, p)}/{cn}-updates {AvailableVersion(sh, p)} amd64 [upgradable from: {sh.Installed.Get(p.Id)}]\n");
                    }
                    return 0;
                }
                var onlyInstalled = rest.Contains("--installed");
                foreach (var p in FamilyPackages(ctx).StableSort((a, b) => Js.LocaleCompare(PkgName(ctx, a), PkgName(ctx, b))))
                {
                    if (onlyInstalled && !IsInstalled(sh, p)) continue;
                    var v = IsInstalled(sh, p) ? sh.Installed.Get(p.Id) : AvailableVersion(sh, p);
                    ctx.Out($"{PkgName(ctx, p)}/{cn},now {v} amd64{(IsInstalled(sh, p) ? " [installed]" : "")}\n");
                }
                return 0;
            }
        }
        ctx.Err($"E: Invalid operation {sub}\n");
        return 100;
    }
}
