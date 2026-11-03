namespace Codestead.Shell.Commands;

// The dnf and dnf5 commands.

using static PackagesLib;

public static partial class PkgCmd
{
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
                    $"Total size of inbound packages is {FormatMiB(size * 0.4)}. Need to download {FormatMiB(size * 0.4)}.\n" +
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
                            io.Out($"[{i + 1}/{list.Count}] {PkgName(ctx, p)}-0:{Ver(p)}.x86_64          100% |   1.8 MiB/s | {FormatMiB(p.SizeKb * 0.4)} |  00m00s\n");
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
}
