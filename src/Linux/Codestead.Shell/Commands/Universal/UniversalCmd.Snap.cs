namespace Codestead.Shell.Commands;

// The snap command: installs and manages snap packages (Canonical/Ubuntu).

public static partial class UniversalCmd
{
    private sealed class SnapDef
    {
        public required string Name { get; init; }
        public required string Version { get; init; }
        public int Rev { get; init; }
        public required string Publisher { get; init; }
        public required string Summary { get; init; }
        /// <summary>Graphical program (otherwise it runs in the terminal).</summary>
        public bool Gui { get; init; }
        public bool Classic { get; init; }
        public string? Base { get; init; }
        /// <summary>Commands in /snap/bin.</summary>
        public List<string>? Apps { get; init; }
        public string? Notes { get; init; }
        public int SizeMb { get; init; }
    }

    private static readonly List<SnapDef> Snaps = new()
    {
        new SnapDef { Name = "bare", Version = "1.0", Rev = 5, Publisher = "canonical✓", Summary = "Empty base snap, useful for testing and fully statically linked snaps", Gui = false, Notes = "base", SizeMb = 0, Apps = new() },
        new SnapDef { Name = "core22", Version = "20250923", Rev = 2133, Publisher = "canonical✓", Summary = "Runtime environment based on Ubuntu 22.04", Gui = false, Notes = "base", SizeMb = 77, Apps = new() },
        new SnapDef { Name = "core24", Version = "20250926", Rev = 1196, Publisher = "canonical✓", Summary = "Runtime environment based on Ubuntu 24.04", Gui = false, Notes = "base", SizeMb = 70, Apps = new() },
        new SnapDef { Name = "snapd", Version = "2.71", Rev = 25202, Publisher = "canonical✓", Summary = "Daemon and tooling that enable snap packages", Gui = false, Notes = "snapd", SizeMb = 50, Apps = new() },
        new SnapDef { Name = "gtk-common-themes", Version = "0.1-81-g442e511", Rev = 1535, Publisher = "canonical✓", Summary = "Common GTK themes for snaps", Gui = false, SizeMb = 92, Apps = new() },
        new SnapDef { Name = "gnome-42-2204", Version = "0+git.38ea591", Rev = 202, Publisher = "canonical✓", Summary = "Shared GNOME 42 Ubuntu stack", Gui = false, SizeMb = 516, Apps = new() },
        new SnapDef { Name = "firefox", Version = "144.0-2", Rev = 7084, Publisher = "mozilla✓", Summary = "Mozilla Firefox web browser", Gui = true, Base = "core22", SizeMb = 265 },
        new SnapDef { Name = "hello-world", Version = "6.4", Rev = 29, Publisher = "canonical✓", Summary = "The 'hello-world' of snaps", Gui = false, Base = "core22", SizeMb = 1, Apps = new() { "hello-world" } },
        new SnapDef { Name = "vlc", Version = "3.0.21", Rev = 3777, Publisher = "videolan✓", Summary = "The ultimate media player", Gui = true, Base = "core22", SizeMb = 340 },
        new SnapDef { Name = "gimp", Version = "3.0.6", Rev = 532, Publisher = "snapcrafters✪", Summary = "GNU Image Manipulation Program", Gui = true, Base = "core24", SizeMb = 380 },
        new SnapDef { Name = "code", Version = "1.105.1", Rev = 208, Publisher = "vscode✓", Summary = "Code editing. Redefined.", Gui = true, Classic = true, Base = "core22", SizeMb = 330 },
        new SnapDef { Name = "spotify", Version = "1.2.74.477", Rev = 88, Publisher = "spotify✓", Summary = "Music for everyone", Gui = true, Base = "core22", SizeMb = 190 },
        new SnapDef { Name = "calculator", Version = "2.3.1", Rev = 12, Publisher = "calclab", Summary = "A simple calculator (also available as an AppImage)", Gui = true, Base = "core24", SizeMb = 48 },
    };

