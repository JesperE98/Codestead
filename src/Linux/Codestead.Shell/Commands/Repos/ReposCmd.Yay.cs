namespace Codestead.Shell.Commands;

// The yay command (AUR helper): pacman plus packages from the AUR in one command.

using static PackagesLib;

public static partial class ReposCmd
{
    private static List<string> AurSearch(string query)
    {
        var q = query.ToLowerInvariant();
        return Aur.Keys
            .Where(n => n.Contains(q) || PkgById(Aur[n].PkgId).Description.ToLowerInvariant().Contains(q))
            .ToList()
            .SortJs();
    }

    private static readonly CommandDef Yay = new()
    {
        Name = "yay",
        Summary = "AUR-hjälpare: pacman + paket från AUR i ett och samma kommando",
        SummaryEn = "AUR helper: pacman plus packages from the AUR in one command",
        Man = """
NAMN
       yay - Yet Another Yogurt, en AUR-hjälpare för Arch Linux

SYNOPSIS
       yay [ÅTGÄRD] [PAKET]...

BESKRIVNING
       yay fungerar som pacman men hittar även paket i AUR. För dem hämtar
       den PKGBUILD, bygger med makepkg och installerar – allt det du annars
       gör för hand. yay körs som vanlig användare (inte med sudo) och
       använder sudo själv när något ska installeras.

       yay finns inte i Archs förråd. Man installerar den från AUR en gång
       med git clone + makepkg -si (paketet yay eller yay-bin).

VANLIGA KOMMANDON
       yay                 samma som yay -Syu
       yay -Syu            uppgradera allt, även AUR-paket
       yay -S PAKET        installera från förråden eller AUR
       yay -Ss ORD         sök i förråden och i AUR
       yay -Si PAKET       information om ett paket
       yay -R PAKET        ta bort (som pacman -R)

FLAGGOR
       --noconfirm         fråga inte om bekräftelse
""",
        ManEn = """
NAME
       yay - Yet Another Yogurt, an AUR helper for Arch Linux

SYNOPSIS
       yay [OPERATION] [PACKAGE]...

DESCRIPTION
       yay works like pacman but also finds packages in the AUR. For those
       it downloads the PKGBUILD, builds it with makepkg and installs it -
       everything you otherwise do by hand. yay runs as a normal user (not
       with sudo) and uses sudo itself when something is installed.

       yay is not in the Arch repositories. You install it from the AUR
       once with git clone + makepkg -si (the package yay or yay-bin).

COMMON COMMANDS
       yay                 same as yay -Syu
       yay -Syu            upgrade everything, AUR packages too
       yay -S PACKAGE      install from the repositories or the AUR
       yay -Ss WORD        search the repositories and the AUR
       yay -Si PACKAGE     information about a package
       yay -R PACKAGE      remove (like pacman -R)

OPTIONS
       --noconfirm         don't ask for confirmation
""",
        Run = RunYay,
    };

    private static readonly Regex ShortFlags = new(@"^-[A-Za-z]+\z", RegexOptions.CultureInvariant);
    private static readonly Regex YuRe = new("[yu]", RegexOptions.CultureInvariant);

