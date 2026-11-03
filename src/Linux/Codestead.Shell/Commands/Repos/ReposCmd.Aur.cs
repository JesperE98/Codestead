namespace Codestead.Shell.Commands;

// AUR (Arch): the package catalogue, PKGBUILDs, git clone and the pacman transaction.

using static PackagesLib;

public static partial class ReposCmd
{
    private sealed class AurEntry
    {
        /// <summary>The package's id in Packages.cs.</summary>
        public required string PkgId { get; init; }
        public required string Pkgver { get; init; }
        public required string Pkgrel { get; init; }
        public required string Url { get; init; }
        public required string License { get; init; }
        public required string Maintainer { get; init; }
        public required List<string> Depends { get; init; }
        public required List<string> Makedepends { get; init; }
        public List<string>? Provides { get; init; }
        public List<string>? Conflicts { get; init; }
        /// <summary>Source files makepkg downloads.</summary>
        public required List<string> Sources { get; init; }
        /// <summary>Commands in build() – shown when the package is built. Empty for prebuilt -bin packages.</summary>
        public required List<string> Build { get; init; }
        public required List<string> Package { get; init; }
        public int Votes { get; init; }
        public double Popularity { get; init; }
    }

    private static readonly OrderedDictionary<string, AurEntry> Aur = new()
    {
        ["moonphase"] = new AurEntry
        {
            PkgId = "moonphase",
            Pkgver = "1.4.2",
            Pkgrel = "1",
            Url = "https://moonphase.example.org",
            License = "MIT",
            Maintainer = "Luna Toolsmith <luna at lunatool dot example dot org>",
            Depends = new() { "glibc" },
            Makedepends = new(),
            Sources = new() { "$pkgname-$pkgver.tar.gz::https://moonphase.example.org/releases/$pkgname-$pkgver.tar.gz" },
            Build = new() { "cd \"$pkgname-$pkgver\"", "make PREFIX=/usr" },
            Package = new() { "cd \"$pkgname-$pkgver\"", "make PREFIX=/usr DESTDIR=\"$pkgdir\" install", "install -Dm644 LICENSE \"$pkgdir/usr/share/licenses/$pkgname/LICENSE\"" },
            Votes = 87,
            Popularity = 1.42,
        },
        ["snowfall"] = new AurEntry
        {
            PkgId = "snowfall",
            Pkgver = "2.0.1",
            Pkgrel = "1",
            Url = "https://snowfall.example.org",
            License = "GPL-3.0-or-later",
            Maintainer = "Frost Pixel <frost at example dot org>",
            Depends = new() { "ncurses" },
            Makedepends = new(),
            Sources = new() { "$pkgname-$pkgver.tar.gz::https://snowfall.example.org/$pkgname-$pkgver.tar.gz" },
            Build = new() { "cd \"$pkgname-$pkgver\"", "make" },
            Package = new() { "cd \"$pkgname-$pkgver\"", "install -Dm755 snowfall \"$pkgdir/usr/bin/snowfall\"" },
            Votes = 42,
            Popularity = 0.85,
        },
        ["yay-bin"] = new AurEntry
        {
            PkgId = "yay-bin",
            Pkgver = "12.5.2",
            Pkgrel = "1",
            Url = "https://github.com/Jguer/yay",
            License = "GPL-3.0-or-later",
            Maintainer = "Jguer <pkgbuilds at jguer.space>",
            Depends = new() { "pacman>6.1", "git" },
            Makedepends = new(),
            Provides = new() { "yay" },
            Conflicts = new() { "yay" },
            Sources = new() { "https://github.com/Jguer/yay/releases/download/v$pkgver/yay_${pkgver}_x86_64.tar.gz" },
            Build = new(),
            Package = new() { "cd \"yay_${pkgver}_x86_64\"", "install -Dm755 yay \"$pkgdir/usr/bin/yay\"", "install -Dm644 yay.8 \"$pkgdir/usr/share/man/man8/yay.8\"" },
            Votes = 1350,
            Popularity = 28.9,
        },
        ["yay"] = new AurEntry
        {
            PkgId = "yay",
            Pkgver = "12.5.2",
            Pkgrel = "1",
            Url = "https://github.com/Jguer/yay",
            License = "GPL-3.0-or-later",
            Maintainer = "Jguer <pkgbuilds at jguer.space>",
            Depends = new() { "pacman>6.1", "git" },
            Makedepends = new() { "go>=1.24" },
            Conflicts = new() { "yay-bin" },
            Sources = new() { "$pkgname-$pkgver.tar.gz::https://github.com/Jguer/yay/archive/v$pkgver.tar.gz" },
            Build = new() { "export GOFLAGS=\"-buildmode=pie -trimpath -mod=readonly -modcacherw\"", "cd \"$srcdir/$pkgname-$pkgver\"", "make VERSION=$pkgver DESTDIR=\"$pkgdir\" PREFIX=\"/usr\" build" },
            Package = new() { "cd \"$srcdir/$pkgname-$pkgver\"", "make VERSION=$pkgver DESTDIR=\"$pkgdir\" PREFIX=\"/usr\" install" },
            Votes = 2480,
            Popularity = 18.3,
        },
        ["snapd"] = new AurEntry
        {
            PkgId = "snapd",
            Pkgver = "2.71",
            Pkgrel = "1",
            Url = "https://github.com/canonical/snapd",
            License = "GPL-3.0-only",
            Maintainer = "Maciej Borzecki <maciek.borzecki at gmail dot com>",
            Depends = new() { "squashfs-tools", "libseccomp", "libsystemd", "apparmor" },
            Makedepends = new() { "go" },
            Sources = new() { "$pkgname-$pkgver.tar.xz::https://github.com/canonical/$pkgname/releases/download/$pkgver/${pkgname}_$pkgver.vendor.tar.xz" },
            Build = new() { "cd \"$pkgname-$pkgver\"", "./mkversion.sh $pkgver-$pkgrel", "go build -o \"$srcdir/go/bin/snap\" ./cmd/snap", "go build -o \"$srcdir/go/bin/snapd\" ./cmd/snapd" },
            Package = new() { "cd \"$pkgname-$pkgver\"", "make -C data install DESTDIR=\"$pkgdir\" BINDIR=/usr/bin", "install -Dm755 \"$srcdir/go/bin/snap\" \"$pkgdir/usr/bin/snap\"" },
            Votes = 410,
            Popularity = 2.1,
        },
    };

