namespace Codestead.Shell.Commands;

// Port of src/shell/commands/pkg.ts
// Simulated package managers: apt (Debian/Ubuntu), pacman (Arch) and dnf (Fedora/RHEL).
// The output imitates the real programs, but simplified.

using static PackagesLib;

public static partial class PkgCmd
{
    private static bool IsRoot(CmdCtx ctx) => ctx.Sh.CurrentUser().Uid == 0;
    private static string PkgName(CmdCtx ctx, PackageDef p) => p.Names.Get(ctx.Sh.Distro.Family)!;
    private static List<PackageDef> FamilyPackages(CmdCtx ctx) =>
        Packages.Where(p => !string.IsNullOrEmpty(p.Names.Get(ctx.Sh.Distro.Family)) && IsKnown(ctx.Sh, p)).ToList();

    private static bool Flag(Shell sh, string key) => sh.Flags.TryGetValue(key, out var v) && v;
    /// <summary>Math.round for non-negative numbers.</summary>
    private static long Round(double v) => (long)Math.Floor(v + 0.5);
    /// <summary>formatMiB for fractional sizes (the same formula as PackagesLib.FormatMiB).</summary>
    private static string MiB(double kb) => $"{Js.ToFixed(kb / 1024, 2)} MiB";
    private static string ReplaceFirst(string s, string find)
    {
        int i = s.IndexOf(find, StringComparison.Ordinal);
        return i < 0 ? s : s.Remove(i, find.Length);
    }

