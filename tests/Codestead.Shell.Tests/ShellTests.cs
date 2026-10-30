namespace Codestead.Shell.Tests;

// Port of src/shell/shell.test.ts. The parser tests ("parser: ...") live in CoreTests.cs.
public class ShellTests
{
    // ---------- expansion ----------

    [Fact(DisplayName = "expansion: variabler och citattecken")]
    public void VariablesAndQuotes()
    {
        var t = new TestShell();
        Assert.Equal("/home/elev\n", t.Run("echo \"$HOME\"").Out);
        Assert.Equal("$HOME\n", t.Run("echo '$HOME'").Out);
        Assert.Equal("$HOME\n", t.Run("echo \\$HOME").Out);
        Assert.Equal("/home/elev/x\n", t.Run("echo ~/x").Out);
    }

    [Fact(DisplayName = "expansion: jokertecken")]
    public void Wildcards()
    {
        var t = new TestShell();
        Assert.Equal("dokument/betyg.csv dokument/frukter.txt dokument/server.log\n", t.Run("echo dokument/*").Out);
        Assert.Equal("dokument/*\n", t.Run("echo \"dokument/*\"").Out);
        Assert.Equal("*.saknas\n", t.Run("echo *.saknas").Out);
    }

    [Fact(DisplayName = "expansion: $? och kedjor")]
    public void ExitStatusAndChains()
    {
        var t = new TestShell();
        Assert.Contains("\n2\n", t.Run("ls /finnsinte; echo $?").Out);
        Assert.Equal("ja\n", t.Run("false && echo nej || echo ja").Out);
    }

    // ---------- filer och rättigheter ----------

    [Fact(DisplayName = "filer och rättigheter: skapa, kopiera, flytta och ta bort")]
    public void CreateCopyMoveRemove()
    {
        var t = new TestShell();
        var sh = t.Sh;
        t.Run("mkdir -p a/b && touch a/b/c.txt && cp -r a kopia && mv kopia/b/c.txt kopia/d.txt");
        Assert.NotNull(sh.Vfs.TryLookup("/home/elev/kopia/d.txt", sh.RootUser()));
        Assert.Contains("Is a directory", t.Run("rm a").Out);
        t.Run("rm -r a");
        Assert.Null(sh.Vfs.TryLookup("/home/elev/a", sh.RootUser()));
    }

    [Fact(DisplayName = "filer och rättigheter: vanliga användare får inte skriva i /etc")]
    public void NoWritingInEtc()
    {
        var t = new TestShell();
        Assert.Equal("touch: cannot touch '/etc/x': Permission denied\n", t.Run("touch /etc/x").Out);
        Assert.Equal("bash: /etc/x: Permission denied\n", t.Run("echo hej > /etc/x").Out);
        Assert.Equal(0, t.Run("sudo touch /etc/x").ExitCode);
    }

    [Fact(DisplayName = "filer och rättigheter: rm -rf / stoppas")]
    public void RmRfRootIsStopped()
    {
        var t = new TestShell();
        Assert.Contains("dangerous", t.Run("sudo rm -rf /").Out);
    }

    [Fact(DisplayName = "filer och rättigheter: chmod och körbara skript")]
    public void ChmodAndExecutableScripts()
    {
        var t = new TestShell();
        t.Run("echo 'echo från skriptet' > s.sh");
        Assert.Equal("bash: ./s.sh: Permission denied\n", t.Run("./s.sh").Out);
        Assert.Equal("från skriptet\n", t.Run("bash s.sh").Out);
        t.Run("chmod u+x s.sh");
        Assert.Matches("^-rwxr--r--", t.Run("ls -l s.sh").Out);
        Assert.Equal("från skriptet\n", t.Run("./s.sh").Out);
        t.Run("chmod 640 s.sh");
        Assert.Matches("^-rw-r-----", t.Run("ls -l s.sh").Out);
    }

