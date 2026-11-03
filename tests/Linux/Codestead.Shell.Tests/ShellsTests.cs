using Codestead.Shell.Commands;

namespace Codestead.Shell.Tests;

// Port of src/shell/shells.test.ts
public class ShellsTests
{
    private static string Prompt(TestShell s) => UtilCmd.StripAnsi(s.Sh.Prompt());

    /// <summary>A shell with zsh and fish installed.</summary>
    private static TestShell WithShells(string distro = "ubuntu")
    {
        var s = new TestShell(distro);
        var cmds = distro switch
        {
            "ubuntu" => new[] { "sudo apt update", "sudo apt install zsh fish" },
            "debian" => new[] { "sudo apt update", "sudo apt install zsh fish" },
            "arch" => new[] { "sudo pacman -S zsh fish", "y" },
            "fedora" => new[] { "sudo dnf install zsh fish", "y" },
            _ => throw new ArgumentException(distro),
        };
        foreach (var c in cmds) s.Run(c);
        return s;
    }

    /// <summary>Starts zsh and answers zsh-newuser-install.</summary>
    private static void StartZsh(TestShell s, string answer = "2")
    {
        var r = s.Run("zsh");
        if (r.Pending) s.Run(answer);
    }

    // ---------- paket och /etc/shells ----------

    [Theory(DisplayName = "zsh och fish installeras och läggs i /etc/shells")]
    [InlineData("ubuntu")]
    [InlineData("debian")]
    [InlineData("arch")]
    [InlineData("fedora")]
    public void InstallAddsToEtcShells(string d)
    {
        var s = WithShells(d);
        Assert.True(s.Sh.Installed.ContainsKey("zsh") && s.Sh.Installed.ContainsKey("fish"));
        var shells = s.Run("cat /etc/shells").Out;
        Assert.Contains("/usr/bin/zsh", shells);
        Assert.Contains("/usr/bin/fish", shells);
        Assert.Equal("/usr/bin/zsh", s.Run("which zsh").Out.Trim());
    }

    [Fact(DisplayName = "zsh finns inte från början")]
    public void ZshNotInstalledByDefault()
    {
        var s = new TestShell();
        Assert.Equal(127, s.Run("zsh").ExitCode);
        Assert.DoesNotContain("zsh", s.Run("cat /etc/shells").Out);
    }

    [Fact(DisplayName = "avinstallation tar bort skalet ur /etc/shells")]
    public void UninstallRemovesFromEtcShells()
    {
        var s = WithShells("arch");
        s.Run("sudo pacman -R fish");
        s.Run("y");
        var shells = s.Run("cat /etc/shells").Out;
        Assert.DoesNotContain("fish", shells);
        Assert.Contains("/usr/bin/zsh", shells);
    }

    // ---------- zsh ----------

    [Fact(DisplayName = "startar med zsh-newuser-install, prompt och exit")]
    public void ZshNewuserInstallPromptExit()
    {
        var s = WithShells();
        var r = s.Run("zsh");
        Assert.Contains("zsh-newuser-install", r.Out);
        Assert.True(r.Pending);
        s.Run("0");
        Assert.Contains("newuser", s.Sh.Vfs.ReadFile("/home/elev/.zshrc", s.Sh.RootUser()));
        Assert.Equal("zsh", s.Sh.ShellMode);
        Assert.Equal("ubuntu% ", Prompt(s));
        Assert.Equal("zsh", s.Run("echo $0").Out.Trim());
        Assert.Equal("5.9", s.Run("echo $ZSH_VERSION").Out.Trim());
        // $SHELL is the login shell, not the shell that is running.
        Assert.Equal("/bin/bash", s.Run("echo $SHELL").Out.Trim());
        s.Run("exit");
        Assert.Equal("bash", s.Sh.ShellMode);
        Assert.Equal("elev@ubuntu:~$ ", Prompt(s));
        Assert.Equal("bash", s.Run("echo $0").Out.Trim());
    }

    [Fact(DisplayName = "rekommenderade inställningar: prompt och autocd")]
    public void RecommendedSettings()
    {
        var s = WithShells();
        StartZsh(s, "2");
        Assert.Equal("elev@ubuntu ~ % ", Prompt(s));
        s.Run("dokument");
        Assert.Equal("/home/elev/dokument", s.Sh.Cwd);
        Assert.Equal("elev@ubuntu dokument % ", Prompt(s));
        // Next time zsh does not ask again.
        s.Run("exit");
        Assert.False(s.Run("zsh").Pending);
        Assert.Equal("zsh", s.Sh.ShellMode);
    }