    private static int RunYay(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var args = ctx.Args.Count != 0 ? ctx.Args : new List<string> { "-Syu" };
        if (args[0] == "--version" || args[0] == "-V")
        {
            ctx.Out("yay v12.5.2 - libalpm v15.0.0\n");
            return 0;
        }
        var noconfirm = args.Contains("--noconfirm");
        var flags = string.Concat(args.Where(a => ShortFlags.IsMatch(a))).Replace("-", "");
        var targets = args.Where(a => !a.StartsWith('-')).ToList();
        var opChar = flags.FirstOrDefault(c => c >= 'A' && c <= 'Z');
        var op = opChar == default ? null : opChar.ToString();
        string mods;
        if (op is not null)
        {
            int at = flags.IndexOf(op, StringComparison.Ordinal);
            mods = flags.Remove(at, 1);
        }
        else mods = "";
        int AsRootPacman(List<string> argv) => sh.RunAs("root", () => sh.Invoke(new List<string> { "pacman" }.Concat(argv).ToList(), ctx));
        List<string> NoconfirmArg() => noconfirm ? new List<string> { "--noconfirm" } : new List<string>();

        // Only search terms (e.g. "yay moonphase") search and let you choose – here: show the search result.
        if (op is null && targets.Count != 0) return RunYay(new CmdCtx(ctx, ctx.Sh, ctx.Name, new List<string> { "-Ss" }.Concat(targets).ToList()));

        if (op == "S" && mods.Contains('s'))
        {
            var q = string.Join(" ", targets);
            var repo = SearchPackages("arch", q, sh).Where(p => !IsForeign("arch", p)).ToList();
            foreach (var p in repo)
            {
                ctx.Out($"{p.ArchRepo ?? "extra"}/{p.Names.Get("arch")} {AvailableVersion(sh, p)}{(IsInstalled(sh, p) ? " (Installed)" : "")}\n    {p.Description}\n");
            }
            var aur = AurSearch(q);
            foreach (var n in aur)
            {
                var e = Aur[n];
                var p = PkgById(e.PkgId);
                var inst = IsInstalled(sh, p) && p.Names.Get("arch") == n ? " (Installed)" : "";
                ctx.Out($"aur/{n} {e.Pkgver}-{e.Pkgrel} (+{e.Votes} {Js.ToFixed(e.Popularity, 2)}){inst}\n    {p.Description}\n");
            }
            return repo.Count != 0 || aur.Count != 0 ? 0 : 1;
        }
        if (op == "S" && mods.Contains('i') && targets.All(t => AurGet(t) is not null))
        {
            foreach (var t in targets)
            {
                var e = Aur[t];
                var p = PkgById(e.PkgId);
                var makeDeps = string.Join("  ", e.Makedepends);
                ctx.Out(
                    $"Repository      : aur\nName            : {t}\nVersion         : {e.Pkgver}-{e.Pkgrel}\nDescription     : {p.Description}\nURL             : {e.Url}\n" +
                    $"AUR URL         : https://aur.archlinux.org/packages/{t}\nLicenses        : {e.License}\nDepends On      : {string.Join("  ", e.Depends)}\n" +
                    $"Make Deps       : {(makeDeps != "" ? makeDeps : "None")}\nVotes           : {e.Votes}\nPopularity      : {Js.Num(e.Popularity)}\nMaintainer      : {e.Maintainer.Split(" <")[0]}\n\n");
            }
            return 0;
        }
        if (op == "S" && (mods.Contains('u') || mods.Contains('y')) && targets.Count == 0)
        {
            if (IsRoot(sh)) ctx.Err(" -> Avoid running yay as root/sudo.\n");
            if (mods.Contains('u'))
            {
                ctx.Out(":: Searching AUR for updates...\n");
                var aurInstalled = Packages.Where(p => IsForeign("arch", p) && IsInstalled(sh, p)).ToList();
                ctx.Out(aurInstalled.Count != 0 ? $" -> {aurInstalled.Count} AUR package(s) checked, all up to date\n" : " -> No AUR packages installed\n");
            }
            return AsRootPacman(new List<string> { $"-S{mods}" }.Concat(NoconfirmArg()).ToList());
        }
        if (op == "S" && YuRe.Replace(mods, "") == "")
        {
            var aurTargets = targets.Where(t => AurGet(t) is not null).ToList();
            var repoTargets = targets.Where(t => AurGet(t) is null).ToList();
            foreach (var t in repoTargets)
            {
                var p = FindPackage("arch", t, sh);
                if (p is null || IsForeign("arch", p))
                {
                    ctx.Err($" -> No AUR package found for {t}\n -> Could not find all required packages:\n\t{t} (Target)\n");
                    return 1;
                }
            }
            if (aurTargets.Count == 0) return AsRootPacman(new List<string> { $"-S{mods}" }.Concat(NoconfirmArg()).Concat(repoTargets).ToList());
            if (IsRoot(sh))
            {
                ctx.Err(" -> Refusing to install AUR packages as root, aborting.\n");
                return 1;
            }
            if (!Has(sh, "base-devel"))
            {
                ctx.Err(" -> Missing dependency: base-devel\n");
                ctx.Err(Dim(sh, "repos.baseDevelTip"));
                return 1;
            }
            var user = sh.CurrentUser();
            var g = user.Groups.FirstOrDefault();
            var deps = MissingDeps(sh, aurTargets.SelectMany(t => Aur[t].Depends.Concat(Aur[t].Makedepends)));
            var repoPkgs = repoTargets.Select(t => FindPackage("arch", t, sh)!).ToList();
            ctx.Out(
                (repoPkgs.Count != 0 ? $"Sync Explicit ({repoPkgs.Count}): {string.Join(", ", repoPkgs.Select(p => $"{p.Names.Get("arch")}-{AvailableVersion(sh, p)}"))}\n" : "") +
                $"AUR Explicit ({aurTargets.Count}): {string.Join(", ", aurTargets.Select(t => $"{t}-{Aur[t].Pkgver}-{Aur[t].Pkgrel}"))}\n" +
                (deps.Count != 0 ? $"Sync Make Dependency ({deps.Count}): {string.Join(", ", deps.Select(d => $"{d.Pkg.Names.Get("arch")}-{AvailableVersion(sh, d.Pkg)}"))}\n" : ""));
            for (int i = 0; i < aurTargets.Count; i++)
            {
                var t = aurTargets[i];
                var e = Aur[t];
                ctx.Out($":: ({i + 1}/{aurTargets.Count}) Downloaded PKGBUILD: {t}\n");
                var cache = $"{sh.Home}/.cache/yay/{t}";
                // The build directory in ~/.cache/yay – you can read the PKGBUILD there afterwards.
                var path = "";
                foreach (var seg in cache.Split('/').Where(s => s != ""))
                {
                    path += "/" + seg;
                    if (sh.Vfs.TryLookup(path, user) is null) sh.Vfs.Mkdir(path, user);
                }
                sh.Vfs.Insert($"{cache}/PKGBUILD", VfsLib.MakeFile(Pkgbuild(t, e), user.Name, Js.Oct(644), g), user);
                var built = VfsLib.MakeFile($"(built package {t} - simulated)\n", user.Name, Js.Oct(644), g);
                built.Size = Round(PkgById(e.PkgId).SizeKb * 400);
                sh.Vfs.Insert($"{cache}/{PkgFileName(t, e)}", built, user);
            }
            ctx.Out(Dim(sh, "repos.yayPkgbuildHint"));
            foreach (var t in aurTargets)
            {
                var e = Aur[t];
                ctx.Out($"==> Making package: {t} {e.Pkgver}-{e.Pkgrel} ({UtilCmd.LongDate()})\n==> Retrieving sources...\n==> Extracting sources...\n");
                if (e.Build.Count != 0) ctx.Out("==> Starting build()...\n");
                ctx.Out($"==> Entering fakeroot environment...\n==> Starting package()...\n==> Creating package \"{t}\"...\n==> Leaving fakeroot environment.\n==> Finished making: {t} {e.Pkgver}-{e.Pkgrel} ({UtilCmd.LongDate()})\n");
            }
            var all = deps.Select(d => d.Pkg).Concat(repoPkgs).Concat(aurTargets.Select(t => PkgById(Aur[t].PkgId))).ToList();
            return sh.RunAs("root", () => PacmanTransaction(ctx, all, noconfirm, _ => 0, _ => 1));
        }
        // Everything else (-Q, -R, -Si for normal packages ...) is passed on to pacman.
        var needsRoot = op == "R" || op == "S" || op == "U";
        return needsRoot ? AsRootPacman(args) : sh.Invoke(new List<string> { "pacman" }.Concat(args).ToList(), ctx);
    }
}
