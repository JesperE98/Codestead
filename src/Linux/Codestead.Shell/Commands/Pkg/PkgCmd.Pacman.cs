namespace Codestead.Shell.Commands;

// The pacman command: the package manager in Arch Linux.

using static PackagesLib;

public static partial class PkgCmd
{
    private static string ReplaceFirst(string s, string find)
    {
        int i = s.IndexOf(find, StringComparison.Ordinal);
        return i < 0 ? s : s.Remove(i, find.Length);
    }

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
                        $"Description     : {p.Description}\nArchitecture    : x86_64\nDownload Size   : {FormatMiB(p.SizeKb * 0.4)}\n" +
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
                        ctx.Err($"{UtilCmd.Color.Dim}{sh.Msg("pkg.onlyInAur", ("pkg", t))}{UtilCmd.Color.Reset}\n");
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
                $"Total Download Size:   {FormatMiB(size * 0.4)}\nTotal Installed Size:  {FormatMiB(size)}\n\n");
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
}