    private static readonly string[] UbuntuSeed = { "bare", "core22", "core24", "firefox", "gnome-42-2204", "gtk-common-themes", "snapd" };

    private static SnapDef? GetSnapDef(string name) => Snaps.FirstOrDefault(s => s.Name == name);

    private sealed class InstalledSnap
    {
        public required SnapDef Def { get; init; }
        public double Rev { get; init; }
        public bool Classic { get; init; }
    }

    private static readonly Regex ClassicRe = new("confinement: classic", RegexOptions.CultureInvariant);

    /// <summary>Installed snaps: /snap/&lt;name&gt;/&lt;revision&gt;/meta/snap.yaml</summary>
    private static List<InstalledSnap> InstalledSnaps(Shell sh)
    {
        var result = new List<InstalledSnap>();
        foreach (var name in Children(sh, "/snap"))
        {
            if (name == "bin") continue;
            var def = GetSnapDef(name);
            var revs = Children(sh, $"/snap/{name}").Select(Js.Number).Where(n => !double.IsNaN(n)).ToList();
            if (def is null || revs.Count == 0) continue;
            var rev = revs.Max();
            var yaml = TryNode(sh, $"/snap/{name}/{Js.Num(rev)}/meta/snap.yaml")?.Content ?? "";
            result.Add(new InstalledSnap { Def = def, Rev = rev, Classic = ClassicRe.IsMatch(yaml) });
        }
        return result;
    }

    private static void PlaceSnap(Shell sh, SnapDef def, bool classic)
    {
        ExtrarepoLib.EnsureDir(sh, $"/snap/{def.Name}/{def.Rev}/meta");
        sh.Vfs.WriteFile(
            $"/snap/{def.Name}/{def.Rev}/meta/snap.yaml",
            $"name: {def.Name}\nversion: '{def.Version}'\nsummary: {def.Summary}\n{(def.Base is not null ? $"base: {def.Base}\n" : "")}confinement: {(classic ? "classic" : "strict")}\n",
            sh.RootUser());
        ExtrarepoLib.EnsureDir(sh, "/var/lib/snapd/snaps");
        var blob = VfsLib.MakeFile("hsqs (simulated squashfs image)\n", "root", Js.Oct(600));
        blob.Size = def.SizeMb * 1_000_000L;
        sh.Vfs.Insert($"/var/lib/snapd/snaps/{def.Name}_{def.Rev}.snap", blob, sh.RootUser());
        if (def.Notes == "base" || def.Notes == "snapd" || def.Apps?.Count == 0) return;
        ExtrarepoLib.EnsureDir(sh, "/snap/bin");
        // Just like for real, /snap/bin/<program> points to the snap command itself.
        foreach (var app in def.Apps ?? new List<string> { def.Name }) sh.Vfs.Insert($"/snap/bin/{app}", SimBinary("snap"), sh.RootUser());
    }

    /// <summary>Ubuntu ships with a few snaps (Firefox among them).</summary>
    private static void SnapSeed(Shell sh)
    {
        if (Flag(sh, "snap:seeded")) return;
        sh.Flags["snap:seeded"] = true;
        if (sh.Distro.Id != "ubuntu" || TryNode(sh, "/snap") is not null) return;
        foreach (var n in UbuntuSeed) PlaceSnap(sh, GetSnapDef(n)!, false);
    }

    private static int RunSnapApp(CmdCtx ctx, string name)
    {
        var sh = ctx.Sh;
        var inst = InstalledSnaps(sh).FirstOrDefault(s => s.Def.Name == name || (s.Def.Apps?.Contains(name) ?? false));
        if (inst is null)
        {
            ctx.Err($"error: cannot find current revision for snap {name}: readlink /snap/{name}/current: no such file or directory\n");
            return 1;
        }
        if (inst.Def.Name == "hello-world")
        {
            ctx.Out("Hello World!\n");
            return 0;
        }
        ctx.Out(WindowNote(sh, inst.Def.Name));
        return 0;
    }