    private static AurEntry? AurGet(string name) => Aur.TryGetValue(name, out var e) ? e : null;

    private static string Arr(List<string> xs) => $"({string.Join(" ", xs.Select(x => $"'{x}'"))})";

    private static string Pkgbuild(string name, AurEntry e)
    {
        var p = PkgById(e.PkgId);
        var lines = new List<string>
        {
            $"# Maintainer: {e.Maintainer}",
            "",
            $"pkgname={name}",
            $"pkgver={e.Pkgver}",
            $"pkgrel={e.Pkgrel}",
            $"pkgdesc=\"{p.Description}\"",
            "arch=('x86_64')",
            $"url=\"{e.Url}\"",
            $"license=('{e.License}')",
            $"depends={Arr(e.Depends)}",
        };
        if (e.Makedepends.Count != 0) lines.Add($"makedepends={Arr(e.Makedepends)}");
        if (e.Provides is not null) lines.Add($"provides={Arr(e.Provides)}");
        if (e.Conflicts is not null) lines.Add($"conflicts={Arr(e.Conflicts)}");
        lines.Add($"source=({string.Join(" ", e.Sources.Select(s => $"\"{s}\""))})");
        lines.Add($"sha256sums=('{"4f1c2b9e7d".Repeat(6)}6a3c')");
        lines.Add("");
        if (e.Build.Count != 0)
        {
            lines.Add("build() {");
            lines.AddRange(e.Build.Select(l => $"  {l}"));
            lines.Add("}");
            lines.Add("");
        }
        lines.Add("package() {");
        lines.AddRange(e.Package.Select(l => $"  {l}"));
        lines.Add("}");
        return string.Join("\n", lines) + "\n";
    }

    private static string Srcinfo(string name, AurEntry e)
    {
        var p = PkgById(e.PkgId);
        return
            $"pkgbase = {name}\n\tpkgdesc = {p.Description}\n\tpkgver = {e.Pkgver}\n\tpkgrel = {e.Pkgrel}\n\turl = {e.Url}\n\tarch = x86_64\n\tlicense = {e.License}\n" +
            string.Concat(e.Makedepends.Select(d => $"\tmakedepends = {d}\n")) +
            string.Concat(e.Depends.Select(d => $"\tdepends = {d}\n")) +
            $"\npkgname = {name}\n";
    }

    private static string PkgFileName(string name, AurEntry e) => $"{name}-{e.Pkgver}-{e.Pkgrel}-x86_64.pkg.tar.zst";

    private static readonly Regex AurUrl = new(@"^(?:https?://|ssh://aur@|aur@)aur\.archlinux\.org[/:]([^/]+?)(?:\.git)?/?\z", RegexOptions.CultureInvariant);

    /// <summary>
    /// `git clone https://aur.archlinux.org/PACKAGE.git [DIR]` – downloads the build recipe.
    /// Returns null if the address does not go to the AUR (then git handles it as usual).
    /// A git command that really clones should call this function first.
    /// </summary>
    public static int? AurClone(CmdCtx ctx, List<string> args)
    {
        var sh = ctx.Sh;
        var operands = args.Where(a => !a.StartsWith('-')).ToList();
        var url = operands.Count > 0 ? operands[0] : null;
        var m = !string.IsNullOrEmpty(url) ? AurUrl.Match(url) : null;
        if (m is null || !m.Success) return null;
        var name = m.Groups[1].Value;
        var dest = operands.Count > 1 ? operands[1] : name;
        var path = sh.Resolve(dest);
        var user = sh.CurrentUser();
        var existing = sh.Vfs.TryLookup(path, user);
        if (existing is not null && (existing.Type != "dir" || (existing.Children?.Count ?? 0) != 0))
        {
            ctx.Err($"fatal: destination path '{dest}' already exists and is not an empty directory.\n");
            return 128;
        }
        try
        {
            if (existing is null) sh.Vfs.Mkdir(path, user);
        }
        catch (FsError e)
        {
            ctx.Err($"fatal: could not create work tree dir '{dest}': {e.Message}\n");
            return 128;
        }
        ctx.Err($"Cloning into '{dest}'...\n");
        var g = user.Groups.FirstOrDefault();
        var dir = sh.Vfs.Lookup(path, user);
        dir.Children![".git"] = VfsLib.MakeDir(user.Name, Js.Oct(755), Kids(
            ("HEAD", VfsLib.MakeFile("ref: refs/heads/master\n", user.Name, Js.Oct(644), g)),
            ("config", VfsLib.MakeFile($"[core]\n\trepositoryformatversion = 0\n\tbare = false\n[remote \"origin\"]\n\turl = {url}\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[branch \"master\"]\n\tremote = origin\n\tmerge = refs/heads/master\n", user.Name, Js.Oct(644), g)),
            ("objects", VfsLib.MakeDir(user.Name, Js.Oct(755), Js.Obj<FsNode>(), g)),
            ("refs", VfsLib.MakeDir(user.Name, Js.Oct(755), Kids(("heads", VfsLib.MakeDir(user.Name, Js.Oct(755), Js.Obj<FsNode>(), g))), g))), g);
        var entry = AurGet(name);
        if (entry is null)
        {
            // Just like for real: the AUR lets you clone anything – if the package doesn't exist the directory is empty.
            ctx.Err("warning: You appear to have cloned an empty repository.\n");
            ctx.Err(Dim(sh, "repos.noSuchAurPackage", ("name", name)));
            return 0;
        }
        dir.Children["PKGBUILD"] = VfsLib.MakeFile(Pkgbuild(name, entry), user.Name, Js.Oct(644), g);
        dir.Children[".SRCINFO"] = VfsLib.MakeFile(Srcinfo(name, entry), user.Name, Js.Oct(644), g);
        ctx.Err(
            "remote: Enumerating objects: 24, done.\nremote: Counting objects: 100% (24/24), done.\nremote: Compressing objects: 100% (20/20), done.\n" +
            "remote: Total 24 (delta 4), reused 24 (delta 4), pack-reused 0 (from 0)\nReceiving objects: 100% (24/24), 6.12 KiB | 6.12 MiB/s, done.\nResolving deltas: 100% (4/4), done.\n");
        return 0;
    }

    private static string Bar(string label) => $"{label.PadRight(48)} [{"#".Repeat(22)}] 100%\n";

    /// <summary>Shows the package list and asks like `pacman -U`/`pacman -S`, then installs.</summary>
    private static int PacmanTransaction(CmdCtx ctx, List<PackageDef> pkgs, bool noconfirm, Func<Sink, int> done, Func<Sink, int> onNo)
    {
        var sh = ctx.Sh;
        string Full(PackageDef p) => $"{p.Names.Get("arch")}-{AvailableVersion(sh, p)}";
        var size = pkgs.Sum(p => p.SizeKb);
        ctx.Out($"loading packages...\nresolving dependencies...\nlooking for conflicting packages...\n\nPackages ({pkgs.Count}) {string.Join("  ", pkgs.Select(Full))}\n\nTotal Installed Size:  {FormatMiB(size)}\n\n");
        return AskYesNo(
            ctx,
            ":: Proceed with installation? [Y/n] ",
            true,
            noconfirm,
            io =>
            {
                var n = pkgs.Count;
                foreach (var step in new[] { "checking keys in keyring", "checking package integrity", "loading package files", "checking for file conflicts" }) io.Out(Bar($"({n}/{n}) {step}"));
                io.Out(":: Processing package changes...\n");
                for (int i = 0; i < pkgs.Count; i++)
                {
                    var p = pkgs[i];
                    // Packages that conflict (e.g. yay and yay-bin) are replaced.
                    foreach (var c in AurGet(p.Names.Get("arch")!)?.Conflicts ?? new List<string>())
                    {
                        var other = FindPackage("arch", c, sh);
                        if (other is not null && IsInstalled(sh, other))
                        {
                            io.Out($":: {p.Names.Get("arch")} and {c} are in conflict. Removing {c}.\n");
                            RemovePackage(sh, other);
                        }
                    }
                    io.Out(Bar($"({i + 1}/{n}) {(IsInstalled(sh, p) ? "reinstalling" : "installing")} {p.Names.Get("arch")}"));
                    InstallPackage(sh, p);
                }
                io.Out(":: Running post-transaction hooks...\n(1/1) Arming ConditionNeedsUpdate...\n");
                return done(io);
            },
            onNo);
    }

    private static readonly Regex VersionConstraint = new(@"[<>=].*\z", RegexOptions.CultureInvariant);

    /// <summary>Dependencies (from Arch's normal repositories) that are missing. Unknown names such as glibc count as installed.</summary>
    private static List<(string Spec, PackageDef Pkg)> MissingDeps(Shell sh, IEnumerable<string> deps)
    {
        var result = new List<(string Spec, PackageDef Pkg)>();
        foreach (var spec in deps)
        {
            var pkg = FindPackage("arch", VersionConstraint.Replace(spec, "", 1), sh);
            if (pkg is not null && !IsInstalled(sh, pkg) && !IsForeign("arch", pkg)) result.Add((spec, pkg));
        }
        return result;
    }
}