    [Fact(DisplayName = "setopt autocd och setopt finns bara i zsh")]
    public void SetoptOnlyInZsh()
    {
        var s = WithShells();
        Assert.Contains("command not found", s.Run("setopt autocd").Out);
        StartZsh(s, "q");
        Assert.Equal(127, s.Run("gammalt").ExitCode);
        s.Run("setopt autocd");
        s.Run("gammalt");
        Assert.Equal("/home/elev/gammalt", s.Sh.Cwd);
        Assert.Contains("autocd", s.Run("setopt").Out);
        Assert.Contains("no such option", s.Run("setopt nosuchthing").Out);
    }

    [Fact(DisplayName = "ps visar zsh som barn till bash")]
    public void PsShowsZshAsChild()
    {
        var s = WithShells();
        StartZsh(s);
        var output = s.Run("ps").Out;
        Assert.Matches(@"bash\n.*zsh\n.*ps", output);
        s.Run("exit");
        Assert.DoesNotContain("zsh", s.Run("ps").Out);
    }

    [Fact(DisplayName = "** letar i alla underkataloger, men inte i bash")]
    public void GlobstarInZshOnly()
    {
        var s = WithShells();
        Assert.DoesNotContain("logg-2019.txt", s.Run("ls -d ~/**/*.txt").Out);
        StartZsh(s);
        var output = s.Run("ls -d ~/**/*.txt").Out;
        Assert.Contains("/home/elev/dokument/frukter.txt", output);
        Assert.Contains("/home/elev/gammalt/arkiv/logg-2019.txt", output);
        Assert.Contains("/home/elev/anteckningar.txt", output);
    }

    [Fact(DisplayName = "ociterade variabler delas inte upp")]
    public void UnquotedVariablesNotSplit()
    {
        var s = WithShells();
        const string loop = "x=\"a b c\"; for i in $x; do echo \"[$i]\"; done";
        Assert.Equal("[a]\n[b]\n[c]\n", s.Run(loop).Out);
        StartZsh(s);
        Assert.Equal("[a b c]\n", s.Run(loop).Out);
        s.Run("setopt shwordsplit");
        Assert.Equal("[a]\n[b]\n[c]\n", s.Run(loop).Out);
    }

    [Fact(DisplayName = "felmeddelanden ser ut som i zsh")]
    public void ZshErrorMessages()
    {
        var s = WithShells();
        StartZsh(s);
        Assert.Equal("zsh: command not found: finnsinte\n", s.Run("finnsinte").Out);
    }

    [Fact(DisplayName = "variabler, alias och katalog från zsh försvinner vid exit")]
    public void ZshStateDiscardedOnExit()
    {
        var s = WithShells();
        s.Run("alias ll=\"ls -l\"");
        StartZsh(s);
        Assert.Equal(127, s.Run("ll").ExitCode);
        s.Run("hemligt=42");
        s.Run("cd /tmp");
        s.Run("exit");
        Assert.Equal("/home/elev", s.Sh.Cwd);
        Assert.Equal("[]\n", s.Run("echo \"[$hemligt]\"").Out);
        Assert.Equal("ls -l", s.Sh.Aliases["ll"]);
    }

    [Fact(DisplayName = "zsh -c och skript med #!/bin/zsh")]
    public void ZshDashCAndShebang()
    {
        var s = WithShells();
        Assert.Equal("zsh", s.Run("zsh -c 'echo $0'").Out.Trim());
        s.Run("printf '#!/usr/bin/zsh\\necho $ZSH_VERSION\\n' > ~/z.sh");
        s.Run("chmod +x ~/z.sh");
        Assert.Equal("5.9", s.Run("~/z.sh").Out.Trim());
        Assert.Equal("bash", s.Sh.ShellMode);
    }

    [Fact(DisplayName = "sudo zsh ger ett root-skal")]
    public void SudoZshGivesRootShell()
    {
        var s = WithShells();
        // root has no ~/.zshrc, so zsh-newuser-install asks.
        Assert.Contains("zsh-newuser-install", s.Run("sudo zsh").Out);
        s.Run("q");
        Assert.Equal("root", s.Run("whoami").Out.Trim());
        Assert.Equal("ubuntu# ", Prompt(s));
        s.Run("exit");
        Assert.Equal("elev", s.Run("whoami").Out.Trim());
    }