    private const string SnapManSv = """
NAMN
       snap - installera och hantera snap-paket

SYNOPSIS
       snap KOMMANDO [FLAGGOR] [SNAP]...

BESKRIVNING
       Snap är Canonicals paketformat och standard i Ubuntu. Snaps kommer
       från Snap Store, körs i en sandlåda (confinement) och uppdateras
       automatiskt i bakgrunden. Tjänsten snapd sköter allt.

       Program som behöver komma åt hela systemet (t.ex. kodeditorer)
       publiceras med "classic confinement" och måste installeras med
       --classic – då körs de utan sandlåda.

KOMMANDON
       find ORD          sök i Snap Store
       info SNAP         visa information och kanaler
       install SNAP      installera (kräver root)
       list              lista installerade snaps
       run SNAP          kör ett program från en snap
       refresh           uppdatera alla snaps nu
       remove SNAP       ta bort en snap

FLAGGOR
       --classic         tillåt classic confinement (ingen sandlåda)
       --channel=KANAL   t.ex. latest/beta eller latest/edge

EXEMPEL
       sudo snap install hello-world
       snap run hello-world
       sudo snap install code --classic
""";

    private const string SnapManEn = """
NAME
       snap - install and manage snap packages

SYNOPSIS
       snap COMMAND [OPTIONS] [SNAP]...

DESCRIPTION
       Snap is Canonical's package format and the default in Ubuntu. Snaps
       come from the Snap Store, run in a sandbox (confinement) and are
       updated automatically in the background. The snapd service handles
       everything.

       Programs that need access to the whole system (e.g. code editors)
       are published with "classic confinement" and must be installed
       with --classic - then they run without a sandbox.

COMMANDS
       find WORD         search the Snap Store
       info SNAP         show information and channels
       install SNAP      install (needs root)
       list              list installed snaps
       run SNAP          run a program from a snap
       refresh           update all snaps now
       remove SNAP       remove a snap

OPTIONS
       --classic         allow classic confinement (no sandbox)
       --channel=CHANNEL e.g. latest/beta or latest/edge

EXAMPLES
       sudo snap install hello-world
       snap run hello-world
       sudo snap install code --classic
""";

    private static readonly CommandDef Snap = new()
    {
        Name = "snap",
        Summary = "Installerar och hanterar snap-paket (Canonical/Ubuntu)",
        SummaryEn = "Installs and manages snap packages (Canonical/Ubuntu)",
        Man = SnapManSv,
        ManEn = SnapManEn,
        Run = RunSnap,
    };

    private static readonly Regex PublisherMark = new("[✓✪]\\z", RegexOptions.CultureInvariant);