    private static readonly Regex YesRe = new(@"^(y|yes|j|ja)\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    /// <summary>
    /// Asks "continue? [Y/n]" unless -y/--noconfirm was given.
    /// If input comes from a pipe (e.g. `yes | apt ...`) the answer is read from there.
    /// </summary>
    private static int Confirm(CmdCtx ctx, string question, bool defaultYes, bool assumeYes, Func<Sink, int> onYes, Func<Sink, int> onNo)
    {
        if (assumeYes) return onYes(ctx);
        if (ctx.Stdin is not null)
        {
            var answer = ctx.Stdin.Split('\n')[0].Trim();
            ctx.Out(question + answer + "\n");
            var yes = answer == "" ? defaultYes : YesRe.IsMatch(answer);
            return yes ? onYes(ctx) : onNo(ctx);
        }
        ctx.Sh.Ask(question, defaultYes, (yes, io) => yes ? onYes(io) : onNo(io));
        return 0;
    }

    // ---------------------------------------------------------------- apt

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
                    ctx.Err($"{UtilCmd.Color.Dim}{ctx.Sh.Msg("Tips från simulatorn: paketlistorna är tomma. Kör 'sudo apt update' först.", "Tip from the simulator: the package lists are empty. Run 'sudo apt update' first.")}{UtilCmd.Color.Reset}\n");
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
                ctx.Err($"{UtilCmd.Color.Dim}({ctx.Sh.Msg($"{n} är ett systemkritiskt paket – utan det slutar systemet fungera.", $"{n} is an essential package – without it the system stops working.")}){UtilCmd.Color.Reset}\n");
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
            else ctx.Out($"{UtilCmd.Color.Dim}{ctx.Sh.Msg("Tips från simulatorn: apt vet inte om några nya versioner förrän du kört 'sudo apt update'.", "Tip from the simulator: apt doesn't know about any new versions until you have run 'sudo apt update'.")}{UtilCmd.Color.Reset}\n");
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

    // ---------------------------------------------------------------- pacman

    private static string Bar(string label) => $"{label.PadRight(48)} [{"#".Repeat(22)}] 100%\n";

    private static readonly CommandDef Pacman = new()
    {
        Name = "pacman",
        Summary = "Pakethanteraren i Arch Linux",
        Man = """
NAMN
       pacman - pakethanterare för Arch Linux och liknande

SYNOPSIS
       pacman ÅTGÄRD [FLAGGOR] [PAKET]...

ÅTGÄRDER (stor bokstav)
       -S    synkronisera: installera paket från förråden
       -R    ta bort paket
       -Q    fråga databasen över installerade paket

VANLIGA KOMBINATIONER
       pacman -Syu          uppdatera paketdatabasen och uppgradera allt
       pacman -S PAKET      installera ett paket
       pacman -Ss ORD       sök efter paket
       pacman -Si PAKET     visa information om ett paket
       pacman -R PAKET      ta bort ett paket
       pacman -Rs PAKET     ta bort paket och beroenden som inte behövs
       pacman -Q            lista installerade paket
       pacman -Qi PAKET     information om ett installerat paket

FLAGGOR
       --noconfirm   fråga inte om bekräftelse
       --needed      installera inte om paket som redan är aktuella

BESKRIVNING
       Arch är en "rolling release": paketen uppdateras hela tiden. Kör
       alltid -Syu i stället för bara -Sy, annars riskerar du att få en
       halvuppgraderad (partial upgrade) och trasig installation.
""",
        Run = RunPacman,
    };

    private static int RunPacman(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var fam = sh.Distro.Family;
        var noconfirm = ctx.Args.Contains("--noconfirm");
        var needed = ctx.Args.Contains("--needed");
        var letters = "";
        var targets = new List<string>();
        foreach (var a in ctx.Args)
        {
            if (a == "--noconfirm" || a == "--needed") continue;
            if (a == "--help") letters += "h";
            else if (a == "--version") letters += "V";
            else if (a.StartsWith("--"))
            {
                ctx.Err($"pacman: unrecognized option '{a}'\n");
                return 1;
            }
            else if (a.StartsWith('-')) letters += a[1..];
            else targets.Add(a);
        }
        if (letters.Contains('V'))
        {
            ctx.Out("\n .--.                  Pacman v7.0.0 - libalpm v15.0.0\n/ _.-' .-.  .-.  .-.   Copyright (C) 2006-2024 Pacman Development Team\n\\  '-. '-'  '-'  '-'\n '--'\n\n");
            return 0;
        }
        var opChar = letters.FirstOrDefault(c => c >= 'A' && c <= 'Z');
        var op = opChar == default ? null : opChar.ToString();
        if (letters.Contains('h') && op is null)
        {
            ctx.Out("usage:  pacman <operation> [...]\noperations:\n    pacman {-h --help}\n    pacman {-V --version}\n    pacman {-Q --query}   [options] [package(s)]\n    pacman {-R --remove}  [options] <package(s)>\n    pacman {-S --sync}    [options] [package(s)]\n");
            return 0;
        }
        if (op is null)
        {
            ctx.Err("error: no operation specified (use -h for help)\n");
            return 1;
        }
        var mods = ReplaceFirst(letters, op);
        int RootError()
        {
            ctx.Err("error: you cannot perform this operation unless you are root.\n");
            return 1;
        }
        string Repo(PackageDef p) => p.ArchRepo ?? "extra";
        string Full(PackageDef p) => $"{PkgName(ctx, p)}-{AvailableVersion(sh, p)}";

        if (op == "Q")
        {
            var list = FamilyPackages(ctx).Where(p => IsInstalled(sh, p)).ToList();
            if (mods.Contains('s'))
            {
                var q = string.Join(" ", targets);
                list = SearchPackages(fam, q, sh).Where(p => IsInstalled(sh, p)).ToList();
                foreach (var p in list) ctx.Out($"local/{PkgName(ctx, p)} {sh.Installed.Get(p.Id)}\n    {p.Description}\n");
                return list.Count != 0 ? 0 : 1;
            }
            if (targets.Count != 0)
            {
                var picked = new List<PackageDef>();
                foreach (var t in targets)
                {
                    var p = FindPackage(fam, t, sh);
                    if (p is null || !IsInstalled(sh, p))
                    {
                        ctx.Err($"error: package '{t}' was not found\n");
                        return 1;
                    }
                    picked.Add(p);
                }
                list = picked;
            }
            // -Qm: packages that are not in the repositories ("foreign", e.g. from the AUR). -Qn: only those that are.
            if (mods.Contains('m')) list = list.Where(p => IsForeign(fam, p)).ToList();
            if (mods.Contains('n')) list = list.Where(p => !IsForeign(fam, p)).ToList();
            if ((mods.Contains('m') || mods.Contains('n')) && list.Count == 0) return 1;
            list.StableSort((a, b) => Js.LocaleCompare(PkgName(ctx, a), PkgName(ctx, b)));
            foreach (var p in list)
            {
                if (mods.Contains('i'))
                {
                    ctx.Out(
                        $"Name            : {PkgName(ctx, p)}\nVersion         : {sh.Installed.Get(p.Id)}\nDescription     : {p.Description}\n" +
                        $"Architecture    : x86_64\nInstalled Size  : {FormatMiB(p.SizeKb)}\nInstall Reason  : {(p.Base is not null ? "Installed as a dependency for another package" : "Explicitly installed")}\n\n");
                }
                else
                {
                    ctx.Out($"{PkgName(ctx, p)} {sh.Installed.Get(p.Id)}\n");
                }
            }
            return 0;
        }

        if (op == "S")
        {
            if (mods.Contains('s'))
            {
                var results = SearchPackages(fam, string.Join(" ", targets), sh).Where(p => !IsForeign(fam, p)).ToList();
                foreach (var p in results)
                {
                    ctx.Out($"{Repo(p)}/{PkgName(ctx, p)} {AvailableVersion(sh, p)}{(IsInstalled(sh, p) ? " [installed]" : "")}\n    {p.Description}\n");
                }
                return results.Count != 0 ? 0 : 1;
            }
            if (mods.Contains('i'))
            {
                foreach (var t in targets)
                {
                    var p = FindPackage(fam, t, sh);
                    if (p is null || IsForeign(fam, p))
                    {
                        ctx.Err($"error: package '{t}' was not found\n");
                        return 1;
                    }
                    ctx.Out(
                        $"Repository      : {Repo(p)}\nName            : {PkgName(ctx, p)}\nVersion         : {AvailableVersion(sh, p)}\n" +
                        $"Description     : {p.Description}\nArchitecture    : x86_64\nDownload Size   : {MiB(p.SizeKb * 0.4)}\n" +
                        $"Installed Size  : {FormatMiB(p.SizeKb)}\n\n");
                }
                return 0;
            }
            if (!IsRoot(ctx)) return RootError();
            if (mods.Contains('y'))
            {
                ctx.Out(":: Synchronizing package databases...\n");
                foreach (var r in new[] { "core", "extra" }) ctx.Out(Flag(sh, "repoSynced") && !mods.Contains("yy") ? $" {r} is up to date\n" : $" {r} downloading...\n");
                sh.Flags["repoSynced"] = true;
            }
            var upgrade = mods.Contains('u');
            var list = new List<PackageDef>();
            if (upgrade)
            {
                ctx.Out(":: Starting full system upgrade...\n");
                list.AddRange(Upgradable(sh));
            }
            foreach (var t in targets)
            {
                var p = FindPackage(fam, t, sh);
                if (p is null || IsForeign(fam, p))
                {
                    ctx.Err($"error: target not found: {t}\n");
                    if (Packages.Any(x => x.Names.Get("arch") == t && IsForeign(fam, x)))
                    {
                        ctx.Err($"{UtilCmd.Color.Dim}{sh.Msg($"Tips från simulatorn: {t} finns inte i Archs förråd, bara i AUR (se kapitlet \"AUR, PPA och COPR\").", $"Simulator tip: {t} is not in the Arch repositories, only in the AUR (see the chapter \"AUR, PPA and COPR\").")}{UtilCmd.Color.Reset}\n");
                    }
                    return 1;
                }
                if (IsInstalled(sh, p) && sh.Installed.Get(p.Id) == AvailableVersion(sh, p))
                {
                    if (needed)
                    {
                        ctx.Err($"warning: {Full(p)} is up to date -- skipping\n");
                        continue;
                    }
                    ctx.Err($"warning: {Full(p)} is up to date -- reinstalling\n");
                }
                if (!list.Contains(p)) list.Add(p);
            }
            if (list.Count == 0)
            {
                if (upgrade)
                {
                    ctx.Out(" there is nothing to do\n");
                    if (Flag(sh, "repoSynced")) sh.Flags["upgraded"] = true;
                    return 0;
                }
                if (mods.Contains('y')) return 0;
                if (targets.Count != 0)
                {
                    ctx.Out(" there is nothing to do\n");
                    return 0;
                }
                ctx.Err("error: no targets specified (use -h for help)\n");
                return 1;
            }
            var size = list.Sum(p => p.SizeKb);
            ctx.Out(
                $"resolving dependencies...\nlooking for conflicting packages...\n\nPackages ({list.Count}) {string.Join("  ", list.Select(Full))}\n\n" +
                $"Total Download Size:   {MiB(size * 0.4)}\nTotal Installed Size:  {FormatMiB(size)}\n\n");
            return Confirm(
                ctx,
                ":: Proceed with installation? [Y/n] ",
                true,
                noconfirm,
                io =>
                {
                    var n = list.Count;
                    io.Out(":: Retrieving packages...\n");
                    foreach (var p in list) io.Out($" {Full(p)}-x86_64 downloading...\n");
                    foreach (var step in new[] { "checking keys in keyring", "checking package integrity", "loading package files", "checking for file conflicts" })
                    {
                        io.Out(Bar($"({n}/{n}) {step}"));
                    }
                    io.Out(":: Processing package changes...\n");
                    for (int i = 0; i < list.Count; i++)
                    {
                        var p = list[i];
                        io.Out(Bar($"({i + 1}/{n}) {(IsInstalled(sh, p) ? "upgrading" : "installing")} {PkgName(ctx, p)}"));
                        InstallPackage(sh, p);
                    }
                    io.Out(":: Running post-transaction hooks...\n(1/1) Arming ConditionNeedsUpdate...\n");
                    if (upgrade && Flag(sh, "repoSynced")) sh.Flags["upgraded"] = true;
                    return 0;
                },
                _ => 1);
        }

        if (op == "R")
        {
            if (targets.Count == 0)
            {
                ctx.Err("error: no targets specified (use -h for help)\n");
                return 1;
            }
            if (!IsRoot(ctx)) return RootError();
            var list = new List<PackageDef>();
            foreach (var t in targets)
            {
                var p = FindPackage(fam, t, sh);
                if (p is null || !IsInstalled(sh, p))
                {
                    ctx.Err($"error: target not found: {t}\n");
                    return 1;
                }
                if (p.Essential == true)
                {
                    ctx.Err($"checking dependencies...\nerror: failed to prepare transaction (could not satisfy dependencies)\n:: removing {t} breaks dependency '{t}' required by base\n");
                    return 1;
                }
                list.Add(p);
            }
            var size = list.Sum(p => p.SizeKb);
            ctx.Out($"checking dependencies...\n\nPackages ({list.Count}) {string.Join("  ", list.Select(p => $"{PkgName(ctx, p)}-{sh.Installed.Get(p.Id)}"))}\n\nTotal Removed Size:  {FormatMiB(size)}\n\n");
            return Confirm(
                ctx,
                ":: Do you want to remove these packages? [Y/n] ",
                true,
                noconfirm,
                io =>
                {
                    io.Out(":: Processing package changes...\n");
                    for (int i = 0; i < list.Count; i++)
                    {
                        var p = list[i];
                        io.Out(Bar($"({i + 1}/{list.Count}) removing {PkgName(ctx, p)}"));
                        RemovePackage(sh, p);
                    }
                    return 0;
                },
                _ => 1);
        }

        ctx.Err($"error: invalid option '-{op}'\n");
        return 1;
    }

    // ---------------------------------------------------------------- dnf

    private static readonly string[] DnfYesFlags = { "-y", "--assumeyes" };
    private const string DnfHeader = "Package                      Arch    Version                    Repository       Size\n";

    private static CommandDef Dnf(string name) => new()
    {
        Name = name,
        Summary = "Pakethanteraren i Fedora och Red Hat",
        Man = """
NAMN
       dnf - pakethanterare för Fedora, RHEL, Rocky Linux och liknande

SYNOPSIS
       dnf [-y] KOMMANDO [PAKET]...

KOMMANDON
       install PAKET     installera paket
       remove PAKET      ta bort paket
       upgrade           uppgradera alla paket
       check-update      visa vilka paket som kan uppgraderas
       makecache         hämta ny metadata från förråden
       search ORD        sök efter paket
       info PAKET        visa information om ett paket
       list --installed  lista installerade paket
       repolist          visa aktiverade förråd (repositories)

FLAGGOR
       -y, --assumeyes   svara ja på alla frågor

BESKRIVNING
       dnf uppdaterar metadata automatiskt när den är gammal, så det
       finns inget separat "update"-steg som i apt. Observera att frågan
       "Is this ok [y/N]" har Nej som standard – tryck y och Enter.
""",
        Run = RunDnf,
    };

    private static readonly Regex LastDash = new(@"-(?=[^-]+\z)", RegexOptions.CultureInvariant);

    private static int RunDnf(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var fam = sh.Distro.Family;
        var assumeYes = ctx.Args.Any(a => DnfYesFlags.Contains(a));
        var args = ctx.Args.Where(a => !DnfYesFlags.Contains(a)).ToList();
        var sub = args.Count > 0 ? args[0] : null;
        var rest = args.Skip(1).ToList();
        var targets = rest.Where(a => !a.StartsWith('-')).ToList();
        string Ver(PackageDef p) => AvailableVersion(sh, p);
        int RootError()
        {
            ctx.Err("This command has to be run with superuser privileges (under the root user on most systems).\n");
            return 1;
        }
        void LoadRepos()
        {
            if (!Flag(sh, "repoSynced"))
            {
                ctx.Out(
                    $"Updating and loading repositories:\n Fedora {sh.Distro.Version} - x86_64 - Updates   100% |   2.1 MiB/s |   5.3 MiB |  00m03s\n" +
                    $" Fedora {sh.Distro.Version} - x86_64             100% |   9.8 MiB/s |  35.6 MiB |  00m04s\nRepositories loaded.\n");
                sh.Flags["repoSynced"] = true;
            }
            else
            {
                ctx.Out("Updating and loading repositories:\nRepositories loaded.\n");
            }
        }
        string Row(PackageDef p, string v, string repo) =>
            $" {PkgName(ctx, p).PadRight(28)} x86_64  {v.PadRight(26)} {repo.PadRight(10)} {FormatMiB(p.SizeKb).PadLeft(10)}\n";

        switch (sub)
        {
            case null:
            case "--help":
            case "help":
                ctx.Out("Usage:\n  dnf5 [GLOBAL OPTIONS] <COMMAND> ...\n\nSoftware Management Commands:\n  install    Install software\n  upgrade    Upgrade software\n  remove     Remove (uninstall) software\n  search     Search for software\n  info       Provide detailed information about installed or available packages\n  list       List installed or available packages\n  check-upgrade  Check for available package upgrades\n  makecache  Generate the metadata cache\n  repolist   List repositories\n");
                return sub is not null ? 0 : 2;
            case "install":
            case "in":
            {
                if (!IsRoot(ctx)) return RootError();
                LoadRepos();
                var list = new List<PackageDef>();
                foreach (var t in targets)
                {
                    var p = FindPackage(fam, t, sh);
                    if (p is null)
                    {
                        ctx.Err($"Failed to resolve the transaction:\nNo match for argument: {t}\nYou can try to add to command line:\n  --skip-unavailable to skip unavailable packages\n");
                        return 1;
                    }
                    if (IsInstalled(sh, p) && sh.Installed.Get(p.Id) == Ver(p)) ctx.Out($"Package \"{t}-{Ver(p)}.x86_64\" is already installed.\n");
                    else if (!list.Contains(p)) list.Add(p);
                }
                if (list.Count == 0)
                {
                    ctx.Out("\nNothing to do.\n");
                    return 0;
                }
                var size = list.Sum(p => p.SizeKb);
                ctx.Out(DnfHeader + "Installing:\n" + string.Concat(list.Select(p => Row(p, Ver(p), ReposCmd.DnfRepoId(p)))));
                ctx.Out(
                    $"\nTransaction Summary:\n Installing:        {list.Count} package{(list.Count > 1 ? "s" : "")}\n\n" +
                    $"Total size of inbound packages is {MiB(size * 0.4)}. Need to download {MiB(size * 0.4)}.\n" +
                    $"After this operation, {FormatMiB(size)} extra will be used (install {FormatMiB(size)}, remove 0 B).\n");
                return Confirm(
                    ctx,
                    "Is this ok [y/N]: ",
                    false,
                    assumeYes,
                    io =>
                    {
                        for (int i = 0; i < list.Count; i++)
                        {
                            var p = list[i];
                            io.Out($"[{i + 1}/{list.Count}] {PkgName(ctx, p)}-0:{Ver(p)}.x86_64          100% |   1.8 MiB/s | {MiB(p.SizeKb * 0.4)} |  00m00s\n");
                        }
                        io.Out($"Running transaction\n[1/{list.Count + 2}] Verify package files            100%\n[2/{list.Count + 2}] Prepare transaction             100%\n");
                        for (int i = 0; i < list.Count; i++)
                        {
                            var p = list[i];
                            io.Out($"[{i + 3}/{list.Count + 2}] Installing {PkgName(ctx, p)}-0:{Ver(p)}.x86_64   100%\n");
                            InstallPackage(sh, p);
                        }
                        io.Out("Complete!\n");
                        return 0;
                    },
                    io =>
                    {
                        io.Out("Operation aborted by the user.\n");
                        return 1;
                    });
            }
            case "remove":
            case "rm":
            case "erase":
            {
                if (!IsRoot(ctx)) return RootError();
                var list = new List<PackageDef>();
                foreach (var t in targets)
                {
                    var p = FindPackage(fam, t, sh);
                    if (p is null || !IsInstalled(sh, p))
                    {
                        ctx.Out($"No packages to remove for argument: {t}\n");
                        continue;
                    }
                    if (p.Essential == true)
                    {
                        ctx.Err($"Failed to resolve the transaction:\nProblem: The operation would result in removing the following protected packages: {t}\n");
                        return 1;
                    }
                    list.Add(p);
                }
                if (list.Count == 0)
                {
                    ctx.Out("\nNothing to do.\n");
                    return 0;
                }
                ctx.Out(DnfHeader + "Removing:\n" + string.Concat(list.Select(p => Row(p, sh.Installed.Get(p.Id)!, "@System"))));
                ctx.Out($"\nTransaction Summary:\n Removing:          {list.Count} package{(list.Count > 1 ? "s" : "")}\n\nAfter this operation, {FormatMiB(list.Sum(p => p.SizeKb))} will be freed.\n");
                return Confirm(
                    ctx,
                    "Is this ok [y/N]: ",
                    false,
                    assumeYes,
                    io =>
                    {
                        io.Out($"Running transaction\n[1/{list.Count + 1}] Prepare transaction             100%\n");
                        for (int i = 0; i < list.Count; i++)
                        {
                            var p = list[i];
                            io.Out($"[{i + 2}/{list.Count + 1}] Removing {PkgName(ctx, p)}-0:{sh.Installed.Get(p.Id)}.x86_64   100%\n");
                            RemovePackage(sh, p);
                        }
                        io.Out("Complete!\n");
                        return 0;
                    },
                    io =>
                    {
                        io.Out("Operation aborted by the user.\n");
                        return 1;
                    });
            }
            case "upgrade":
            case "update":
            {
                if (!IsRoot(ctx)) return RootError();
                LoadRepos();
                var ups = Upgradable(sh);
                if (ups.Count == 0)
                {
                    ctx.Out("Nothing to do.\n");
                    sh.Flags["upgraded"] = true;
                    return 0;
                }
                ctx.Out(DnfHeader + "Upgrading:\n" + string.Concat(ups.Select(p => Row(p, Ver(p), "updates") + $"   replacing {PkgName(ctx, p).PadRight(18)} x86_64  {sh.Installed.Get(p.Id)}\n")));
                ctx.Out($"\nTransaction Summary:\n Upgrading:         {ups.Count} packages\n Replacing:         {ups.Count} packages\n");
                return Confirm(
                    ctx,
                    "Is this ok [y/N]: ",
                    false,
                    assumeYes,
                    io =>
                    {
                        io.Out("Running transaction\n");
                        for (int i = 0; i < ups.Count; i++)
                        {
                            var p = ups[i];
                            io.Out($"[{i + 1}/{ups.Count}] Upgrading {PkgName(ctx, p)}-0:{Ver(p)}.x86_64   100%\n");
                            InstallPackage(sh, p);
                        }
                        sh.Flags["upgraded"] = true;
                        io.Out("Complete!\n");
                        return 0;
                    },
                    io =>
                    {
                        io.Out("Operation aborted by the user.\n");
                        return 1;
                    });
            }
            case "check-update":
            case "check-upgrade":
            {
                LoadRepos();
                var ups = Upgradable(sh);
                foreach (var p in ups) ctx.Out($"{(PkgName(ctx, p) + ".x86_64").PadRight(30)} {Ver(p).PadRight(26)} updates\n");
                // Just like the real dnf: exit code 100 means "there are updates".
                return ups.Count != 0 ? 100 : 0;
            }
            case "makecache":
                LoadRepos();
                ctx.Out("Metadata cache created.\n");
                return 0;
            case "repolist":
                ctx.Out($"repo id                          repo name\n{ReposCmd.DnfCoprRepolist(sh)}fedora                           Fedora {sh.Distro.Version} - x86_64\nupdates                          Fedora {sh.Distro.Version} - x86_64 - Updates\n");
                return 0;
            case "copr":
                return ReposCmd.DnfCopr(ctx, rest);
            case "search":
            {
                LoadRepos();
                var results = SearchPackages(fam, string.Join(" ", targets), sh);
                if (results.Count == 0)
                {
                    ctx.Out("No matches found.\n");
                    return 1;
                }
                ctx.Out("Matched fields: name, summary\n");
                foreach (var p in results) ctx.Out($" {PkgName(ctx, p)}.x86_64\t{p.Description}\n");
                return 0;
            }
            case "info":
            {
                LoadRepos();
                int code = 0;
                foreach (var t in targets)
                {
                    var p = FindPackage(fam, t, sh);
                    if (p is null)
                    {
                        ctx.Err("No matching packages to list\n");
                        code = 1;
                        continue;
                    }
                    var installedNow = IsInstalled(sh, p);
                    var parts = LastDash.Split(installedNow ? sh.Installed.Get(p.Id)! : Ver(p));
                    var version = parts[0];
                    var release = parts.Length > 1 ? parts[1] : null;
                    ctx.Out(
                        $"{(installedNow ? "Installed" : "Available")} packages\nName            : {t}\nVersion         : {version}\n" +
                        $"Release         : {release ?? "1"}\nArchitecture    : x86_64\nInstalled size  : {FormatMiB(p.SizeKb)}\n" +
                        $"Repository      : {(installedNow ? "@System" : ReposCmd.DnfRepoId(p))}\n" +
                        (installedNow ? $"From repository : {(p.Base is not null ? "anaconda" : ReposCmd.DnfRepoId(p))}\n" : "") +
                        $"Summary         : {p.Description}\n\n");
                }
                return code;
            }
            case "list":
            {
                LoadRepos();
                var installedOnly = rest.Contains("--installed") || rest.Contains("installed");
                var upgradesOnly = rest.Contains("--upgrades") || rest.Contains("upgrades");
                var list = FamilyPackages(ctx).StableSort((a, b) => Js.LocaleCompare(PkgName(ctx, a), PkgName(ctx, b)));
                string Line(PackageDef p, string v, string repo) => $"{(PkgName(ctx, p) + ".x86_64").PadRight(30)} {v.PadRight(26)} {repo}\n";
                if (upgradesOnly)
                {
                    ctx.Out("Available upgrades\n");
                    foreach (var p in Upgradable(sh)) ctx.Out(Line(p, Ver(p), "updates"));
                    return 0;
                }
                ctx.Out("Installed packages\n");
                foreach (var p in list.Where(p => IsInstalled(sh, p))) ctx.Out(Line(p, sh.Installed.Get(p.Id)!, "anaconda"));
                if (!installedOnly)
                {
                    ctx.Out("\nAvailable packages\n");
                    foreach (var p in list.Where(p => !IsInstalled(sh, p))) ctx.Out(Line(p, Ver(p), "fedora"));
                }
                return 0;
            }
        }
        ctx.Err($"Unknown argument \"{sub}\" for command \"dnf5\". Add \"--help\" for more information about the arguments.\n");
        return 2;
    }

    public static List<CommandDef> All { get; } = new() { MakeApt("apt"), MakeApt("apt-get"), Pacman, Dnf("dnf"), Dnf("dnf5") };
}