    [Fact(DisplayName = "promptkoder")]
    public void PromptCodes()
    {
        var sh = new TestShell("fedora").Sh;
        sh.Cwd = "/home/elev/dokument";
        Assert.Equal("elev@fedora ~/dokument % ", ShellmodeLib.ZshPrompt(sh, "%n@%m %~ %# "));
        Assert.Equal("[elev dokument]% ", ShellmodeLib.ZshPrompt(sh, "[%n %1~]%% "));
        Assert.Equal("/home/elev/dokument", ShellmodeLib.ZshPrompt(sh, "%d"));
    }

    // ---------- fish: översättning ----------

    private static string T(string code) => FishLib.TranslateFish(code);

    [Fact(DisplayName = "block och variabler")]
    public void BlocksAndVariables()
    {
        Assert.Equal("__fish_set namn Kim", T("set namn Kim"));
        Assert.Equal("echo ${namn} $(pwd)", T("echo $namn (pwd)"));
        Assert.Equal("for x in a b c; do echo ${x}; done", T("for x in a b c; echo $x; end"));
        Assert.Equal(
            "if test -f a && test -f b; then echo ja; elif true; then echo kanske; else echo nej; fi",
            T("if test -f a; and test -f b; echo ja; else if true; echo kanske; else; echo nej; end"));
        Assert.Equal("while read rad; do echo ${rad}; done < fil", T("while read -l rad; echo $rad; end < fil"));
        Assert.Equal("hej() { echo Hej ${1} \"$*\"; }", T("function hej; echo Hej $argv[1] \"$argv\"; end"));
        Assert.Equal("{ echo a; } | sort", T("begin; echo a; end | sort"));
        Assert.Equal("! test -f x || echo saknas", T("not test -f x; or echo saknas"));
        Assert.Equal("case ${x} in a|b) echo AB ;; *) echo annat ;; esac", T("switch $x; case a b; echo AB; case '*'; echo annat; end"));
        Assert.Equal("echo \"status: $?\"", T("echo \"status: $status\""));
        Assert.Equal("echo ${HOME}/x", T("echo {$HOME}/x"));
        Assert.Equal("sleep 5 &", T("sleep 5 &"));
        Assert.Equal("X=1 env", T("X=1 env"));
    }

    [Fact(DisplayName = "bash-syntax ger fish-fel")]
    public void BashSyntaxGivesFishErrors()
    {
        static string Err(string code)
        {
            try
            {
                T(code);
                return "";
            }
            catch (ParseError e)
            {
                return e.Message;
            }
        }
        Assert.Contains("Unsupported use of '='. In fish, please use 'set X 1'.", Err("X=1"));
        Assert.Contains("$? is not the exit status. In fish, please use $status.", Err("echo $?"));
        Assert.Contains("Variables cannot be bracketed. In fish, please use {$HOME}.", Err("echo ${HOME}"));
        Assert.Contains("please use 'math'", Err("echo $((1+2))"));
        Assert.Contains("Unknown command: do", Err("for i in 1 2; do echo $i; done"));
        Assert.Contains("'end' outside of a block", Err("end"));
        Assert.Contains("redirection", Err("cat << SLUT"));
    }

    [Fact(DisplayName = "ofullständiga block")]
    public void IncompleteBlocks()
    {
        foreach (var code in new[] { "for i in 1 2", "if true", "echo \"oavslutad", "echo (pwd" })
        {
            try
            {
                T(code);
                Assert.Fail(code);
            }
            catch (ParseError e)
            {
                Assert.True(e.Incomplete, code);
            }
        }
    }

    [Fact(DisplayName = "math")]
    public void Math()
    {
        // toBeCloseTo(3.333333) with the default precision 2: |diff| < 0.005
        Assert.True(System.Math.Abs(ShellsCmd.FishMath("10 / 3") - 3.333333) < 0.005);
        Assert.Equal(14, ShellsCmd.FishMath("2 + 3 x 4"));
        Assert.Equal(20, ShellsCmd.FishMath("(2 + 3) * 4"));
        Assert.Equal(1024, ShellsCmd.FishMath("2 ^ 10"));
        Assert.ThrowsAny<Exception>(() => ShellsCmd.FishMath("1 / 0"));
    }

    // ---------- fish i terminalen ----------

    [Fact(DisplayName = "start, hälsning, prompt och exit")]
    public void FishStartGreetingPromptExit()
    {
        var s = WithShells();
        var r = s.Run("fish");
        Assert.Contains("Welcome to fish, the friendly interactive shell", r.Out);
        Assert.Equal("elev@ubuntu ~> ", Prompt(s));
        Assert.NotNull(s.Sh.Vfs.TryLookup("/home/elev/.config/fish/config.fish", s.Sh.RootUser()));
        s.Run("mkdir -p ~/dokument/projekt/kod");
        s.Run("cd ~/dokument/projekt/kod");
        Assert.Equal("elev@ubuntu ~/d/p/kod> ", Prompt(s));
        s.Run("exit");
        Assert.Equal("bash", s.Sh.ShellMode);
        Assert.Equal("/home/elev", s.Sh.Cwd);
    }