    [Fact(DisplayName = "filer och rättigheter: cd in i /root nekas")]
    public void CdIntoRootIsDenied()
    {
        var t = new TestShell();
        Assert.Equal("bash: cd: /root: Permission denied\n", t.Run("cd /root").Out);
        t.Run("sudo -i");
        Assert.Equal("root@ubuntu:~# ", t.Sh.Prompt());
        t.Run("exit");
        Assert.Equal("elev", t.Sh.CurrentUser().Name);
    }

    // ---------- textverktyg ----------

    [Fact(DisplayName = "textverktyg: grep, sort, uniq, wc och head")]
    public void GrepSortUniqWcHead()
    {
        var t = new TestShell();
        Assert.Equal("3\n", t.Run("grep -c ERROR dokument/server.log").Out);
        Assert.Equal("3\n", t.Run("grep -ic warn dokument/server.log").Out);
        Assert.Equal("5\n", t.Run("grep -E \"ERROR|WARN\" dokument/server.log | wc -l").Out);
        Assert.Equal(1, t.Run("grep \"ERROR|WARN\" dokument/server.log").ExitCode);
        Assert.Equal("      3 äpple\n", t.Run("sort dokument/frukter.txt | uniq -c | sort -rn | head -1").Out);
        Assert.Equal("10\n", t.Run("wc -l < dokument/frukter.txt").Out);
        Assert.Equal("elev\n", t.Run("cut -d: -f1 /etc/passwd | tail -1").Out);
    }

    [Fact(DisplayName = "textverktyg: tee och 2>/dev/null")]
    public void TeeAndDevNull()
    {
        var t = new TestShell();
        Assert.Equal("hej\n", t.Run("echo hej | tee x.txt").Out);
        Assert.Equal("hej\n", t.Run("cat x.txt").Out);
        Assert.Equal("", t.Run("ls /finnsinte 2>/dev/null").Out);
        Assert.Equal("1\n", t.Run("ls /finnsinte 2>&1 | wc -l").Out);
    }

    [Fact(DisplayName = "textverktyg: alias och export")]
    public void AliasAndExport()
    {
        var t = new TestShell();
        t.Run("alias ll='ls -la'");
        Assert.Contains(".bashrc", t.Run("ll").Out);
        t.Run("export FAVORIT=linux");
        Assert.Equal("linux\n", t.Run("echo $FAVORIT").Out);
        Assert.Equal("linux", t.Sh.Env["FAVORIT"]);
    }

    // ---------- pakethantering ----------

    [Fact(DisplayName = "pakethantering: apt kräver sudo och apt update")]
    public void AptNeedsSudoAndUpdate()
    {
        var t = new TestShell("debian");
        var sh = t.Sh;
        Assert.Equal(100, t.Run("apt install tree").ExitCode);
        Assert.Contains("Unable to locate package tree", t.Run("sudo apt install tree").Out);
        t.Run("sudo apt update");
        t.Run("sudo apt install tree");
        Assert.True(sh.Installed.ContainsKey("tree"));
        Assert.Equal(0, t.Run("tree -L 1").ExitCode);
        t.Run("sudo apt remove tree");
        Assert.Equal("Do you want to continue? [Y/n] ", sh.Prompt());
        t.Run("");
        Assert.False(sh.Installed.ContainsKey("tree"));
        Assert.Equal(127, t.Run("tree").ExitCode);
    }

    [Fact(DisplayName = "pakethantering: pacman och partiella svar")]
    public void PacmanAndPartialAnswers()
    {
        var t = new TestShell("arch");
        var sh = t.Sh;
        Assert.Contains("unless you are root", t.Run("pacman -S htop").Out);
        t.Run("sudo pacman -S htop");
        t.Run("n");
        Assert.False(sh.Installed.ContainsKey("htop"));
        t.Run("sudo pacman -S --noconfirm htop");
        Assert.True(sh.Installed.ContainsKey("htop"));
        Assert.Matches(@"^htop \S+\n\z", t.Run("pacman -Q htop").Out);
        Assert.Equal(1, t.Run("sudo pacman -R pacman").ExitCode);
    }

