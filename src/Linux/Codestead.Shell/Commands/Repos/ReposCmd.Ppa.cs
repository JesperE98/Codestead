namespace Codestead.Shell.Commands;

// PPA (Ubuntu): the known PPAs and the functions apt calls for them.

using static ExtrarepoLib;
using static PackagesLib;

public static partial class ReposCmd
{
    private sealed class PpaInfo
    {
        public required string Description { get; init; }
        public required string DisplayName { get; init; }
        /// <summary>Packages (ids in Packages/PackagesLib.Catalog.cs) in the PPA.</summary>
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
}
