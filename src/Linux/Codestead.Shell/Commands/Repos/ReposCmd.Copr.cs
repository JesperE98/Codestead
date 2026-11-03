namespace Codestead.Shell.Commands;

// COPR (Fedora): the known COPR projects and dnf copr enable/disable/list.

using static ExtrarepoLib;

public static partial class ReposCmd
{
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
}
