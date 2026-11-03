namespace Codestead.Shell.Commands;

// The makepkg command: builds an Arch package from a PKGBUILD (e.g. from the AUR).

public static partial class ReposCmd
{
    /// <summary>{ ...ctx, ...asIO(io) }</summary>
    private static CmdCtx WithIO(CmdCtx ctx, Sink io) => new(new IO(io.OutFn, io.ErrFn, null, true, ctx.Reader), ctx.Sh, ctx.Name, ctx.Args);

    private static readonly Regex PkgnameVar = new(@"\$\{?pkgname\}?", RegexOptions.CultureInvariant);
    private static readonly Regex PkgverVar = new(@"\$\{?pkgver\}?", RegexOptions.CultureInvariant);

    /// <summary>The file names of the source files with $pkgname and $pkgver filled in.</summary>
    private static List<string> SourceFiles(string name, AurEntry e) =>
        e.Sources.Select(s =>
        {
            var filled = PkgverVar.Replace(PkgnameVar.Replace(s, _ => name), _ => e.Pkgver);
            return filled.Contains("::") ? filled.Split("::")[0] : filled.Slice(filled.LastIndexOf('/') + 1);
        }).ToList();

    private const string MakepkgTidy = "==> Tidying install...\n  -> Removing libtool files...\n  -> Purging unwanted files...\n  -> Removing static library files...\n  -> Stripping unneeded symbols from binaries and libraries...\n  -> Compressing man and info pages...\n==> Checking for packaging issues...\n";

    private static readonly CommandDef Makepkg = new()
    {
        Name = "makepkg",
        Summary = "Bygger ett Arch-paket från en PKGBUILD (t.ex. från AUR)",
        SummaryEn = "Builds an Arch package from a PKGBUILD (e.g. from the AUR)",
        Man = """
NAMN
       makepkg - bygg paket från en PKGBUILD

SYNOPSIS
       makepkg [-s] [-i] [-c] [-f] [--noconfirm]

BESKRIVNING
       Läser filen PKGBUILD i den aktuella katalogen, hämtar källkoden,
       bygger programmet och packar det som en .pkg.tar.zst-fil som
       pacman kan installera. Så installerar man paket från AUR:

           git clone https://aur.archlinux.org/PAKET.git
           cd PAKET
           less PKGBUILD        (läs alltid receptet först!)
           makepkg -si

       makepkg vägrar köras som root – bygg som vanlig användare.
       Installationssteget (-i) använder sudo pacman själv. Paketgruppen
       base-devel (med bl.a. gcc, make och fakeroot) behövs för att bygga.

FLAGGOR
       -s, --syncdeps    installera beroenden som saknas med pacman
       -i, --install     installera paketet efter bygget
       -c, --clean       städa bort byggfilerna efteråt
       -f, --force       bygg om även om paketet redan är byggt
       --noconfirm       fråga inte om bekräftelse

EXEMPEL
       makepkg -si
""",
        ManEn = """
NAME
       makepkg - build packages from a PKGBUILD

SYNOPSIS
       makepkg [-s] [-i] [-c] [-f] [--noconfirm]

DESCRIPTION
       Reads the file PKGBUILD in the current directory, downloads the
       source code, builds the program and packs it as a .pkg.tar.zst
       file that pacman can install. This is how packages from the AUR
       are installed:

           git clone https://aur.archlinux.org/PACKAGE.git
           cd PACKAGE
           less PKGBUILD        (always read the recipe first!)
           makepkg -si

       makepkg refuses to run as root - build as a normal user. The
       install step (-i) uses sudo pacman itself. The base-devel package
       group (gcc, make, fakeroot ...) is needed to build.

OPTIONS
       -s, --syncdeps    install missing dependencies with pacman
       -i, --install     install the package after building it
       -c, --clean       clean up the build files afterwards
       -f, --force       rebuild even if the package is already built
       --noconfirm       don't ask for confirmation

EXAMPLES
       makepkg -si
""",
        Run = RunMakepkg,
    };

    private static readonly Regex PkgnameLine = new(@"^pkgname=['""]?([^'""\s]+)", RegexOptions.Multiline | RegexOptions.CultureInvariant);
    private static readonly Regex SourceLine = new(@"^source=\([""']?([^""'\s)]+)", RegexOptions.Multiline | RegexOptions.CultureInvariant);
    private static readonly Regex BinSuffix = new(@"-bin\z", RegexOptions.CultureInvariant);