    [Fact(DisplayName = "set, variabler och listor")]
    public void FishSetVariablesLists()
    {
        var s = WithShells();
        s.Run("fish");
        Assert.Contains("fish: Unsupported use of '='. In fish, please use 'set X 1'.", s.Run("X=1").Out);
        s.Run("set frukt äpple");
        Assert.Equal("äpple\n", s.Run("echo $frukt").Out);
        s.Run("set frukter äpple päron banan");
        Assert.Equal("päron\n", s.Run("echo $frukter[2]").Out);
        Assert.Equal("banan\n", s.Run("echo $frukter[-1]").Out);
        Assert.Equal("3\n", s.Run("count $frukter").Out);
        s.Run("set -x EDITOR nano");
        Assert.Contains("EDITOR=nano", s.Run("env").Out);
        Assert.Equal(0, s.Run("set -q EDITOR").ExitCode);
        s.Run("set -e EDITOR");
        Assert.Equal(1, s.Run("set -q EDITOR").ExitCode);
        s.Run("set -a frukter kiwi");
        Assert.Equal("4\n", s.Run("count $frukter").Out);
        s.Run("set PATH $PATH ~/bin");
        Assert.Equal("/usr/local/bin:/usr/bin:/bin:/home/elev/bin", s.Sh.Env["PATH"]);
        s.Run("exit");
        Assert.Null(s.Sh.Env.Get("frukt"));
    }

    [Fact(DisplayName = "loopar, villkor, funktioner och $status")]
    public void FishLoopsConditionsFunctions()
    {
        var s = WithShells();
        s.Run("fish");
        Assert.Equal("1\n2\n3\n", s.Run("for i in 1 2 3; echo $i; end").Out);
        Assert.Equal("nr 1\nnr 2\nnr 3\n", s.Run("for f in (seq 3); echo nr $f; end").Out);
        Assert.Equal("finns\n", s.Run("if test -f ~/.bashrc; echo finns; else; echo saknas; end").Out);
        s.Run("false");
        Assert.Equal("1\n", s.Run("echo $status").Out);
        Assert.Equal("ja\n", s.Run("true; and echo ja; or echo nej").Out);
        Assert.Equal("nej\n", s.Run("false; and echo ja; or echo nej").Out);
        s.Run("function hej; echo \"Hej $argv!\"; end");
        Assert.Equal("Hej Kim!\n", s.Run("hej Kim").Out);
        s.Run("function dubbla --argument-names tal; math $tal x 2; end");
        Assert.Equal("42\n", s.Run("dubbla 21").Out);
        Assert.Equal("2.5\n", s.Run("math 10 / 4").Out);
        Assert.Equal("1\n2\n3\n", s.Run("set i 0; while test $i -lt 3; set i (math $i + 1); echo $i; end").Out);
        Assert.Contains("$? is not the exit status", s.Run("echo $?").Out);
    }

    [Fact(DisplayName = "flerradiga block")]
    public void FishMultilineBlocks()
    {
        var s = WithShells();
        s.Run("fish");
        Assert.True(s.Run("for i in a b").Incomplete);
        Assert.True(s.Run("echo $i").Incomplete);
        var r = s.Run("end");
        Assert.Equal("a\nb\n", r.Out);
        Assert.Equal("for i in a b; echo $i; end", r.Line);
    }

    [Fact(DisplayName = "bash-syntax ger fel med tips, okänt kommando")]
    public void FishBashSyntaxHintsUnknownCommand()
    {
        var s = WithShells();
        s.Run("fish");
        var r = s.Run("for i in 1 2; do echo $i; done");
        Assert.Contains("fish: Unknown command: do", r.Out);
        Assert.NotEqual(0, r.ExitCode);
        Assert.Equal("fish: Unknown command: finnsinte\n", s.Run("finnsinte").Out);
        // && and $(...) work in newer fish
        Assert.Equal("ok\n", s.Run("true && echo ok").Out);
        Assert.Equal("inne\n", s.Run("echo $(echo inne)").Out);
    }

    [Fact(DisplayName = "universella variabler sparas i fish_variables")]
    public void FishUniversalVariables()
    {
        var s = WithShells();
        s.Run("fish");
        s.Run("set -U fish_greeting \"\"");
        s.Run("exit");
        Assert.Contains("SETUVAR fish_greeting:", s.Sh.Vfs.ReadFile("/home/elev/.config/fish/fish_variables", s.Sh.RootUser()));
        Assert.DoesNotContain("Welcome", s.Run("fish").Out);
    }

