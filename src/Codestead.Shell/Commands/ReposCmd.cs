namespace Codestead.Shell.Commands;

// Port of src/shell/commands/repos.ts
// Repositories outside the distribution's own:
//   - PPA (Ubuntu, and at your own risk Debian): add-apt-repository + apt
//   - AUR (Arch): git clone + makepkg, and the AUR helper yay
//   - COPR (Fedora): dnf copr enable/disable/list
// Plus the made-up programs installed from there (moonphase, snowfall).
// The functions at the bottom are called from apt, pacman and dnf in PkgCmd.cs.

using static ExtrarepoLib;
using static PackagesLib;

public static partial class ReposCmd
{
    private static bool IsRoot(Shell sh) => sh.CurrentUser().Uid == 0;
    private static string Dim(Shell sh, string key, params (string Name, object? Value)[] args) => $"{UtilCmd.Color.Dim}{sh.Msg(key, args)}{UtilCmd.Color.Reset}\n";
    private static PackageDef PkgById(string id) => Packages.FirstOrDefault(p => p.Id == id)!;
    /// <summary>sh.installed[id] used as a truth value.</summary>
    private static bool Has(Shell sh, string id) => !string.IsNullOrEmpty(sh.Installed.Get(id));
    private static string TrimSlash(string s) => s.EndsWith('/') ? s[..^1] : s;
    /// <summary>Math.round for non-negative numbers.</summary>
    private static long Round(double v) => (long)Math.Floor(v + 0.5);

    private static OrderedDictionary<string, FsNode> Kids(params (string Name, FsNode Node)[] items)
    {
        var d = Js.Obj<FsNode>();
        foreach (var (name, node) in items) d[name] = node;
        return d;
    }