    private static int RunMakepkg(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
        {
            Flags = "sicfrCLhV",
            Long = new()
            {
                ["syncdeps"] = "s", ["install"] = "i", ["clean"] = "c", ["force"] = "f", ["rmdeps"] = "r", ["cleanbuild"] = "C",
                ["log"] = "L", ["help"] = "h", ["version"] = "V", ["noconfirm"] = "N", ["needed"] = "n",
            },
        });
        if (o.Error is not null)
        {
            ctx.Err($"==> ERROR: {o.Error}\n");
            return 1;
        }
        if (o.Flags.Contains("V"))
        {
            ctx.Out("makepkg (pacman) 7.0.0\n");
            return 0;
        }
        if (o.Flags.Contains("h"))
        {
            ctx.Out("makepkg (pacman) 7.0.0\nMake packages compatible for use with pacman\n\nUsage: makepkg [options]\n\nOptions:\n  -c, --clean      Clean up work files after build\n  -f, --force      Overwrite existing package\n  -i, --install    Install package after successful build\n  -s, --syncdeps   Install missing dependencies with pacman\n  --noconfirm      Do not ask for confirmation when resolving dependencies\n");
            return 0;
        }
        if (IsRoot(sh))
        {
            ctx.Err("==> ERROR: Running makepkg as root is not allowed as it can cause permanent,\ncatastrophic damage to your system.\n");
            ctx.Err(Dim(sh, "repos.makepkgNoSudo"));
            return 10;
        }
        var dir = sh.Cwd;
        var user = sh.CurrentUser();
        string recipe;
        try
        {
            recipe = sh.Vfs.ReadFile($"{dir}/PKGBUILD", user);
        }
        catch (FsError)
        {
            ctx.Err("==> ERROR: PKGBUILD does not exist.\n");
            if (sh.Vfs.TryLookup($"{dir}/.git", user) is not null)
            {
                ctx.Err(Dim(sh, "repos.emptyDirectory"));
            }
            return 1;
        }
        var nm = PkgnameLine.Match(recipe);
        var name = nm.Success ? nm.Groups[1].Value : VfsLib.Basename(dir);
        var entry = AurGet(name);
        if (!Has(sh, "base-devel"))
        {
            ctx.Err("==> ERROR: Cannot find the fakeroot binary.\n");
            ctx.Err(Dim(sh, "repos.installBaseDevel"));
            return 1;
        }
        if (entry is null)
        {
            var sm = SourceLine.Match(recipe);
            var src = sm.Success ? sm.Groups[1].Value : name;
            ctx.Out($"==> Making package: {name} ({UtilCmd.LongDate()})\n==> Retrieving sources...\n");
            ctx.Err($"==> ERROR: Failure while downloading {src}\n    Aborting...\n");
            ctx.Err(Dim(sh, "repos.onlyPretendAur"));
            return 1;
        }
        var pkg = PkgById(entry.PkgId);
        var full = $"{name} {entry.Pkgver}-{entry.Pkgrel}";
        var pkgFile = $"{dir}/{PkgFileName(name, entry)}";
        var noconfirm = o.Flags.Contains("N");

        int Install(Sink io)
        {
            io.Out($"==> Installing package {name} with pacman -U...\n");
            return sh.RunAs("root", () =>
                PacmanTransaction(
                    WithIO(ctx, io),
                    new List<PackageDef> { pkg },
                    noconfirm,
                    _ => 0,
                    io2 =>
                    {
                        io2.Out("==> WARNING: Failed to install built package(s).\n");
                        return 0;
                    }));
        }

        if (sh.Vfs.TryLookup(pkgFile, user) is not null && !o.Flags.Contains("f"))
        {
            if (o.Flags.Contains("i"))
            {
                ctx.Err("==> WARNING: A package has already been built, installing existing package...\n");
                return Install(ctx);
            }
            ctx.Err("==> ERROR: A package has already been built. (use -f to overwrite)\n");
            return 13;
        }

