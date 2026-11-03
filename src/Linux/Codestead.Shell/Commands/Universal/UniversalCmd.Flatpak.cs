namespace Codestead.Shell.Commands;

// The flatpak command: installs and runs sandboxed applications (Flatpak/Flathub).

public static partial class UniversalCmd
{
    private const string FlatpakManSv = $"""
NAMN
       flatpak - installera och kör program i en sandlåda

SYNOPSIS
       flatpak KOMMANDO [FLAGGOR] [ARGUMENT]

BESKRIVNING
       Flatpak är ett paketformat för skrivbordsprogram som fungerar i alla
       distributioner. Programmen kommer från en "remote" – oftast Flathub –
       och körs i en sandlåda med bara de behörigheter de bett om. Gemensamma
       bibliotek finns i delade "runtimes" (t.ex. org.gnome.Platform).

       Program kan installeras för hela systemet (standard) eller bara för
       dig med --user. Användarinstallationen har egna remotes.

KOMMANDON
       remote-add NAMN URL    lägg till en källa (remote)
       remotes                lista källorna
       search ORD             sök efter program
       install REMOTE ID      installera ett program
       list                   lista installerade program och runtimes
       run ID                 starta ett program
       info ID                visa information om ett installerat program
       update                 uppdatera allt
       uninstall ID           ta bort ett program
       uninstall --unused     ta bort runtimes som inget program använder

FLAGGOR
       --user            använd din egen installation i ~/.local/share/flatpak
       --system          använd systemets installation (standard)
       --if-not-exists   inget fel om källan redan finns (remote-add)
       -y, --assumeyes   svara ja på frågor
       --app, --runtime  visa bara program eller runtimes (list)

EXEMPEL
       flatpak remote-add --if-not-exists flathub {FlathubUrl}
       flatpak install flathub org.gimp.GIMP
       flatpak run org.gimp.GIMP
""";

    private const string FlatpakManEn = $"""
NAME
       flatpak - install and run applications in a sandbox

SYNOPSIS
       flatpak COMMAND [OPTIONS] [ARGUMENTS]

DESCRIPTION
       Flatpak is a package format for desktop applications that works on
       every distribution. Applications come from a "remote" - usually
       Flathub - and run in a sandbox with only the permissions they asked
       for. Common libraries live in shared "runtimes" (e.g.
       org.gnome.Platform).

       Applications can be installed for the whole system (the default) or
       just for you with --user. The user installation has its own remotes.

COMMANDS
       remote-add NAME URL    add a source (remote)
       remotes                list the remotes
       search WORD            search for applications
       install REMOTE ID      install an application
       list                   list installed applications and runtimes
       run ID                 start an application
       info ID                show information about an installed app
       update                 update everything
       uninstall ID           remove an application
       uninstall --unused     remove runtimes no application uses

OPTIONS
       --user            use your own installation in ~/.local/share/flatpak
       --system          use the system installation (the default)
       --if-not-exists   no error if the remote already exists (remote-add)
       -y, --assumeyes   answer yes to questions
       --app, --runtime  only show applications or runtimes (list)

EXAMPLES
       flatpak remote-add --if-not-exists flathub {FlathubUrl}
       flatpak install flathub org.gimp.GIMP
       flatpak run org.gimp.GIMP
""";

    private static readonly CommandDef Flatpak = new()
    {
        Name = "flatpak",
        Summary = "Installerar och kör program i sandlåda (Flatpak/Flathub)",
        SummaryEn = "Installs and runs sandboxed applications (Flatpak/Flathub)",
        Man = FlatpakManSv,
        ManEn = FlatpakManEn,
        Run = RunFlatpak,
    };

    private static readonly Regex UnrecognizedRe = new("^unrecognized option", RegexOptions.CultureInvariant);
    private static readonly Regex EpochRe = new(@"^[0-9]+:", RegexOptions.CultureInvariant);
    private static readonly Regex FlathubRepoFile = new(@"flathub\.org/repo/flathub\.flatpakrepo\z", RegexOptions.CultureInvariant);
    private static readonly Regex FlathubRepoDir = new(@"dl\.flathub\.org/repo/?\z", RegexOptions.CultureInvariant);
    private static readonly Regex AppPrefix = new("^app/", RegexOptions.CultureInvariant);