    private static int RunSnap(CmdCtx ctx)
    {
        var sh = ctx.Sh;
        SnapSeed(sh);
        // /snap/bin/hello-world is really snap itself – then run the program.
        var invokedAs = VfsLib.Basename(ctx.Name);
        if (invokedAs != "snap") return RunSnapApp(ctx, invokedAs);

        var cmd = ctx.Args.Count > 0 ? ctx.Args[0] : null;
        var rest = ctx.Args.Skip(1).ToList();
        var o = UtilCmd.ParseOpts(rest, new OptSpec
        {
            Long = new() { ["classic"] = "c", ["channel"] = "C", ["beta"] = "b", ["edge"] = "e", ["candidate"] = "d", ["stable"] = "s", ["all"] = "a", ["purge"] = "p", ["list"] = "l" },
            Values = "C",
        });
        if (o.Error is not null)
        {
            ctx.Err($"error: {o.Error}\n");
            return 1;
        }
        int Denied()
        {
            ctx.Err("error: access denied (try with sudo)\n");
            return 1;
        }
        switch (cmd)
        {
            case null:
            case "help":
            case "--help":
                ctx.Out("The snap command lets you install, configure, refresh and remove snaps.\nSnaps are packages that work across many different Linux distributions,\nenabling secure delivery and operation of the latest apps and utilities.\n\nUsage: snap <command> [<options>...]\n\nCommonly used commands can be classified as follows:\n\n         Basics: find, info, install, remove, list\n        ...more: refresh, revert, switch, disable, enable\n            Run: run\n");
                return cmd is not null ? 0 : 1;
            case "version":
            case "--version":
                ctx.Out($"snap    2.71\nsnapd   2.71\nseries  16\n{sh.Distro.Id}  {sh.Distro.Version}\nkernel  {sh.Distro.Kernel}\n");
                return 0;
            case "list":
            {
                var list = InstalledSnaps(sh);
                if (list.Count == 0)
                {
                    ctx.Out("No snaps are installed yet. Try 'snap install hello-world'.\n");
                    return 0;
                }
                ctx.Out($"{"Name".PadRight(19)}{"Version".PadRight(17)}{"Rev".PadRight(7)}{"Tracking".PadRight(17)}{"Publisher".PadRight(14)}Notes\n");
                foreach (var s in list)
                {
                    var notes = s.Classic ? "classic" : (s.Def.Notes ?? "-");
                    ctx.Out($"{s.Def.Name.PadRight(19)}{s.Def.Version.PadRight(17)}{Js.Num(s.Rev).PadRight(7)}{"latest/stable".PadRight(17)}{s.Def.Publisher.PadRight(14)}{notes}\n");
                }
                return 0;
            }
            case "find":
            case "search":
            {
                var q = string.Join(" ", o.Operands).ToLowerInvariant();
                var hits = Snaps.Where(s => string.IsNullOrEmpty(s.Notes) && (s.Name.Contains(q) || s.Summary.ToLowerInvariant().Contains(q))).ToList();
                if (hits.Count == 0)
                {
                    ctx.Err($"No matching snaps for \"{q}\"\n");
                    return 1;
                }
                ctx.Out($"{"Name".PadRight(13)}{"Version".PadRight(13)}{"Publisher".PadRight(15)}{"Notes".PadRight(9)}Summary\n");
                foreach (var s in hits) ctx.Out($"{s.Name.PadRight(13)}{s.Version.PadRight(13)}{s.Publisher.PadRight(15)}{(s.Classic ? "classic" : "-").PadRight(9)}{s.Summary}\n");
                return 0;
            }
            case "info":
            {
                var def = o.Operands.Count > 0 && o.Operands[0] != "" ? GetSnapDef(o.Operands[0]) : null;
                if (def is null)
                {
                    ctx.Err($"error: no snap found for \"{(o.Operands.Count > 0 ? o.Operands[0] : "")}\"\n");
                    return 1;
                }
                var inst = InstalledSnaps(sh).FirstOrDefault(s => s.Def == def);
                ctx.Out(
                    $"name:      {def.Name}\nsummary:   {def.Summary}\npublisher: {PublisherMark.Replace(def.Publisher, "", 1)}\nlicense:   unset\n" +
                    (def.Classic ? "notes:     classic confinement – runs without the sandbox\n" : "") +
                    $"channels:\n  latest/stable:    {def.Version.PadRight(16)} ({def.Rev}) {def.SizeMb}MB{(def.Classic ? " classic" : "")}\n" +
                    $"  latest/candidate: ↑\n  latest/beta:      ↑\n  latest/edge:      {def.Version}+git ({def.Rev + 7}) {def.SizeMb}MB{(def.Classic ? " classic" : "")}\n" +
                    (inst is not null ? $"installed:          {def.Version.PadRight(16)} ({Js.Num(inst.Rev)}) {def.SizeMb}MB{(inst.Classic ? " classic" : "")}\n" : ""));
                return 0;
            }
            case "install":
            {
                if (o.Operands.Count == 0)
                {
                    ctx.Err("error: the required argument `<snap> (at least 1 argument)` was not provided\n");
                    return 1;
                }
                if (!IsRoot(sh)) return Denied();
                int code = 0;
                foreach (var name in o.Operands)
                {
                    var def = GetSnapDef(name);
                    if (def is null)
                    {
                        ctx.Err($"error: snap \"{name}\" not found\n");
                        code = 1;
                        continue;
                    }
                    if (InstalledSnaps(sh).Any(s => s.Def == def))
                    {
                        ctx.Out($"snap \"{name}\" is already installed, see 'snap help refresh'\n");
                        continue;
                    }
                    if (def.Classic && !o.Flags.Contains("c"))
                    {
                        ctx.Err(
                            $"error: This revision of snap \"{name}\" was published using classic confinement and thus may\n" +
                            "       perform arbitrary system changes outside of the security sandbox that snaps are usually\n" +
                            "       confined to, which may put your system at risk.\n\n       If you understand and want to proceed repeat the command including --classic.\n");
                        code = 1;
                        continue;
                    }
                    // The base (core22, core24 ...) and snapd come along if they are missing.
                    foreach (var dep in new[] { "snapd", def.Base }.Where(x => !string.IsNullOrEmpty(x)))
                    {
                        if (!InstalledSnaps(sh).Any(s => s.Def.Name == dep)) PlaceSnap(sh, GetSnapDef(dep!)!, false);
                    }
                    PlaceSnap(sh, def, def.Classic);
                    var channel = o.Values.Get("C") ?? (o.Flags.Contains("b") ? "beta" : o.Flags.Contains("e") ? "edge" : o.Flags.Contains("d") ? "candidate" : "");
                    ctx.Out($"{name}{(channel != "" ? $" ({channel})" : "")} {def.Version} from {def.Publisher} installed\n");
                }
                if (!(sh.Env.Get("PATH") ?? "").Split(':').Contains("/snap/bin"))
                {
                    sh.Env["PATH"] = $"{sh.Env.Get("PATH") ?? "/usr/bin:/bin"}:/snap/bin";
                    ctx.Out(Dim(sh, "universal.snapPathAdded"));
                }
                return code;
            }
            case "remove":
            {
                if (o.Operands.Count == 0)
                {
                    ctx.Err("error: the required argument `<snap> (at least 1 argument)` was not provided\n");
                    return 1;
                }
                if (!IsRoot(sh)) return Denied();
                foreach (var name in o.Operands)
                {
                    var inst = InstalledSnaps(sh).FirstOrDefault(s => s.Def.Name == name);
                    if (inst is null)
                    {
                        ctx.Out($"snap \"{name}\" is not installed\n");
                        continue;
                    }
                    sh.Vfs.Remove($"/snap/{name}", sh.RootUser());
                    foreach (var app in inst.Def.Apps ?? new List<string> { name })
                    {
                        if (TryNode(sh, $"/snap/bin/{app}") is not null) sh.Vfs.Remove($"/snap/bin/{app}", sh.RootUser());
                    }
                    var blob = $"/var/lib/snapd/snaps/{name}_{Js.Num(inst.Rev)}.snap";
                    if (TryNode(sh, blob) is not null) sh.Vfs.Remove(blob, sh.RootUser());
                    ctx.Out($"{name} removed{(o.Flags.Contains("p") ? "" : " (snap data snapshot saved)")}\n");
                }
                return 0;
            }
            case "refresh":
            {
                if (o.Flags.Contains("l"))
                {
                    ctx.Out("All snaps up to date.\n");
                    return 0;
                }
                if (!IsRoot(sh)) return Denied();
                ctx.Out("All snaps up to date.\n");
                return 0;
            }
            case "run":
            {
                var name = o.Operands.Count > 0 ? o.Operands[0] : null;
                if (string.IsNullOrEmpty(name))
                {
                    ctx.Err("error: need the application to run as argument\n");
                    return 1;
                }
                return RunSnapApp(ctx, name);
            }
        }
        ctx.Err($"error: unknown command \"{cmd}\", see 'snap help'.\n");
        return 1;
    }
}