    [Fact(DisplayName = "pakethantering: dnf har Nej som standardsvar och olika paketnamn")]
    public void DnfDefaultsToNo()
    {
        var t = new TestShell("fedora");
        var sh = t.Sh;
        t.Run("sudo dnf install vim");
        Assert.False(sh.Installed.ContainsKey("vim"));
        t.Run("sudo dnf install vim-enhanced");
        t.Run("");
        Assert.False(sh.Installed.ContainsKey("vim"));
        t.Run("sudo dnf install -y vim-enhanced");
        Assert.True(sh.Installed.ContainsKey("vim"));
        Assert.Equal(100, t.Run("dnf check-update").ExitCode);
    }

    [Fact(DisplayName = "pakethantering: pakethanteraren finns bara i rätt familj")]
    public void PackageManagerOnlyInItsFamily()
    {
        Assert.Equal(127, new TestShell("ubuntu").Run("pacman -Q").ExitCode);
        Assert.Equal(127, new TestShell("arch").Run("apt list").ExitCode);
        Assert.Equal(127, new TestShell("fedora").Run("apt list").ExitCode);
    }

    [Fact(DisplayName = "pakethantering: ubuntu föreslår paket för kommandon som saknas")]
    public void UbuntuSuggestsPackages()
    {
        Assert.Contains("sudo apt install htop", new TestShell("ubuntu").Run("htop").Out);
    }

    // ---------- tab-komplettering ----------

    [Fact(DisplayName = "tab-komplettering: kommandon och sökvägar")]
    public void CommandsAndPaths()
    {
        var sh = new TestShell().Sh;
        Assert.Equal("whoami ", sh.Complete("whoa").Line);
        Assert.Equal("cd dokument/", sh.Complete("cd dok").Line);
        Assert.Equal("cat dokument/server.log ", sh.Complete("cat dokument/s").Line);
        Assert.Equal(new[] { "betyg.csv", "frukter.txt", "server.log" }, sh.Complete("ls dokument/").Options);
    }

    // ---------- uppdatering av sparat tillstånd ----------

    [Fact(DisplayName = "uppdatering av sparat tillstånd: nya förinstallerade program och övningsfiler läggs till, borttagna läggs inte tillbaka")]
    public void MissingDefaultsAreAdded()
    {
        var t = new TestShell("debian");
        t.Run("sudo apt remove -y nano");
        t.Run("rm ~/dokument/frukter.txt");
        var old = Js.Clone(t.Sh.Snapshot());
        // Simulate a state from an older version: without sed and betyg.csv.
        old.Installed.Remove("sed");
        old.Fs.Children!["usr"].Children!["bin"].Children!.Remove("sed");
        old.Fs.Children["home"].Children!["elev"].Children!["dokument"].Children!.Remove("betyg.csv");
        foreach (var k in old.Flags.Keys.ToList())
        {
            if (k.StartsWith("default:", StringComparison.Ordinal) && (k.Contains("sed") || k.Contains("betyg"))) old.Flags.Remove(k);
        }
        var restored = Shell.Restore(old)!;
        Assert.True(restored.Installed.ContainsKey("sed"));
        Assert.Equal("hallå\n", restored.Execute("echo hej | sed 's/hej/hallå/'").Output);
        Assert.NotNull(restored.Vfs.TryLookup("/home/elev/dokument/betyg.csv", restored.RootUser()));
        Assert.False(restored.Installed.ContainsKey("nano"));
        Assert.Null(restored.Vfs.TryLookup("/home/elev/dokument/frukter.txt", restored.RootUser()));
    }

    // ---------- spara och återställa ----------

    [Fact(DisplayName = "spara och återställa: snapshot överlever JSON")]
    public void SnapshotSurvivesJson()
    {
        var t = new TestShell("arch");
        t.Run("mkdir sparad && cd sparad");
        var restored = Shell.Restore(Js.Clone(t.Sh.Snapshot()))!;
        Assert.Equal("/home/elev/sparad", restored.Cwd);
        Assert.Equal("arch", restored.Distro.Id);
    }
}
