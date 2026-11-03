using System.Text.RegularExpressions;
using Codestead.Shell.Commands;

namespace Codestead.Shell.Tests;

// Port of src/shell/i18n.test.ts
public class I18nTests
{
    private static readonly Regex Swedish = new("[åäöÅÄÖ]", RegexOptions.CultureInvariant);
    private static readonly Regex SwedishHeadings = new(@"^(NAMN|BESKRIVNING|FLAGGOR|EXEMPEL|VARNING|TIPS FRÅN)\b", RegexOptions.Multiline | RegexOptions.CultureInvariant);
    private static readonly Regex ExerciseNames = new("frukter|dokument|betyg|anteckningar|välkommen", RegexOptions.CultureInvariant);
    private static readonly Regex NameHeading = new("^NAME\n", RegexOptions.CultureInvariant);
    private static readonly Regex NamnHeading = new("^NAMN\n", RegexOptions.CultureInvariant);

    private static TestShell NewShell(string distro = "ubuntu", string lang = "en") => new(distro, lang);

    private static void NotMatch(Regex re, string s, string label) =>
        Assert.False(re.IsMatch(s), $"{label}: expected not to match {re}:\n{s}");

    // ---------- engelska manualsidor ----------

    [Fact(DisplayName = "varje kommando har en engelsk sammanfattning")]
    public void EveryCommandHasAnEnglishSummary()
    {
        var sv = Shell.Create("ubuntu", "sv");
        var sh = NewShell().Sh;
        foreach (var def in IndexCmd.Commands.Values)
        {
            if (def.Name.StartsWith("__", StringComparison.Ordinal)) continue; // hidden internal helper commands
            var en = ManEnCmd.SummaryFor(def, sh);
            Assert.True(en != ManEnCmd.SummaryFor(def, sv), $"{def.Name}: English summary equals the Swedish one: {en}");
            NotMatch(Swedish, en, def.Name);
        }
    }

    [Fact(DisplayName = "varje kommando har en engelsk manualsida")]
    public void EveryCommandHasAnEnglishManPage()
    {
        var sh = NewShell().Sh;
        foreach (var def in IndexCmd.Commands.Values)
        {
            if (def.Name.StartsWith("__", StringComparison.Ordinal)) continue;
            var man = ManEnCmd.ManFor(def, sh);
            Assert.True(NameHeading.IsMatch(man), $"{def.Name}: expected to start with NAME:\n{man}");
            NotMatch(SwedishHeadings, man, def.Name);
            // Examples may use the Swedish names of the exercise files, but not Swedish text.
            NotMatch(Swedish, ExerciseNames.Replace(man, ""), def.Name);
        }
    }

    [Fact(DisplayName = "svenska är oförändrat")]
    public void SwedishIsUnchanged()
    {
        var sh = NewShell("ubuntu", "sv").Sh;
        Assert.Matches(NamnHeading, ManEnCmd.ManFor(IndexCmd.Commands["ls"], sh));
        Assert.Equal("Byter aktuell katalog", ManEnCmd.SummaryFor(IndexCmd.Commands["cd"], sh));
    }

    [Fact(DisplayName = "man, --help och help på engelska")]
    public void ManHelpAndHelpInEnglish()
    {
        var t = NewShell();
        var man = t.Run("man ls").Out;
        Assert.Contains("Simulated manual", man);
        Assert.Contains("DESCRIPTION", man);
        Assert.Contains("-a, --all", man);
        Assert.Contains("copy files and directories", t.Run("cp --help").Out);
        var help = t.Run("help").Out;
        Assert.Contains("Commands in this simulated terminal", help);
        Assert.Contains("Changes the current directory", help);
        NotMatch(Swedish, help, "help");

        var sv = NewShell("ubuntu", "sv");
        Assert.Contains("Simulerad manual", sv.Run("man ls").Out);
        Assert.Contains("Kommandon i den här simulerade terminalen", sv.Run("help").Out);
    }

    // ---------- simulatorns tipsrader på engelska ----------

    [Fact(DisplayName = "välkomsttexten")]
    public void WelcomeText()
    {
        var sh = NewShell().Sh;
        Assert.Contains("Simulated terminal", UtilCmd.StripAnsi(sh.Welcome()));
        NotMatch(Swedish, sh.Welcome(), "welcome");
        Assert.Contains("Simulerad terminal", Shell.Create("ubuntu", "sv").Welcome());
    }

    [Theory(DisplayName = "inga svenska tecken i utskrifterna")]
    [InlineData("ubuntu")]
    [InlineData("arch")]
    [InlineData("fedora")]
    public void NoSwedishCharactersInOutput(string distro)
    {
        var t = NewShell(distro);
        var sh = t.Sh;
        // Install every program so that their tip lines run too.
        foreach (var pkg in PackagesLib.Packages)
        {
            if (!string.IsNullOrEmpty(pkg.Names.Get(sh.Distro.Family))) PackagesLib.InstallPackage(sh, pkg);
        }
        var lines = new[]
        {
            "help",
            "man man",
            "man tar",
            "ls --help",
            "sudo whoami",
            "su -",
            "bash",
            "nano anteckning.txt",
            "vim",
            "htop",
            "git status",
            "curl https://example.com",
            "wget https://example.com",
            "ssh elev@server",
            "python3",
            "top",
            $"kill {ProcsLib.ShellPid}",
            "sleep 300 &",
            "fg",
            "tail -f /etc/hostname",
            "awk 'function f() { return 1 } { print }' /etc/hostname",
            "awk '/a/,/b/' /etc/hostname",
            "sed 'h' /etc/hostname",
            "echo | read x; printf \"read x\\n\" > /tmp/r.sh; bash /tmp/r.sh < /dev/null",
            "f() { f; }; f",
            "while true; do true; done",
            "cowsay hej",
            "exit",
            "man nosuchcommand",
        };
        foreach (var line in lines)
        {
            var output = t.Run(line).Out;
            if (sh.PendingQuestion is not null) t.Run("n");
            NotMatch(Swedish, output, line);
        }
    }

    [Fact(DisplayName = "pakethanteraren i Debian/Ubuntu")]
    public void PackageManagerInDebianUbuntu()
    {
        var t = NewShell("ubuntu");
        var output = t.Run("sudo apt install tree").Out + t.Run("sudo apt upgrade").Out + t.Run("sudo apt remove bash").Out;
        Assert.Contains("Tip from the simulator", output);
        NotMatch(Swedish, output, "apt");
    }

    [Fact(DisplayName = "kommandot finns i ett paket")]
    public void CommandIsInAPackage()
    {
        var t = NewShell("fedora");
        var output = t.Run("cowsay hej").Out;
        Assert.Contains("command not found", output);
        Assert.Contains("Tip from the simulator", output);
        NotMatch(Swedish, output, "cowsay hej");
    }

    [Fact(DisplayName = "samma rader på svenska")]
    public void SameLinesInSwedish()
    {
        var t = NewShell("fedora", "sv");
        Assert.Contains("Tips från simulatorn", t.Run("cowsay hej").Out);
        Assert.Contains("Du kör redan bash!", t.Run("bash").Out);
        Assert.Contains("simulerad terminal", t.Run("exit").Out);
    }
}