    [Fact(DisplayName = "skript med #!/usr/bin/fish körs av fish, bash-skript av bash")]
    public void FishShebangScripts()
    {
        var s = WithShells();
        s.Run("printf '#!/usr/bin/fish\\nset x fisk\\necho $x\\n' > ~/f.fish");
        s.Run("chmod +x ~/f.fish");
        Assert.Equal("fisk\n", s.Run("~/f.fish").Out);
        s.Run("printf '#!/bin/bash\\nx=bash\\necho $x\\n' > ~/b.sh");
        s.Run("chmod +x ~/b.sh");
        s.Run("fish");
        Assert.Equal("bash\n", s.Run("~/b.sh").Out);
        Assert.Equal("hej\n", s.Run("fish -c 'echo (echo hej)'").Out);
    }

    [Fact(DisplayName = "skript för ett skal som saknas: bad interpreter")]
    public void MissingShellBadInterpreter()
    {
        var s = new TestShell();
        s.Run("printf '#!/usr/bin/fish\\necho hej\\n' > ~/f.fish");
        s.Run("chmod +x ~/f.fish");
        var r = s.Run("~/f.fish");
        Assert.Contains("/usr/bin/fish: bad interpreter: No such file or directory", r.Out);
        Assert.Equal(126, r.ExitCode);
    }

    [Fact(DisplayName = "fishPwd förkortar sökvägen")]
    public void FishPwdShortens()
    {
        var sh = new TestShell().Sh;
        sh.Cwd = "/home/elev/.config/fish";
        Assert.Equal("~/.c/fish", ShellmodeLib.FishPwd(sh));
        sh.Cwd = "/usr/share/doc";
        Assert.Equal("/u/s/doc", ShellmodeLib.FishPwd(sh));
        sh.Cwd = "/";
        Assert.Equal("/", ShellmodeLib.FishPwd(sh));
    }

    // ---------- chsh ----------

    private static string PasswdShell(Shell sh) =>
        sh.Vfs.ReadFile("/etc/passwd", sh.RootUser())
            .Split('\n')
            .First(l => l.StartsWith("elev:", StringComparison.Ordinal))
            .Split(':')[6];

    [Theory(DisplayName = "byter skal i /etc/passwd")]
    [InlineData("ubuntu")]
    [InlineData("arch")]
    public void ChshChangesPasswd(string d)
    {
        var s = WithShells(d);
        var r = s.Run("chsh -s /usr/bin/zsh");
        Assert.Equal(0, r.ExitCode);
        Assert.Equal("/usr/bin/zsh", PasswdShell(s.Sh));
        if (d == "arch") Assert.Contains("Shell changed.", r.Out);
        // The shell in the terminal stays the same until the next login.
        Assert.Equal("bash", s.Sh.ShellMode);
        Assert.Equal("/bin/bash", s.Run("echo $SHELL").Out.Trim());
    }

    [Fact(DisplayName = "skal som inte finns i /etc/shells eller inte är installerade nekas")]
    public void ChshRejectsUnlistedShells()
    {
        var s = new TestShell("arch");
        Assert.Equal(1, s.Run("chsh -s /usr/bin/zsh").ExitCode);
        Assert.Contains("full path", s.Run("chsh -s zsh").Out);
        Assert.Contains("not listed in /etc/shells", s.Run("chsh -s /usr/bin/ls").Out);
        Assert.Equal("/bin/bash", PasswdShell(s.Sh));
        Assert.Contains("/bin/bash", s.Run("chsh -l").Out);
    }

    [Fact(DisplayName = "frågar efter skal utan -s, och bara root får byta åt andra")]
    public void ChshAsksAndOnlyRootChangesOthers()
    {
        var s = WithShells("debian");
        var r = s.Run("chsh");
        Assert.True(r.Pending);
        Assert.Equal("\tLogin Shell [/bin/bash]: ", Prompt(s));
        s.Run("/usr/bin/fish");
        Assert.Equal("/usr/bin/fish", PasswdShell(s.Sh));
        Assert.Contains("You may not change the shell for 'root'", s.Run("chsh -s /bin/zsh root").Out);
        s.Run("sudo chsh -s /bin/zsh root");
        Assert.Contains("root:x:0:0:root:/root:/bin/zsh", s.Sh.Vfs.ReadFile("/etc/passwd", s.Sh.RootUser()));
    }
}