    private static readonly Regex YesRe = new(@"^(y|yes|j|ja)\z", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    /// <summary>
    /// Asks yes/no unless assumeYes. If input comes from a pipe the answer is read from there.
    /// (The same behaviour as the package managers in PkgCmd.cs.)
    /// </summary>
    public static int AskYesNo(CmdCtx ctx, string question, bool defaultYes, bool assumeYes, Func<Sink, int> onYes, Func<Sink, int> onNo)
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

    /// <summary>An IO for running another command from an answer to a question.</summary>
    private static IO AsIO(Sink io) => new(io.OutFn, io.ErrFn, null, true);

    /// <summary>{ ...ctx, ...asIO(io) }</summary>
    private static CmdCtx WithIO(CmdCtx ctx, Sink io) => new(new IO(io.OutFn, io.ErrFn, null, true, ctx.Reader), ctx.Sh, ctx.Name, ctx.Args);

    /// <summary>Writes a file as root and creates the directories needed.</summary>
    private static void WriteRootFile(Shell sh, string path, string content)
    {
        EnsureDir(sh, path.Slice(0, path.LastIndexOf('/')));
        sh.Vfs.WriteFile(path, content, sh.RootUser());
    }

    // ================================================================ PPA

    private sealed class PpaInfo
    {
        public required string Description { get; init; }
        public required string DisplayName { get; init; }
        /// <summary>Packages (ids in Packages.cs) in the PPA.</summary>
        public required List<string> Packages { get; init; }
    }

    private static readonly Dictionary<string, PpaInfo> Ppas = new()
    {
        ["lunatool/moonphase"] = new PpaInfo
        {
            DisplayName = "Moonphase",
            Description = "Stable releases of moonphase – shows the phase of the moon in your terminal.\nBuilt for Ubuntu 24.04 LTS (noble).",
            Packages = new() { "moonphase" },
        },
    };

    private static string PpaKey(Ppa p) => $"{p.User}/{p.Name}";

    private static string PpaSources(Ppa p) =>
        $"Types: deb\nURIs: {PpaUri(p)}\nSuites: {PpaSuite}\nComponents: main\nSigned-By:\n" +
        " -----BEGIN PGP PUBLIC KEY BLOCK-----\n .\n mQINBGcx5aEBEADJq3s1mUlEf0lunatoolsimuleradnyckel4QkZb9TnW0c2Lm\n" +
        " =x7Qe\n -----END PGP PUBLIC KEY BLOCK-----\n";

    private static readonly Regex PpaUriLine = new(
        $@"^URIs:\s*https?://{PpaHost.Replace(".", "\\.")}/([^/\s]+)/([^/\s]+)/ubuntu/?\s*$",
        RegexOptions.Multiline | RegexOptions.CultureInvariant);

    /// <summary>All PPAs that exist as .sources files in /etc/apt/sources.list.d.</summary>
    private static List<Ppa> ConfiguredPpas(Shell sh)
    {
        var dir = sh.Vfs.TryLookup("/etc/apt/sources.list.d", sh.RootUser());
        var result = new List<Ppa>();
        foreach (var node in dir?.Children?.Values ?? Enumerable.Empty<FsNode>())
        {
            var m = PpaUriLine.Match(node.Content ?? "");
            if (node.Type == "file" && m.Success) result.Add(new Ppa { User = m.Groups[1].Value, Name = m.Groups[2].Value });
        }
        return result;
    }

    /// <summary>
    /// Called by `apt update`: downloads package lists for added PPAs and removes the lists
    /// of PPAs that no longer exist. <paramref name="first"/> is the number of the first line (Get:N).
    /// </summary>
    public static void AptUpdatePpas(CmdCtx ctx, int first)
    {
        var sh = ctx.Sh;
        var root = sh.RootUser();
        var ppas = ConfiguredPpas(sh);
        for (int i = 0; i < ppas.Count; i++)
        {
            var p = ppas[i];
            var @base = $"{TrimSlash(PpaUri(p))} {PpaSuite}";
            if (sh.Vfs.TryLookup(PpaListPath(p), root) is not null)
            {
                ctx.Out($"Hit:{first + i} {@base} InRelease\n");
            }
            else if (!Ppas.ContainsKey(PpaKey(p)))
            {
                ctx.Out($"Ign:{first + i} {@base} InRelease\nErr:{first + i} {@base} Release\n  404  Not Found [IP: 185.125.190.80 443]\n");
                ctx.Err($"E: The repository '{@base} Release' does not have a Release file.\nN: Updating from such a repository can't be done securely, and is therefore disabled by default.\n");
            }
            else
            {
                ctx.Out($"Get:{first + i} {@base} InRelease [17.8 kB]\nGet:{first + i + 1} {@base}/main amd64 Packages [1,024 B]\n");
                WriteRootFile(sh, PpaListPath(p), $"Origin: LP-PPA-{p.User}-{p.Name}\nLabel: {Ppas[PpaKey(p)].DisplayName}\nSuite: {PpaSuite}\n");
            }
        }
        // Package lists from PPAs that have been removed disappear on the next update.
        var lists = sh.Vfs.TryLookup("/var/lib/apt/lists", root);
        foreach (var name in (lists?.Children?.Keys ?? Enumerable.Empty<string>()).ToList())
        {
            if (!name.StartsWith(PpaHost + "_")) continue;
            if (!ppas.Any(p => PpaListPath(p).EndsWith("/" + name))) lists!.Children!.Remove(name);
        }
    }

    /// <summary>The line `apt install` shows when a package is downloaded from a PPA (otherwise null).</summary>
    public static string? AptPpaMirror(PackageDef p)
    {
        var deb = p.ExtraRepo?.Get("debian");
        var ppa = !string.IsNullOrEmpty(deb) ? ParsePpa(deb) : null;
        return ppa is not null ? $"{TrimSlash(PpaUri(ppa))} {PpaSuite}/main amd64" : null;
    }

    /// <summary>`apt policy [PACKAGE]` – where do the packages come from, and with which priority?</summary>
    public static int AptPolicy(CmdCtx ctx, List<string> names)
    {
        var sh = ctx.Sh;
        var d = sh.Distro;
        var mirror = (d.Mirrors.Count > 0 ? d.Mirrors[0] : "http://deb.debian.org/debian").Split(' ')[0];
        if (names.Count == 0)
        {
            ctx.Out("Package files:\n 100 /var/lib/dpkg/status\n     release a=now\n");
            foreach (var p in ConfiguredPpas(sh))
            {
                if (sh.Vfs.TryLookup(PpaListPath(p), sh.RootUser()) is null) continue;
                ctx.Out($" 500 {TrimSlash(PpaUri(p))} {PpaSuite}/main amd64 Packages\n     release v=24.04,o=LP-PPA-{p.User}-{p.Name},a={PpaSuite},n={PpaSuite},l={Ppas.GetValueOrDefault(PpaKey(p))?.DisplayName ?? p.Name},c=main,b=amd64\n");
            }
            if (sh.Flags.TryGetValue("repoSynced", out var synced) && synced) ctx.Out($" 500 {mirror} {d.Codename}/main amd64 Packages\n     release a={d.Codename},n={d.Codename},c=main,b=amd64\n");
            ctx.Out("Pinned packages:\n");
            return 0;
        }
        foreach (var n in names)
        {
            var p = FindPackage("debian", n, sh);
            if (p is null)
            {
                ctx.Err($"N: Unable to locate package {n}\n");
                continue;
            }
            var installed = IsInstalled(sh, p) ? sh.Installed.Get(p.Id) : null;
            var ppaLine = AptPpaMirror(p);
            var deb = p.ExtraRepo?.Get("debian");
            var ppa = !string.IsNullOrEmpty(deb) ? ParsePpa(deb) : null;
            var candidateHere = ppa is not null
                ? sh.Vfs.TryLookup(PpaListPath(ppa), sh.RootUser()) is not null
                : sh.Flags.TryGetValue("repoSynced", out var rs) && rs;
            var candidate = candidateHere ? AvailableVersion(sh, p) : installed;
            ctx.Out($"{n}:\n  Installed: {installed ?? "(none)"}\n  Candidate: {candidate ?? "(none)"}\n  Version table:\n");
            if (candidateHere)
            {
                ctx.Out($" {(installed == candidate ? "***" : "   ")} {candidate} 500\n        500 {ppaLine ?? $"{mirror} {d.Codename}/main amd64"} Packages\n");
                if (installed == candidate) ctx.Out("        100 /var/lib/dpkg/status\n");
            }
            if (!string.IsNullOrEmpty(installed) && (installed != candidate || !candidateHere)) ctx.Out($" *** {installed} 100\n        100 /var/lib/dpkg/status\n");
        }
        return 0;
    }

    private static readonly Regex UrisRe = new(@"^URIs:\s*(\S+)", RegexOptions.Multiline | RegexOptions.CultureInvariant);
    private static readonly Regex SuitesRe = new(@"^Suites:\s*(.+)$", RegexOptions.Multiline | RegexOptions.CultureInvariant);
    private static readonly Regex ComponentsRe = new(@"^Components:\s*(.+)$", RegexOptions.Multiline | RegexOptions.CultureInvariant);
    private static readonly Regex WsRe = new(@"\s+", RegexOptions.CultureInvariant);
    private static readonly Regex ComponentRe = new(@"^(main|restricted|universe|multiverse)\z", RegexOptions.CultureInvariant);

    private const string AddAptUsage = "usage: add-apt-repository [-h] [-d] [-r] [-s] [-c COMPONENT] [-p POCKET] [-y] [-n] [-L] [line]";

    private static readonly CommandDef AddAptRepository = new()
    {
        Name = "add-apt-repository",
        Summary = "Lägger till ett förråd (t.ex. ett PPA) för apt",
        SummaryEn = "Adds a repository (e.g. a PPA) for apt",
        Man = """
NAMN
       add-apt-repository - lägg till eller ta bort förråd för apt

SYNOPSIS
       add-apt-repository [-y] [-n] [-r] FÖRRÅD

BESKRIVNING
       Lägger till ett förråd, oftast ett PPA (Personal Package Archive)
       från Launchpad: ppa:användare/namn. En fil skapas i
       /etc/apt/sources.list.d/ och därefter körs "apt update" så att de
       nya paketen syns. Kommandot finns i paketet
       software-properties-common.

       PPA:er byggs för Ubuntu. I Debian kan de krocka med systemets egna
       bibliotek. Lägg bara till PPA:er från utvecklare du litar på – de
       kan ersätta vilket paket som helst på datorn.

FLAGGOR
       -y, --yes         fråga inte om bekräftelse
       -r, --remove      ta bort förrådet i stället
       -n, --no-update   kör inte "apt update" efteråt
       -L, --list        lista förråden som är tillagda

EXEMPEL
       sudo add-apt-repository ppa:lunatool/moonphase
       sudo add-apt-repository --remove ppa:lunatool/moonphase
""",
        ManEn = """
NAME
       add-apt-repository - add or remove apt repositories

SYNOPSIS
       add-apt-repository [-y] [-n] [-r] REPOSITORY

DESCRIPTION
       Adds a repository, usually a PPA (Personal Package Archive) from
       Launchpad: ppa:user/name. A file is created in
       /etc/apt/sources.list.d/ and "apt update" is then run so that the
       new packages show up. The command is in the package
       software-properties-common.

       PPAs are built for Ubuntu. On Debian they may clash with the
       system's own libraries. Only add PPAs from developers you trust -
       they can replace any package on the computer.

OPTIONS
       -y, --yes         don't ask for confirmation
       -r, --remove      remove the repository instead
       -n, --no-update   don't run "apt update" afterwards
       -L, --list        list the repositories that have been added

EXAMPLES
       sudo add-apt-repository ppa:lunatool/moonphase
       sudo add-apt-repository --remove ppa:lunatool/moonphase
""",
        Run = RunAddAptRepository,
    };

    private static int RunAddAptRepository(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        var o = UtilCmd.ParseOpts(ctx.Args, new OptSpec
        {
            Flags = "yrnhL",
            Long = new() { ["yes"] = "y", ["remove"] = "r", ["no-update"] = "n", ["help"] = "h", ["list"] = "L" },
        });
        if (o.Error is not null)
        {
            ctx.Err($"{AddAptUsage}\nadd-apt-repository: error: {o.Error}\n");
            return 2;
        }
        if (o.Flags.Contains("h"))
        {
            ctx.Out($"{AddAptUsage}\n\nOnly ONE operation can be performed per invocation.\n");
            return 0;
        }
        if (o.Flags.Contains("L"))
        {
            var node = sh.Vfs.TryLookup("/etc/apt/sources.list.d", sh.RootUser());
            foreach (var f in node?.Children?.Values ?? Enumerable.Empty<FsNode>())
            {
                var c = f.Content ?? "";
                var um = UrisRe.Match(c);
                var uri = um.Success ? um.Groups[1].Value : null;
                var sm = SuitesRe.Match(c);
                var suites = sm.Success ? Js.Split(sm.Groups[1].Value, WsRe) : new List<string>();
                var cm = ComponentsRe.Match(c);
                var comps = cm.Success ? cm.Groups[1].Value : "";
                foreach (var s in suites) if (!string.IsNullOrEmpty(uri)) ctx.Out($"deb {uri} {s} {comps}\n");
            }
            return 0;
        }
        var spec = string.Join(" ", o.Operands);
        if (spec == "")
        {
            ctx.Err("Error: need a repository as argument\n");
            return 1;
        }
        if (!IsRoot(sh))
        {
            ctx.Err("Error: must run as root\n");
            return 1;
        }
        if (ComponentRe.IsMatch(spec))
        {
            if (sh.Distro.Id == "ubuntu")
            {
                ctx.Out($"'{spec}' distribution component is already enabled for all sources.\n");
                return 0;
            }
            ctx.Out($"Adding component(s) '{spec}' to all repositories.\n");
            ctx.Out(Dim(sh, "repos.ubuntuOnlyComponent", ("component", spec)));
            return 0;
        }
        var ppa = ParsePpa(spec);
        if (ppa is null)
        {
            ctx.Err($"Error: '{spec}' invalid\n");
            ctx.Err(Dim(sh, "repos.ppaFormat"));
            return 1;
        }
        var info = Ppas.GetValueOrDefault(PpaKey(ppa));
        var path = PpaSourcesPath(ppa);
        var removing = o.Flags.Contains("r");
        if (info is null && !removing)
        {
            ctx.Err($"ERROR: ppa '{PpaKey(ppa)}' not found (use --login if private)\n");
            return 1;
        }
        if (removing && sh.Vfs.TryLookup(path, sh.RootUser()) is null)
        {
            ctx.Err($"Error: repository '{spec}' is not present\n");
            return 1;
        }
        ctx.Out($"Repository: 'Types: deb\nURIs: {PpaUri(ppa)}\nSuites: {PpaSuite}\nComponents: main\n'\n");
        if (info is not null) ctx.Out($"Description:\n{info.Description}\nMore info: https://launchpad.net/~{ppa.User}/+archive/ubuntu/{ppa.Name}\n");
        ctx.Out(removing ? "Removing repository.\n" : "Adding repository.\n");
        if (!removing && sh.Distro.Id != "ubuntu")
        {
            ctx.Out(Dim(sh, "repos.ppaWarning", ("suite", PpaSuite), ("distro", sh.Distro.Name)));
        }
        int Apply(Sink io)
        {
            if (removing) sh.Vfs.Remove(path, sh.RootUser());
            else WriteRootFile(sh, path, PpaSources(ppa));
            if (o.Flags.Contains("n")) return 0;
            return sh.Invoke(new List<string> { "apt", "update" }, AsIO(io));
        }
        return AskYesNo(ctx, "Press [ENTER] to continue or Ctrl-c to cancel.", true, o.Flags.Contains("y"), Apply, io =>
        {
            io.Out("Aborted.\n");
            return 1;
        });
    }

    // ================================================================ COPR

    private sealed class CoprInfo
    {
        public required string Description { get; init; }
        public required List<string> Packages { get; init; }
    }

    private static readonly Dictionary<string, CoprInfo> Coprs = new()
    {
        ["lunatool/moonphase"] = new CoprInfo { Description = "moonphase – the phase of the moon in your terminal", Packages = new() { "moonphase" } },
    };

    private static string CoprName(Copr c) => $"{c.Owner}/{c.Project}";
    private static string CoprFull(Copr c) => $"copr.fedorainfracloud.org/{CoprName(c)}";

    private static string CoprRepoFile(Copr c)
    {
        var dl = $"https://download.copr.fedorainfracloud.org/results/{CoprName(c)}";
        return
            $"[{CoprId(c)}]\nname=Copr repo for {c.Project} owned by {c.Owner}\nbaseurl={dl}/fedora-$releasever-$basearch/\n" +
            $"type=rpm-md\nskip_if_unavailable=True\ngpgcheck=1\ngpgkey={dl}/pubkey.gpg\nrepo_gpgcheck=0\nenabled=1\nenabled_metadata=1\n";
    }

    private static readonly Regex CoprFileRe = new(@"^_copr:copr\.fedorainfracloud\.org:([^:]+):(.+)\.repo\z", RegexOptions.CultureInvariant);
    private static readonly Regex GroupPrefix = new("^group_", RegexOptions.CultureInvariant);

    /// <summary>All COPR repositories that exist as .repo files in /etc/yum.repos.d.</summary>
    private static List<Copr> ConfiguredCoprs(Shell sh)
    {
        var dir = sh.Vfs.TryLookup("/etc/yum.repos.d", sh.RootUser());
        var result = new List<Copr>();
        foreach (var name in (dir?.Children?.Keys ?? Enumerable.Empty<string>()).ToList().SortJs())
        {
            var m = CoprFileRe.Match(name);
            if (m.Success) result.Add(new Copr { Owner = GroupPrefix.Replace(m.Groups[1].Value, "@", 1), Project = m.Groups[2].Value });
        }
        return result;
    }

    /// <summary>The repository's name in dnf (e.g. in the "Repository" column).</summary>
    public static string DnfRepoId(PackageDef p)
    {
        var rh = p.ExtraRepo?.Get("redhat");
        var copr = !string.IsNullOrEmpty(rh) ? ParseCopr(rh) : null;
        return copr is not null ? CoprId(copr) : "fedora";
    }

    /// <summary>Lines for `dnf repolist`: enabled COPR repositories.</summary>
    public static string DnfCoprRepolist(Shell sh) =>
        string.Concat(ConfiguredCoprs(sh)
            .Where(c => CoprEnabled(sh, c))
            .Select(c => $"{CoprId(c).PadRight(32)} Copr repo for {c.Project} owned by {c.Owner}\n"));

    private static readonly Regex EnabledLine = new(@"^enabled\s*=.*$", RegexOptions.Multiline | RegexOptions.CultureInvariant);

    /// <summary>`dnf copr enable|disable|remove|list`.</summary>
    public static int DnfCopr(CmdCtx ctx, List<string> args)
    {
        var sh = ctx.Sh;
        var assumeYes = args.Contains("-y") || args.Contains("--assumeyes") || ctx.Args.Contains("-y") || ctx.Args.Contains("--assumeyes");
        var positional = args.Where(a => !a.StartsWith('-')).ToList();
        var action = positional.Count > 0 ? positional[0] : null;
        var spec = positional.Count > 1 ? positional[1] : null;
        int RootError()
        {
            ctx.Err("This command has to be run with superuser privileges (under the root user on most systems).\n");
            return 1;
        }
        void Usage() =>
            ctx.Out(
                "Usage:\n  dnf5 [GLOBAL OPTIONS] copr <COMMAND> ...\n\nCommands:\n  list     list Copr repositories\n  enable   download the repository info from a Copr server and install it\n" +
                "  disable  disable specified Copr repository (if exists), keep the repo file\n  remove   remove specified Copr repository from the system\n");
        if (string.IsNullOrEmpty(action) || action == "--help" || action == "help")
        {
            Usage();
            return !string.IsNullOrEmpty(action) ? 0 : 2;
        }
        if (action == "list")
        {
            foreach (var c in ConfiguredCoprs(sh)) ctx.Out($"{CoprFull(c)}{(CoprEnabled(sh, c) ? "" : " (disabled)")}\n");
            return 0;
        }
        if (!new[] { "enable", "disable", "remove" }.Contains(action))
        {
            ctx.Err($"Unknown argument \"{action}\" for command \"copr\". Add \"--help\" for more information about the arguments.\n");
            return 2;
        }
        var copr = !string.IsNullOrEmpty(spec) ? ParseCopr(spec) : null;
        if (copr is null)
        {
            ctx.Err(!string.IsNullOrEmpty(spec) ? $"Can't parse Copr repo spec: '{spec}'\n" : $"Missing positional argument \"PROJECT_SPEC\" for command \"{action}\".\n");
            return 2;
        }
        if (!IsRoot(sh)) return RootError();
        var path = CoprRepoPath(copr);
        var exists = sh.Vfs.TryLookup(path, sh.RootUser()) is not null;
        if (action == "enable")
        {
            if (!Coprs.ContainsKey(CoprName(copr)))
            {
                ctx.Err($"Failed to download Copr project info from https://copr.fedorainfracloud.org/api_3/project/?ownername={copr.Owner}&projectname={copr.Project}: 404 Not Found\n");
                return 1;
            }
            ctx.Out(
                "Enabling a Copr repository. Please note that this repository is not part\nof the main distribution, and quality may vary.\n\n" +
                "The Fedora Project does not exercise any power over the contents of\nthis repository beyond the rules outlined in the Copr FAQ at\n" +
                "<https://docs.pagure.org/copr.copr/user_documentation.html#what-i-can-build-in-copr>,\nand packages are not held to any quality or security level.\n\n" +
                "Please do not file bug reports about these packages in Fedora\nBugzilla. In case of problems, contact the owner of this repository.\n\n");
            return AskYesNo(
                ctx,
                $"Do you really want to enable {CoprFull(copr)}? [y/N]: ",
                false,
                assumeYes,
                io =>
                {
                    WriteRootFile(sh, path, CoprRepoFile(copr));
                    io.Out($"Copr repository '{CoprFull(copr)}' enabled in '{path}'.\n");
                    return 0;
                },
                io =>
                {
                    io.Out("Operation aborted by the user.\n");
                    return 1;
                });
        }
        if (!exists)
        {
            ctx.Err($"Repository '{CoprFull(copr)}' not found on this system\n");
            return 1;
        }
        if (action == "disable")
        {
            var node = sh.Vfs.Lookup(path, sh.RootUser());
            node.Content = EnabledLine.Replace(node.Content ?? "", "enabled=0", 1);
            ctx.Out($"Copr repository '{CoprFull(copr)}' in '{path}' disabled.\n");
            return 0;
        }
        sh.Vfs.Remove(path, sh.RootUser());
        ctx.Out($"Repository '{CoprFull(copr)}' removed.\n");
        return 0;
    }

    // ================================================================ AUR

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

    private static readonly Regex PkgnameVar = new(@"\$\{?pkgname\}?", RegexOptions.CultureInvariant);
    private static readonly Regex PkgverVar = new(@"\$\{?pkgver\}?", RegexOptions.CultureInvariant);

    /// <summary>The file names of the source files with $pkgname and $pkgver filled in.</summary>
    private static List<string> SourceFiles(string name, AurEntry e) =>
        e.Sources.Select(s =>
        {
            var filled = PkgverVar.Replace(PkgnameVar.Replace(s, _ => name), _ => e.Pkgver);
            return filled.Contains("::") ? filled.Split("::")[0] : filled.Slice(filled.LastIndexOf('/') + 1);
        }).ToList();

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

    // ---------------------------------------------------------------- yay

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

    // ================================================================ The programs

    private const double Synodic = 29.530588853;
    private static readonly long NewMoon2000 = new DateTimeOffset(2000, 1, 6, 18, 14, 0, TimeSpan.Zero).ToUnixTimeMilliseconds();

    /// <summary>The moon's age in days since the last new moon.</summary>
    public static double MoonAge(double ms)
    {
        var age = ((ms - NewMoon2000) / 86_400_000) % Synodic;
        return age < 0 ? age + Synodic : age;
    }

    private static readonly string[] Phases = { "New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent" };

    private static string MoonArt(double age)
    {
        var angle = (2 * Math.PI * age) / Synodic;
        var waxing = age < Synodic / 2;
        const int R = 5;
        var rows = new List<string>();
        for (int yi = 0; yi < 2 * R; yi++)
        {
            var y = yi - R + 0.5;
            var w = Math.Sqrt(R * R - y * y);
            var row = new StringBuilder();
            for (int xi = -2 * R; xi <= 2 * R; xi++)
            {
                var x = xi / 2.0;
                if (Math.Abs(x) > w + 0.25)
                {
                    row.Append(' ');
                    continue;
                }
                var t = w * Math.Cos(angle);
                var lit = waxing ? x > t : x < -t;
                row.Append(lit ? '@' : '.');
            }
            rows.Add(row.ToString().TrimEnd());
        }
        return string.Join("\n", rows) + "\n";
    }

    private static readonly CommandDef Moonphase = new()
    {
        Name = "moonphase",
        Summary = "Visar månens fas (påhittat program från PPA, AUR och COPR)",
        SummaryEn = "Shows the phase of the moon (made-up program from a PPA, the AUR and COPR)",
        Man = """
NAMN
       moonphase - visa månens fas i terminalen

SYNOPSIS
       moonphase [--version]

BESKRIVNING
       Ritar månen som den ser ut i dag och berättar hur stor del som är
       upplyst. Ett påhittat program som finns i de extra förråden
       ppa:lunatool/moonphase, AUR och COPR-projektet lunatool/moonphase.
""",
        ManEn = """
NAME
       moonphase - show the phase of the moon in the terminal

SYNOPSIS
       moonphase [--version]

DESCRIPTION
       Draws the moon as it looks today and tells you how much of it is
       lit. A made-up program that lives in the extra repositories
       ppa:lunatool/moonphase, the AUR and the COPR project
       lunatool/moonphase.
""",
        Run = ctx =>
        {
            if (ctx.Args.Count > 0 && (ctx.Args[0] == "--version" || ctx.Args[0] == "-V"))
            {
                ctx.Out($"moonphase {(ctx.Sh.Installed.Get("moonphase") ?? "1.4.2").Split('-')[0]}\n");
                return 0;
            }
            if (ctx.Args.Count != 0)
            {
                ctx.Err($"moonphase: unknown option '{ctx.Args[0]}'\nUsage: moonphase [--version]\n");
                return 2;
            }
            var now = Js.Now();
            var age = MoonAge(now);
            var illum = Math.Floor(((1 - Math.Cos((2 * Math.PI * age) / Synodic)) / 2) * 100 + 0.5);
            var name = Phases[(int)Math.Floor(((age + Synodic / 16) % Synodic) / (Synodic / 8))];
            var toFull = (Synodic / 2 - age + Synodic) % Synodic;
            var full = DateTimeOffset.FromUnixTimeMilliseconds((long)Math.Truncate(now + toFull * 86_400_000)).UtcDateTime.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            ctx.Out($"{MoonArt(age)}\n{name}, {Js.Num(illum)}% illuminated (day {Js.ToFixed(age, 1)} of {Js.ToFixed(Synodic, 1)})\nNext full moon: {full}\n");
            return 0;
        },
    };

    private static readonly CommandDef Snowfall = new()
    {
        Name = "snowfall",
        Summary = "Låter det snöa i terminalen (påhittat AUR-paket)",
        SummaryEn = "Lets it snow in the terminal (made-up AUR package)",
        Man = """
NAMN
       snowfall - låt det snöa i terminalen

BESKRIVNING
       Ett påhittat program från AUR. Tryck q för att avsluta.
""",
        ManEn = """
NAME
       snowfall - let it snow in the terminal

DESCRIPTION
       A made-up program from the AUR. Press q to quit.
""",
        Run = ctx =>
        {
            ctx.Out(
                "   *        .     *       .    *\n .     *       .      *         .\n     .    *        .      *  .\n" +
                "  *      .     *      .     *    \n    .  *     .     *     .    *\n__/\\___/\\__/\\____/\\___/\\___/\\___\n");
            ctx.Out(Dim(ctx.Sh, "repos.snowQuit"));
            return 0;
        },
    };

    private static readonly CommandDef Go = new()
    {
        Name = "go",
        Summary = "Kompilatorn för programspråket Go",
        SummaryEn = "The compiler for the Go programming language",
        Man = """
NAMN
       go - verktyg för programspråket Go

BESKRIVNING
       I simulatorn stöds bara "go version".
""",
        ManEn = """
NAME
       go - tool for the Go programming language

DESCRIPTION
       Only "go version" is supported in the simulator.
""",
        Run = ctx =>
        {
            if (ctx.Args.Count > 0 && ctx.Args[0] == "version")
            {
                ctx.Out("go version go1.25.3 linux/amd64\n");
                return 0;
            }
            if (ctx.Args.Count == 0)
            {
                ctx.Out("Go is a tool for managing Go source code.\n\nUsage:\n\n\tgo <command> [arguments]\n");
                return 2;
            }
            ctx.Out(Dim(ctx.Sh, "repos.goSubcommandUnsupported", ("subcommand", ctx.Args[0])));
            return 1;
        },
    };

    public static List<CommandDef> All { get; } = new() { AddAptRepository, Makepkg, Yay, Moonphase, Snowfall, Go };
}
