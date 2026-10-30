namespace Codestead.Shell.Tests;

// Tests for the core written while porting (parser, arithmetic, snapshots).
// The full port of src/shell/shell.test.ts lives in ShellTests.cs.
public class CoreTests
{
    private static List<string> Types(string code) =>
        ((ListNode)ParserLib.Parse(code)).Items.Select(i => i.Node.Type).ToList();

    [Fact(DisplayName = "parser: pipes, kedjor och omdirigering")]
    public void PipesChainsRedirects()
    {
        var ast = (ListNode)ParserLib.Parse("ls -l | grep x > ut.txt && echo klar; echo \"a b\" 'c d'");
        Assert.Equal(2, ast.Items.Count);
        var andor = Assert.IsType<AndOrNode>(ast.Items[0].Node);
        var pipeline = Assert.IsType<PipelineNode>(andor.First);
        Assert.Equal(">", ((SimpleNode)pipeline.Commands[1]).Redirects[0].Op);
        Assert.Equal("&&", andor.Rest[0].Op);
        Assert.Equal(new[] { "echo", "\"a b\"", "'c d'" }, ((SimpleNode)ast.Items[1].Node).Words.Select(w => w.Raw));
    }

    [Fact(DisplayName = "parser: syntaxfel och ofullständig kod")]
    public void SyntaxErrors()
    {
        Assert.Throws<ParseError>(() => ParserLib.Parse("ls |"));
        Assert.Throws<ParseError>(() => ParserLib.Parse("echo \"oavslutad"));
        Assert.Throws<ParseError>(() => ParserLib.Parse("ls &&"));
        static bool Incomplete(string code)
        {
            try
            {
                ParserLib.Parse(code);
                return false;
            }
            catch (ParseError e)
            {
                return e.Incomplete;
            }
        }
        Assert.True(Incomplete("for i in 1 2 3; do"));
        Assert.True(Incomplete("if true; then echo a"));
        Assert.True(Incomplete("echo \"a"));
        Assert.False(Incomplete("fi"));
        Assert.False(Incomplete("done"));
    }

    [Fact(DisplayName = "parser: 2> räknas bara som operator i början av ett ord")]
    public void StderrOperator()
    {
        var cmd = (SimpleNode)((ListNode)ParserLib.Parse("echo fil2>x")).Items[0].Node;
        Assert.Equal(new[] { "echo", "fil2" }, cmd.Words.Select(w => w.Raw));
        Assert.Equal(">", cmd.Redirects[0].Op);
    }

    [Fact(DisplayName = "parser: sammansatta kommandon")]
    public void Compound()
    {
        Assert.Equal(new[] { "if" }, Types("if true; then echo a; elif false; then echo b; else echo c; fi"));
        Assert.Equal(new[] { "for" }, Types("for f in *.txt; do echo $f; done"));
        Assert.Equal(new[] { "cfor" }, Types("for ((i=0; i<3; i++)); do echo $i; done"));
        Assert.Equal(new[] { "while" }, Types("while read x; do echo $x; done < fil"));
        Assert.Equal(new[] { "case" }, Types("case $x in a|b) echo ab;; *) echo annat;; esac"));
        Assert.Equal(new[] { "funcdef", "funcdef" }, Types("hej() { echo hej; }; function da { echo da; }"));
        Assert.Equal(new[] { "group", "group" }, Types("(cd /tmp; ls); { echo a; echo b; }"));
        Assert.Equal(new[] { "arith" }, Types("((x = 1 + 2))"));
    }

    [Fact(DisplayName = "parser: here-dokument")]
    public void Heredoc()
    {
        var cmd = (SimpleNode)((ListNode)ParserLib.Parse("cat << SLUT\nhej $X\nSLUT\n")).Items[0].Node;
        Assert.Equal("<<", cmd.Redirects[0].Op);
        Assert.Equal("hej $X\n", cmd.Redirects[0].Body);
        Assert.True(cmd.Redirects[0].Expand);
    }

    [Fact(DisplayName = "aritmetik som i bash")]
    public void Arithmetic()
    {
        var env = new Dictionary<string, string>();
        var vars = new ArithVars { Get = n => env.TryGetValue(n, out var v) ? v : null, Set = (n, v) => env[n] = v };
        Assert.Equal(7, ArithLib.EvalArith("1 + 2 * 3", vars));
        Assert.Equal(2, ArithLib.EvalArith("7 / 3", vars));
        Assert.Equal(1024, ArithLib.EvalArith("2 ** 10", vars));
        Assert.Equal(5, ArithLib.EvalArith("x = 5", vars));
        Assert.Equal(5, ArithLib.EvalArith("x++", vars));
        Assert.Equal("6", env["x"]);
        Assert.Equal(1, ArithLib.EvalArith("x > 3 ? 1 : 0", vars));
        Assert.Throws<ArithError>(() => ArithLib.EvalArith("1 / 0", vars));
    }

    [Fact(DisplayName = "glob blir regex")]
    public void Glob()
    {
        Assert.Matches(ParserLib.GlobToRegex("*.txt"), "a.txt");
        Assert.DoesNotMatch(ParserLib.GlobToRegex("*.txt"), "a.txt\n");
        Assert.DoesNotMatch(ParserLib.GlobToRegex("*.txt"), "dir/a.txt");
        Assert.Matches(ParserLib.GlobToRegex("[!a]?", false), "bc");
    }

    [Fact(DisplayName = "ögonblicksbilden kan sparas som JSON och läsas in igen")]
    public void SnapshotRoundTrip()
    {
        var sh = Shell.Create("ubuntu");
        sh.Functions["hej"] = ((FuncDefNode)((ListNode)ParserLib.Parse("hej() { echo hej; }")).Items[0].Node).Body;
        sh.Env["X"] = "1";
        var json = sh.SnapshotJson();
        var back = Shell.RestoreJson(json);
        Assert.NotNull(back);
        Assert.Equal("1", back!.Env["X"]);
        Assert.IsType<GroupNode>(back.Functions["hej"]);
        Assert.Equal(sh.Env.Keys, back.Env.Keys);
        Assert.Equal("dir", back.Vfs.Lookup("/home/elev", back.RootUser()).Type);
    }

    [Fact(DisplayName = "JS-hjälparna: slice, oktalt och talformat")]
    public void JsHelpers()
    {
        Assert.Equal("ell", "hello".Slice(1, -1));
        Assert.Equal("lo", "hello".Slice(-2));
        Assert.Equal(493, Js.Oct(755));
        Assert.Equal("1.5", Js.Num(1.5));
        Assert.Equal("3", Js.Num(3.0));
        Assert.Equal("ab b", ShellLib.FlattenLines("ab b"));
        Assert.Equal("for i in 1 2; do echo $i; done", ShellLib.FlattenLines("for i in 1 2\ndo echo $i\ndone"));
    }
}
