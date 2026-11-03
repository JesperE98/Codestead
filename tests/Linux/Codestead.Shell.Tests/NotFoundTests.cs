using Codestead.Shell.Commands;

namespace Codestead.Shell.Tests;

/// <summary>
/// After "command not found" the simulator says whose mistake it is: a likely typo ("Did you mean"), a real
/// command the simulator does not have, or a command in a package that is not installed.
/// </summary>
public class NotFoundTests
{
    [Fact(DisplayName = "stavfel ger förslag på kommandon som finns")]
    public void TypoSuggestsCommands()
    {
        var t = new TestShell(lang: "en");
        var r = t.Run("lss");
        Assert.Equal(127, r.ExitCode);
        Assert.StartsWith("bash: lss: command not found\n", r.Out);
        Assert.Contains("did you mean", r.Out);
        Assert.Contains("ls", r.Out);
        // Two swapped letters count as one typo.
        Assert.Contains("did you mean", t.Run("pdw").Out);
        Assert.Contains("pwd", t.Run("pdw").Out);
        // An alias or a function of the learner is suggested too.
        t.Run("alias hej='echo hej'");
        Assert.Contains("hej", t.Run("hjej").Out);
    }

    [Fact(DisplayName = "ett riktigt kommando som simulatorn saknar sägs vara just det")]
    public void RealCommandNotInSimulator()
    {
        var t = new TestShell(lang: "en");
        var r = t.Run("jq .name file.json");
        Assert.Equal(127, r.ExitCode);
        Assert.Contains("'jq' is a real Linux command, but this simulator does not have it", r.Out);
        Assert.DoesNotContain("did you mean", r.Out);
        Assert.Contains("simulatorn har det inte", new TestShell(lang: "sv").Run("nmap localhost").Out);
    }

    [Fact(DisplayName = "ett kommando i ett paket som inte är installerat visar paketet som förut")]
    public void PackageTipUnchanged()
    {
        var arch = new TestShell("arch", lang: "en");
        var r = arch.Run("cowsay hej");
        Assert.Contains("command not found", r.Out);
        Assert.Contains("the command is in the package 'cowsay'", r.Out);
        Assert.DoesNotContain("real Linux command", r.Out);
        // Ubuntu's own message stays exactly as on a real Ubuntu.
        var ubuntu = new TestShell(lang: "en").Run("cowsay hej").Out;
        Assert.StartsWith("Command 'cowsay' not found, but can be installed with:\nsudo apt install cowsay\n", ubuntu);
    }

    [Fact(DisplayName = "nonsens ger bara felet, och sudo/xargs får samma hjälp")]
    public void NonsenseAndWrappers()
    {
        var t = new TestShell(lang: "en");
        Assert.Equal("bash: qqqqqqqq: command not found\n", t.Run("qqqqqqqq").Out);
        var sudo = t.Run("sudo jq .");
        Assert.Contains("sudo: jq: command not found", sudo.Out);
        Assert.Contains("real Linux command", sudo.Out);
        var xargs = t.Run("echo a | xargs lss");
        Assert.Contains("xargs: lss: No such file or directory", xargs.Out);
        Assert.Contains("did you mean", xargs.Out);
    }

    [Fact(DisplayName = "listan över riktiga kommandon innehåller inget som simulatorn har")]
    public void KnownCommandsAreNotImplemented()
    {
        var implemented = KnownCommands.Real.Where(IndexCmd.Commands.ContainsKey).Order().ToList();
        Assert.True(implemented.Count == 0, "In KnownCommands but implemented: " + string.Join(", ", implemented));
        var packaged = KnownCommands.Real
            .Where(c => new[] { "debian", "arch", "redhat" }.Any(f => PackagesLib.PackageProviding(f, c) is not null))
            .Order().ToList();
        Assert.True(packaged.Count == 0, "In KnownCommands but in a package: " + string.Join(", ", packaged));
    }
}