        int Build(Sink io)
        {
            var g = user.Groups.FirstOrDefault();
            void Write(string path, FsNode node) => sh.Vfs.Insert(path, node, user);
            try
            {
                io.Out("==> Retrieving sources...\n");
                foreach (var f in SourceFiles(name, entry))
                {
                    io.Out($"  -> Downloading {f}...\n");
                    var node = VfsLib.MakeFile($"(source code of {name} - simulated)\n", user.Name, Js.Oct(644), g);
                    node.Size = Round(pkg.SizeKb * 300);
                    Write($"{dir}/{f}", node);
                }
                io.Out("==> Validating source files with sha256sums...\n");
                foreach (var f in SourceFiles(name, entry)) io.Out($"    {f} ... Passed\n");
                io.Out("==> Removing existing $srcdir/ directory...\n==> Extracting sources...\n");
                foreach (var f in SourceFiles(name, entry)) io.Out($"  -> Extracting {f} with bsdtar\n");
                Write($"{dir}/src", VfsLib.MakeDir(user.Name, Js.Oct(755), Kids(($"{name}-{entry.Pkgver}", VfsLib.MakeDir(user.Name, Js.Oct(755), Js.Obj<FsNode>(), g))), g));
                if (entry.Build.Count != 0)
                {
                    io.Out("==> Starting build()...\n");
                    if (name == "yay" || name == "snapd") io.Out($"go: downloading modules for {name}...\ngo build -trimpath -buildmode=pie -o {(name == "yay" ? "yay" : "snap")} .\n");
                    else io.Out($"cc -O2 -pipe -fno-plt -fexceptions -Wall -o {name} src/main.c src/{(name == "moonphase" ? "phase" : "flakes")}.c {(name == "moonphase" ? "-lm" : "-lncursesw")}\n");
                }
                io.Out("==> Entering fakeroot environment...\n==> Starting package()...\n");
                io.Out($"install -Dm755 {BinSuffix.Replace(name, "", 1)} \"{dir}/pkg/{name}/usr/bin/{(pkg.Provides.Count > 0 ? pkg.Provides[0] : name)}\"\n");
                Write($"{dir}/pkg", VfsLib.MakeDir(user.Name, Js.Oct(755), Kids((name, VfsLib.MakeDir(user.Name, Js.Oct(755), Js.Obj<FsNode>(), g))), g));
                io.Out(MakepkgTidy);
                io.Out($"==> Creating package \"{name}\"...\n  -> Generating .PKGINFO file...\n  -> Generating .BUILDINFO file...\n  -> Generating .MTREE file...\n  -> Compressing package...\n");
                var outFile = VfsLib.MakeFile($"(built package {name}-{entry.Pkgver}-{entry.Pkgrel} - simulated)\n", user.Name, Js.Oct(644), g);
                outFile.Size = Round(pkg.SizeKb * 400);
                Write(pkgFile, outFile);
                io.Out($"==> Leaving fakeroot environment.\n==> Finished making: {full} ({UtilCmd.LongDate()})\n");
                if (o.Flags.Contains("c"))
                {
                    io.Out("==> Cleaning up...\n");
                    sh.Vfs.Remove($"{dir}/src", user);
                    sh.Vfs.Remove($"{dir}/pkg", user);
                }
            }
            catch (FsError e)
            {
                io.Err($"==> ERROR: Cannot write to the build directory: {e.Message}\n");
                return 1;
            }
            return o.Flags.Contains("i") ? Install(io) : 0;
        }

        ctx.Out($"==> Making package: {full} ({UtilCmd.LongDate()})\n==> Checking runtime dependencies...\n==> Checking buildtime dependencies...\n");
        var missing = MissingDeps(sh, entry.Depends.Concat(entry.Makedepends));
        if (missing.Count == 0) return Build(ctx);
        var missingList = string.Concat(missing.Select(m => $"  -> {m.Spec}\n"));
        if (!o.Flags.Contains("s"))
        {
            ctx.Err($"==> Missing dependencies:\n{missingList}==> ERROR: Could not resolve all dependencies.\n");
            ctx.Err(Dim(sh, "repos.makepkgSyncDeps"));
            return 8;
        }
        ctx.Out("==> Installing missing dependencies...\n");
        return sh.RunAs("root", () =>
            PacmanTransaction(ctx, missing.Select(m => m.Pkg).ToList(), noconfirm, io => sh.RunAs(user.Name, () => Build(io)), io =>
            {
                io.Err($"==> ERROR: 'pacman' failed to install missing dependencies.\n==> Missing dependencies:\n{missingList}==> ERROR: Could not resolve all dependencies.\n");
                return 8;
            }));
    }
}