    private static int RunFlatpak(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        FlatpakSeed(sh);
        var cmd = ctx.Args.Count > 0 ? ctx.Args[0] : null;
        var rest = ctx.Args.Skip(1).ToList();
        if (string.IsNullOrEmpty(cmd) || cmd == "--help" || cmd == "-h")
        {
            ctx.Out("Usage:\n  flatpak [OPTION…] COMMAND\n\nBuiltin Commands:\n Manage installed applications and runtimes\n  install        Install an application or runtime\n  update         Update an installed application or runtime\n  uninstall      Uninstall an installed application or runtime\n  list           List installed apps and/or runtimes\n  info           Show info for installed app or runtime\n  run            Run an application\n  search         Search for remote apps/runtimes\n  remotes        List all configured remotes\n  remote-add     Add a new remote repository (by URL)\n  remote-delete  Delete a configured remote\n");
            return !string.IsNullOrEmpty(cmd) ? 0 : 1;
        }
        if (cmd == "--version")
        {
            ctx.Out($"Flatpak {EpochRe.Replace(sh.Installed.Get("flatpak") ?? "1.16.1", "", 1).Split('-')[0]}\n");
            return 0;
        }
        var o = UtilCmd.ParseOpts(rest, new OptSpec
        {
            Flags = "y",
            Long = new()
            {
                ["user"] = "U", ["system"] = "S", ["if-not-exists"] = "E", ["assumeyes"] = "y", ["noninteractive"] = "y", ["app"] = "a",
                ["runtime"] = "r", ["unused"] = "u", ["show-permissions"] = "P", ["columns"] = "c", ["from"] = "F",
            },
            Values = "c",
        });
        if (o.Error is not null)
        {
            ctx.Err($"error: {UnrecognizedRe.Replace(o.Error, "Unknown option", 1)}\n");
            return 1;
        }
        var inst = o.Flags.Contains("U") ? "user" : "system";
        var where = inst == "system" ? "system" : "user";
        var args = o.Operands;

        void NeedRoot()
        {
            // On a desktop polkit asks for the password in a window; here we pretend you answered.
            if (inst == "system" && !IsRoot(sh) && !Flag(sh, "flatpak:polkitNote"))
            {
                sh.Flags["flatpak:polkitNote"] = true;
                ctx.Out(Dim(sh, "universal.flatpakPolkit"));
            }
        }

        switch (cmd)
        {
            case "remote-add":
            {
                var name = args.Count > 0 ? args[0] : null;
                var url = args.Count > 1 ? args[1] : null;
                if (string.IsNullOrEmpty(name) || string.IsNullOrEmpty(url))
                {
                    ctx.Err("error: NAME and LOCATION must be specified\n");
                    return 1;
                }
                if (Remotes(sh, inst).Contains(name))
                {
                    if (o.Flags.Contains("E")) return 0;
                    ctx.Err($"error: Remote {name} already exists\n");
                    return 1;
                }
                if (!FlathubRepoFile.IsMatch(url) && !FlathubRepoDir.IsMatch(url))
                {
                    ctx.Err($"error: Can't load uri {url}: Could not resolve hostname\n");
                    ctx.Err(Dim(sh, "universal.flathubOnly", ("url", FlathubUrl)));
                    return 1;
                }
                NeedRoot();
                var path = ConfigPath(sh, inst);
                MkdirsAs(sh, path.Slice(0, path.LastIndexOf('/')), inst);
                var user = inst == "system" ? sh.RootUser() : sh.CurrentUser();
                var old = TryNode(sh, path)?.Content ?? "[core]\nrepo_version=1\nmode=bare-user-only\n";
                sh.Vfs.WriteFile(path, $"{old}\n[remote \"{name}\"]\nurl=https://dl.flathub.org/repo/\ngpg-verify=true\ngpg-verify-summary=true\nxa.title=Flathub\nxa.homepage=https://flathub.org/\n", user);
                return 0;
            }
            case "remote-delete":
            {
                var name = args.Count > 0 ? args[0] : null;
                if (string.IsNullOrEmpty(name) || !Remotes(sh, inst).Contains(name))
                {
                    ctx.Err($"error: Remote \"{name ?? ""}\" not found\n");
                    return 1;
                }
                NeedRoot();
                var user = inst == "system" ? sh.RootUser() : sh.CurrentUser();
                var path = ConfigPath(sh, inst);
                var re = new Regex($@"\n?\[remote ""{name.Replace(".", "\\.")}""\][^\[]*", RegexOptions.CultureInvariant);
                var content = re.Replace(sh.Vfs.ReadFile(path, sh.RootUser()), "\n", 1);
                sh.Vfs.WriteFile(path, content, user);
                return 0;
            }
            case "remotes":
            case "remote-list":
            {
                var both = o.Flags.Contains("U") || o.Flags.Contains("S") ? new[] { inst } : new[] { "system", "user" };
                if (ctx.IsTTY) ctx.Out("Name    Options\n");
                foreach (var i in both) foreach (var r in Remotes(sh, i)) ctx.Out($"{r.PadRight(8)}{i}{(r == "fedora" ? ",oci" : "")}\n");
                return 0;
            }
            case "search":
            {
                var q = string.Join(" ", args).ToLowerInvariant();
                if (q == "")
                {
                    ctx.Err("error: TEXT must be specified\n");
                    return 1;
                }
                var rs = Remotes(sh, "system").Concat(Remotes(sh, "user")).Distinct().ToList();
                var hits = Flathub.Where(a => (a.Id + " " + a.Name + " " + a.Summary).ToLowerInvariant().Contains(q))
                    .Select(a => (A: a, In: rs.Where(r => RemoteApps(r).Contains(a)).ToList()))
                    .Where(h => h.In.Count != 0)
                    .ToList();
                if (hits.Count == 0)
                {
                    ctx.Out("No matches found\n");
                    if (rs.Count == 0) ctx.Out(Dim(sh, "universal.noRemotes"));
                    return 0;
                }
                if (ctx.IsTTY) ctx.Out("Name                              Description                                          Application ID                 Version    Branch  Remotes\n");
                foreach (var h in hits)
                {
                    ctx.Out($"{h.A.Name.PadRight(33)} {h.A.Summary.PadRight(52)} {h.A.Id.PadRight(30)} {h.A.Version.PadRight(10)} {h.A.Branch.PadRight(7)} {string.Join(",", h.In)}\n");
                }
                return 0;
            }
            case "install":
            {
                if (args.Count == 0)
                {
                    ctx.Err("error: At least one REF must be specified\n");
                    return 1;
                }
                var rs = Remotes(sh, inst);
                string? remote = null;
                var refs = args;
                if (args.Count > 1 && (rs.Contains(args[0]) || new[] { "flathub", "fedora", "flathub-beta" }.Contains(args[0])))
                {
                    remote = args[0];
                    refs = args.Skip(1).ToList();
                }
                ctx.Out("Looking for matches…\n");
                if (remote is not null && !rs.Contains(remote))
                {
                    ctx.Err($"error: No remote refs found for ‘{remote}’\n");
                    if (inst == "user" && Remotes(sh, "system").Contains(remote))
                    {
                        ctx.Err(Dim(sh, "universal.remoteSystemOnly", ("remote", remote)));
                    }
                    else
                    {
                        ctx.Err(Dim(sh, "universal.addRemoteFirst", ("url", FlathubUrl)));
                    }
                    return 1;
                }
                var plan = new List<(FlatpakApp App, string Remote)>();
                foreach (var r in refs)
                {
                    var searchIn = remote is not null ? new List<string> { remote } : rs;
                    var query = AppPrefix.Replace(r, "", 1).Split('/')[0];
                    var found = searchIn.Select(rem => (Rem: rem, App: MatchApp(query, RemoteApps(rem)))).FirstOrDefault(x => x.App is not null);
                    if (found.App is null)
                    {
                        ctx.Err($"error: Nothing matches {r} in {(remote is not null ? $"remote {remote}" : $"{where} installation")}\n");
                        return 1;
                    }
                    if (remote is null) ctx.Out($"Found ref ‘app/{found.App.Id}/x86_64/{found.App.Branch}’ in remote ‘{found.Rem}’ ({where}).\n");
                    if (InstalledRefs(sh).Any(i => i.Inst == inst && i.Id == found.App.Id))
                    {
                        ctx.Out($"Skipping: {found.App.Id}/x86_64/{found.App.Branch} is already installed\n");
                        continue;
                    }
                    plan.Add((found.App, found.Rem));
                }
                if (plan.Count == 0) return 0;
                NeedRoot();
                var have = InstalledRefs(sh).Where(i => i.Inst == inst && i.Kind == "runtime").Select(i => $"{i.Id}//{i.Branch}").ToList();
                var runtimes = plan.Select(p => p.App.Runtime).Distinct().Where(r => !have.Contains(r)).ToList();
                var rows = new List<string>();
                foreach (var rt in runtimes)
                {
                    var r = Runtimes[rt];
                    rows.Add($"{r.Id}.Locale".PadRight(43) + $" {r.Branch.PadRight(9)} i    {plan[0].Remote.PadRight(9)} < 18.5 kB");
                    rows.Add($"{r.Id}".PadRight(43) + $" {r.Branch.PadRight(9)} i    {plan[0].Remote.PadRight(9)} < {r.SizeMb} MB");
                }
                foreach (var p in plan) rows.Add($"{p.App.Id}".PadRight(43) + $" {p.App.Branch.PadRight(9)} i    {p.Remote.PadRight(9)} < {p.App.SizeMb} MB");
                foreach (var p in plan)
                {
                    ctx.Out($"\n{p.App.Id} permissions:\n    {string.Join("    ", p.App.Permissions)}\n");
                }
                ctx.Out($"\n        {"ID".PadRight(43)} {"Branch".PadRight(9)} Op   {"Remote".PadRight(9)} Download\n");
                for (int i = 0; i < rows.Count; i++) ctx.Out($" {(i + 1).ToString(CultureInfo.InvariantCulture).PadLeft(2)}. [ ] {rows[i]}\n");
                ctx.Out("\n");
                return ReposCmd.AskYesNo(
                    ctx,
                    $"Proceed with these changes to the {where} installation? [Y/n]: ",
                    true,
                    o.Flags.Contains("y"),
                    io =>
                    {
                        foreach (var rt in runtimes)
                        {
                            var r = Runtimes[rt];
                            WriteRef(sh, inst, "runtime", r.Id, r.Branch, $"[Runtime]\nname={r.Id}\nbranch={r.Branch}\ntitle={r.Name}\n", r.SizeMb);
                        }
                        foreach (var p in plan)
                        {
                            var runtime = ReplaceFirst(p.App.Runtime, "//", "/x86_64/");
                            var shared = string.Join(";", p.App.Permissions.Where(x => !x.Contains(':')));
                            WriteRef(sh, inst, "app", p.App.Id, p.App.Branch, $"[Application]\nname={p.App.Id}\ntitle={p.App.Name}\nversion={p.App.Version}\nruntime={runtime}\norigin={p.Remote}\n\n[Context]\nshared={shared};\n", p.App.SizeMb);
                        }
                        for (int i = 0; i < rows.Count; i++) io.Out($" {(i + 1).ToString(CultureInfo.InvariantCulture).PadLeft(2)}. [✓] {rows[i]}\n");
                        io.Out("\nInstallation complete.\n");
                        return 0;
                    },
                    io =>
                    {
                        io.Out("error: Aborted by user\n");
                        return 1;
                    });
            }
            case "list":
            {
                var list = InstalledRefs(sh);
                if (o.Flags.Contains("U")) list = list.Where(i => i.Inst == "user").ToList();
                if (o.Flags.Contains("S")) list = list.Where(i => i.Inst == "system").ToList();
                if (o.Flags.Contains("a")) list = list.Where(i => i.Kind == "app").ToList();
                if (o.Flags.Contains("r")) list = list.Where(i => i.Kind == "runtime").ToList();
                if (ctx.IsTTY && list.Count != 0) ctx.Out($"{"Name".PadRight(40)} {"Application ID".PadRight(30)} {"Version".PadRight(10)} {"Branch".PadRight(7)} Installation\n");
                foreach (var i in list)
                {
                    var title = MetaValue(i.Meta, "title");
                    if (title == "") title = i.Id;
                    var version = MetaValue(i.Meta, "version");
                    ctx.Out(ctx.IsTTY ? $"{title.PadRight(40)} {i.Id.PadRight(30)} {version.PadRight(10)} {i.Branch.PadRight(7)} {i.Inst}\n" : $"{title}\t{i.Id}\t{version}\t{i.Branch}\t{i.Inst}\n");
                }
                return 0;
            }
            case "info":
            {
                var id = args.Count > 0 ? args[0] : null;
                var i = InstalledRefs(sh).FirstOrDefault(x => x.Id == id || (id is not null && x.Id.ToLowerInvariant() == id.ToLowerInvariant()));
                if (string.IsNullOrEmpty(id) || i is null)
                {
                    ctx.Err($"error: {id ?? ""}/*unspecified*/*unspecified* not installed\n");
                    return 1;
                }
                if (o.Flags.Contains("P"))
                {
                    var parts = i.Meta.Split("[Context]");
                    var context = parts.Length > 1 ? parts[1].Trim() : "";
                    ctx.Out(context != "" ? $"[Context]\n{context}\n" : "");
                    return 0;
                }
                var title = MetaValue(i.Meta, "title");
                var version = MetaValue(i.Meta, "version");
                var origin = MetaValue(i.Meta, "origin");
                var runtime = MetaValue(i.Meta, "runtime");
                ctx.Out(
                    $"\n{(title != "" ? title : i.Id)}\n\n          ID: {i.Id}\n         Ref: {i.Ref}\n        Arch: x86_64\n      Branch: {i.Branch}\n" +
                    (version != "" ? $"     Version: {version}\n" : "") +
                    $"      Origin: {(origin != "" ? origin : "flathub")}\nInstallation: {i.Inst}\n" +
                    (i.Kind == "app" ? $"     Runtime: {runtime}\n     Sdk: {ReplaceFirst(runtime, "Platform", "Sdk")}\n" : "") +
                    "\n");
                return 0;
            }
            case "run":
            {
                var id = args.Count > 0 ? args[0] : null;
                if (string.IsNullOrEmpty(id))
                {
                    ctx.Err("error: APP must be specified\n");
                    return 1;
                }
                var i = InstalledRefs(sh).FirstOrDefault(x => x.Kind == "app" && x.Id == id);
                if (i is null)
                {
                    ctx.Err($"error: app/{id}/x86_64/master not installed\n");
                    return 1;
                }
                var title = MetaValue(i.Meta, "title");
                ctx.Out(WindowNote(sh, title != "" ? title : id));
                return 0;
            }
            case "update":
            case "upgrade":
            {
                ctx.Out("Looking for updates…\n");
                // Everything in the simulator is already the latest version.
                ctx.Out("Nothing to do.\n");
                return 0;
            }
            case "uninstall":
            case "remove":
            {
                var installed = InstalledRefs(sh).Where(i => i.Inst == inst).ToList();
                List<InstalledRef> targets;
                if (o.Flags.Contains("u"))
                {
                    var used = installed.Where(i => i.Kind == "app").Select(i => MetaValue(i.Meta, "runtime").Split("/x86_64/")).ToList();
                    targets = installed.Where(i => i.Kind == "runtime" && !used.Any(u => u[0] == i.Id && u.Length > 1 && u[1] == i.Branch)).ToList();
                    if (targets.Count == 0)
                    {
                        ctx.Out("Nothing unused to uninstall\n");
                        return 0;
                    }
                }
                else
                {
                    if (args.Count == 0)
                    {
                        ctx.Err("error: Must specify at least one REF, --unused, --all or --delete-data\n");
                        return 1;
                    }
                    targets = new List<InstalledRef>();
                    foreach (var a in args)
                    {
                        var i = installed.FirstOrDefault(x => x.Id == a);
                        if (i is null)
                        {
                            ctx.Err($"error: {a}/*unspecified*/*unspecified* not installed\n");
                            return 1;
                        }
                        targets.Add(i);
                    }
                }
                NeedRoot();
                ctx.Out($"\n        {"ID".PadRight(43)} {"Branch".PadRight(9)} Op\n");
                for (int i = 0; i < targets.Count; i++) ctx.Out($" {(i + 1).ToString(CultureInfo.InvariantCulture).PadLeft(2)}. [-] {targets[i].Id.PadRight(43)} {targets[i].Branch.PadRight(9)} r\n");
                ctx.Out("\n");
                return ReposCmd.AskYesNo(
                    ctx,
                    $"Proceed with these changes to the {where} installation? [Y/n]: ",
                    true,
                    o.Flags.Contains("y"),
                    io =>
                    {
                        var user = inst == "system" ? sh.RootUser() : sh.CurrentUser();
                        foreach (var t in targets)
                        {
                            var dir = $"{InstBase(sh, inst)}/{t.Kind}/{t.Id}";
                            sh.Vfs.Remove(dir, user);
                        }
                        io.Out("Uninstall complete.\n");
                        if (!o.Flags.Contains("u") && targets.Any(t => t.Kind == "app"))
                        {
                            io.Out(Dim(sh, "universal.unusedRuntimes"));
                        }
                        return 0;
                    },
                    io =>
                    {
                        io.Out("error: Aborted by user\n");
                        return 1;
                    });
            }
        }
        ctx.Err($"error: Unknown command '{cmd}'\n\nSee 'flatpak --help'\n");
        return 1;
    }

    private static string ReplaceFirst(string s, string find, string replacement)
    {
        int i = s.IndexOf(find, StringComparison.Ordinal);
        return i < 0 ? s : s[..i] + replacement + s[(i + find.Length)..];
    }
}
