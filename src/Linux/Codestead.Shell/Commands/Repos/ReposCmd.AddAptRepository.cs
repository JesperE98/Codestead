namespace Codestead.Shell.Commands;

// The add-apt-repository command: adds a repository (e.g. a PPA) for apt.

using static ExtrarepoLib;

public static partial class ReposCmd
{
    /// <summary>An IO for running another command from an answer to a question.</summary>
    private static IO AsIO(Sink io) => new(io.OutFn, io.ErrFn, null, true);

    private static string PpaSources(Ppa p) =>
        $"Types: deb\nURIs: {PpaUri(p)}\nSuites: {PpaSuite}\nComponents: main\nSigned-By:\n" +
        " -----BEGIN PGP PUBLIC KEY BLOCK-----\n .\n mQINBGcx5aEBEADJq3s1mUlEf0lunatoolsimuleradnyckel4QkZb9TnW0c2Lm\n" +
        " =x7Qe\n -----END PGP PUBLIC KEY BLOCK-----\n";

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
}
