namespace Codestead.Shell.Tests;

// Port of src/shell/script.test.ts
public class ScriptTests
{
    // ---------- variabler och expansion ----------

    [Fact(DisplayName = "variabler och expansion: tilldelning delas inte upp, men ociterade variabler gör det")]
    public void AssignmentIsNotSplit()
    {
        var t = new TestShell();
        t.Run("x=\"a  b   c\"");
        Assert.Equal("a b c\n", t.Run("echo $x").Out);
        Assert.Equal("a  b   c\n", t.Run("echo \"$x\"").Out);
        t.Run("set -- ett \"två tre\"");
        Assert.Equal("[ett]\n[två tre]\n", t.Run("for a in \"$@\"; do echo \"[$a]\"; done").Out);
    }

    [Fact(DisplayName = "variabler och expansion: $(...), `...` och $((...))")]
    public void CommandAndArithmeticSubstitution()
    {
        var t = new TestShell();
        Assert.Equal("Jag är elev\n", t.Run("echo \"Jag är $(whoami)\"").Out);
        Assert.Equal("hej\n", t.Run("echo `echo hej`").Out);
        Assert.Equal("14\n", t.Run("echo $(( 2 + 3 * 4 ))").Out);
        t.Run("antal=$(wc -l < dokument/frukter.txt)");
        Assert.Equal("10\n", t.Run("echo $antal").Out);
        Assert.Equal("3\n", t.Run("echo $(( antal / 3 ))").Out);
        Assert.Equal("/etc\n/tmp\n", t.Run("cd /tmp; echo $(cd /etc; pwd); pwd").Out);
    }

    [Fact(DisplayName = "variabler och expansion: ${...}-varianter")]
    public void ParameterExpansionVariants()
    {
        var t = new TestShell();
        t.Run("fil=rapport.txt");
        Assert.Equal("rapport 11 standard port.txt\n", t.Run("echo ${fil%.txt} ${#fil} ${saknas:-standard} ${fil#rap}").Out);
        Assert.Equal(0, t.Run("echo ${fil%%.*} ${fil^^}").ExitCode);
    }

    // ---------- villkor ----------

    [Fact(DisplayName = "villkor: if med test och [ ]")]
    public void IfWithTest()
    {
        var t = new TestShell();
        Assert.Equal("finns\n", t.Run("if [ -f ~/.bashrc ]; then echo finns; else echo saknas; fi").Out);
        Assert.Equal("elif\n", t.Run("if [ -d /finnsinte ]; then echo ja; elif [ 3 -gt 2 ]; then echo elif; fi").Out);
        Assert.Equal("olika\n", t.Run("[ \"a\" = \"b\" ] || echo olika").Out);
        Assert.Equal(2, t.Run("[ 5 -lt abc ]").ExitCode);
        Assert.Equal("ok\n", t.Run("[ -z \"\" ] && [ -n \"x\" ] && echo ok").Out);
        Assert.Equal("match\n", t.Run("[[ rapport.txt == *.txt && 2 -lt 3 ]] && echo match").Out);
        Assert.Equal("saknas\n", t.Run("test ! -e /finnsinte && echo saknas").Out);
    }

    [Fact(DisplayName = "villkor: case")]
    public void Case()
    {
        var t = new TestShell();
        const string code = "for f in bild.png text.txt okänd; do case $f in *.png|*.jpg) echo \"$f: bild\";; *.txt) echo \"$f: text\";; *) echo \"$f: ?\";; esac; done";
        Assert.Equal("bild.png: bild\ntext.txt: text\nokänd: ?\n", t.Run(code).Out);
    }

    // ---------- loopar ----------

    [Fact(DisplayName = "loopar: for, while, until och c-stil")]
    public void Loops()
    {
        var t = new TestShell();
        Assert.Equal("varv 1\nvarv 2\nvarv 3\n", t.Run("for i in 1 2 3; do echo \"varv $i\"; done").Out);
        Assert.Equal("dokument/betyg.csv\ndokument/frukter.txt\ndokument/server.log\n", t.Run("for f in dokument/*; do echo $f; done").Out);
        Assert.Equal("0\n1\n2\n", t.Run("i=0; while [ $i -lt 3 ]; do echo $i; i=$((i+1)); done").Out);
        Assert.Equal("3\n2\n1\n", t.Run("n=3; until [ $n -eq 0 ]; do echo $n; ((n--)); done").Out);
        Assert.Equal("1\n2\n3\n", t.Run("for ((i=1; i<=3; i++)); do echo $i; done").Out);
        Assert.Equal("1\n3\n", t.Run("for i in $(seq 1 5); do [ $i -eq 2 ] && continue; [ $i -eq 4 ] && break; echo $i; done").Out);
    }

    [Fact(DisplayName = "loopar: while read rad < fil och pipe")]
    public void WhileRead()
    {
        var t = new TestShell();
        Assert.Equal("10\n", t.Run("n=0; while read rad; do n=$((n+1)); done < dokument/frukter.txt; echo $n").Out);
        Assert.Equal(
            "09:15:10 Kunde inte ansluta till databasen\n13:30:00 Disken /var är 95% full\n18:00:00 Tidsgräns överskriden för jobbet \"backup\"\n",
            t.Run("grep ERROR dokument/server.log | while read datum tid niva rest; do echo \"$tid $rest\"; done").Out);
    }

    [Fact(DisplayName = "loopar: loopens utdata kan skickas vidare och omdirigeras")]
    public void LoopOutputCanBePipedAndRedirected()
    {
        var t = new TestShell();
        Assert.Equal("1\n2\n3\n", t.Run("for i in 3 1 2; do echo $i; done | sort").Out);
        t.Run("for i in a b; do echo $i; done > loop.txt");
        Assert.Equal("a\nb\n", t.Run("cat loop.txt").Out);
    }

    [Fact(DisplayName = "loopar: oändliga loopar stoppas")]
    public void InfiniteLoopsAreStopped()
    {
        var t = new TestShell();
        var r = t.Run("while true; do :; done");
        Assert.Contains("oändlig loop", r.Out);
        Assert.Equal(130, r.ExitCode);
        Assert.Equal("fortfarande vid liv\n", t.Run("echo fortfarande vid liv").Out);
    }

    // ---------- funktioner ----------

    [Fact(DisplayName = "funktioner: argument, return och local")]
    public void ArgumentsReturnAndLocal()
    {
        var t = new TestShell();
        t.Run("halsa() { echo \"Hej $1, du har $# argument\"; }");
        Assert.Equal("Hej Kim, du har 2 argument\n", t.Run("halsa Kim extra").Out);
        t.Run("x=global; satt() { local x=lokal; echo $x; return 3; }");
        Assert.Equal("lokal\n3 global\n", t.Run("satt; echo \"$? $x\"").Out);
        Assert.Equal("halsa is a function\n", t.Run("type halsa").Out);
        t.Run("unset -f halsa");
        Assert.False(t.Sh.Functions.ContainsKey("halsa"));
    }

    [Fact(DisplayName = "funktioner: rekursion")]
    public void Recursion()
    {
        var t = new TestShell();
        t.Run("fak() { if [ $1 -le 1 ]; then echo 1; else echo $(( $1 * $(fak $(( $1 - 1 ))) )); fi; }");
        Assert.Equal("120\n", t.Run("fak 5").Out);
    }

    // ---------- skriptfiler ----------

    [Fact(DisplayName = "skriptfiler: flerradigt skript med argument, exit och funktioner")]
    public void MultiLineScript()
    {
        var t = new TestShell();
        var script = string.Join("\n", new[]
        {
            "#!/bin/bash",
            "# Räknar filer",
            "rakna() {",
            "  ls \"$1\" | wc -l",
            "}",
            "if [ $# -eq 0 ]; then",
            "  echo \"Användning: $0 KATALOG\"",
            "  exit 1",
            "fi",
            "for k in \"$@\"; do",
            "  echo \"$k: $(rakna $k) filer\"",
            "done",
        });
        t.Run($"printf '%s\\n' '{script.Replace("'", "'\\''")}' > raknare.sh");
        t.Run("chmod +x raknare.sh");
        Assert.Equal("Användning: ./raknare.sh KATALOG\n", t.Run("./raknare.sh").Out);
        Assert.Contains("\n1\n", t.Run("./raknare.sh; echo $?").Out);
        Assert.Equal("dokument: 3 filer\ngammalt: 3 filer\n", t.Run("./raknare.sh dokument gammalt").Out);
    }

    [Fact(DisplayName = "skriptfiler: skript körs i ett underskal men source påverkar skalet")]
    public void ScriptsRunInSubshellButSourceAffectsShell()
    {
        var t = new TestShell();
        var sh = t.Sh;
        t.Run("echo 'cd /tmp; X=1; f() { echo f; }' > s.sh");
        t.Run("bash s.sh");
        Assert.Equal("/home/elev", sh.Cwd);
        Assert.False(sh.Env.ContainsKey("X"));
        t.Run("source s.sh");
        Assert.Equal("/tmp", sh.Cwd);
        Assert.Equal("1", sh.Env["X"]);
        Assert.Equal("f\n", t.Run("f").Out);
    }

    // ---------- interaktivt ----------

    [Fact(DisplayName = "interaktivt: flerradig inmatning med > -prompt")]
    public void MultiLineInput()
    {
        var t = new TestShell();
        var sh = t.Sh;
        Assert.True(t.Run("for i in 1 2").Incomplete);
        Assert.Equal("> ", sh.Prompt());
        Assert.True(t.Run("do").Incomplete);
        Assert.True(t.Run("echo $i").Incomplete);
        var r = t.Run("done");
        Assert.Equal("1\n2\n", r.Out);
        Assert.Equal("for i in 1 2; do echo $i; done", r.Line);
        Assert.Equal("for i in 1 2; do echo $i; done", sh.History[^1]);
    }

    [Fact(DisplayName = "interaktivt: Ctrl+C avbryter påbörjad kod")]
    public void CtrlCCancels()
    {
        var t = new TestShell();
        var sh = t.Sh;
        t.Run("if true; then");
        sh.Cancel();
        Assert.NotEqual("> ", sh.Prompt());
        Assert.Equal("ok\n", t.Run("echo ok").Out);
    }

    [Fact(DisplayName = "interaktivt: read frågar användaren och fortsätter sedan raden")]
    public void ReadAsksTheUser()
    {
        var t = new TestShell();
        t.Run("read -p \"Vad heter du? \" namn; echo \"Hej $namn!\"");
        Assert.Equal("Vad heter du? ", t.Sh.Prompt());
        Assert.Equal("Hej Kim!\n", t.Run("Kim").Out);
    }

    [Fact(DisplayName = "interaktivt: read i skript utan indata ger ett tydligt fel")]
    public void ReadInScriptWithoutInput()
    {
        var t = new TestShell();
        t.Run("echo 'read x; echo \"[$x]\"' > r.sh");
        Assert.Contains("ingen indata", t.Run("bash r.sh").Out);
        Assert.Equal("[hej]\n", t.Run("echo hej | bash r.sh").Out);
    }

    // ---------- here-dokument ----------

    [Fact(DisplayName = "here-dokument: skapa ett skript med cat << EOF, rad för rad som i terminalen")]
    public void HeredocLineByLine()
    {
        var t = new TestShell();
        Assert.True(t.Run("cat > hej.sh << 'SLUT'").Incomplete);
        t.Run("#!/bin/bash");
        t.Run("echo \"Hej $1\"");
        var r = t.Run("SLUT");
        Assert.False(r.Incomplete);
        Assert.Equal("#!/bin/bash\necho \"Hej $1\"\n", t.Run("cat hej.sh").Out);
        Assert.Equal("Hej Kim\n", t.Run("bash hej.sh Kim").Out);
    }

    [Fact(DisplayName = "here-dokument: variabler expanderas bara utan citattecken runt slutordet")]
    public void HeredocExpansion()
    {
        var t = new TestShell();
        Assert.Equal("Jag är elev\n", t.Run("cat << EOF\nJag är $USER\nEOF").Out);
        Assert.Equal("Jag är $USER\n", t.Run("cat << 'EOF'\nJag är $USER\nEOF").Out);
        Assert.Equal("3\n", t.Run("wc -w <<< \"ett två tre\"").Out);
    }

    // ---------- printf ----------

    [Fact(DisplayName = "printf: format")]
    public void PrintfFormat()
    {
        var t = new TestShell();
        Assert.Equal("ab    |  42|3.14\n", t.Run("printf \"%-6s|%4d|%.2f\\n\" ab 42 3.14159").Out);
        Assert.Equal("a\nb\nc\n", t.Run("printf \"%s\\n\" a b c").Out);
        Assert.Equal("100%\n", t.Run("printf \"100%%\\n\"").Out);
    }
}
