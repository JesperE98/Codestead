using Codestead.Shell.Commands;

namespace Codestead.Shell.Tests;

// Port of src/shell/textproc.test.ts
public class TextprocTests
{
    private static int NonEmptyLines(string s) => s.Split('\n').Count(l => l != "");

    public static TheoryData<string> DistroIds => new(DistrosLib.Distros.Select(d => d.Id));

    // describe('paket')

    [Theory(DisplayName = "sed, tr och awk finns från start i %s")]
    [MemberData(nameof(DistroIds))]
    public void SedTrAwkInstalled(string id)
    {
        var t = new TestShell(id);
        Assert.Equal("/usr/bin/sed\n/usr/bin/tr\n/usr/bin/awk\n", t.Run("which sed tr awk").Out);
    }

    // describe('tr')

    [Fact(DisplayName = "byter tecken, intervall och klasser")]
    public void TrTranslate()
    {
        var t = new TestShell();
        Assert.Equal("HEJ VäRLDEN\n", t.Run("echo hej världen | tr a-z A-Z").Out);
        Assert.Equal("HEJ\n", t.Run("echo Hej | tr '[:lower:]' '[:upper:]'").Out);
        Assert.Equal("a\nb\nc\n", t.Run("echo 'a:b:c' | tr ':' '\\n'").Out);
        Assert.Equal("xxx\n", t.Run("echo abc | tr abc x").Out);
        Assert.Equal("hippo\n", t.Run("echo hello | tr el ip").Out);
    }

    [Fact(DisplayName = "-d, -s och -c")]
    public void TrDeleteSqueezeComplement()
    {
        var t = new TestShell();
        Assert.Equal("abcdef\n", t.Run("echo 'abc123def' | tr -d 0-9").Out);
        Assert.Equal("a b c\n", t.Run("echo 'a   b    c' | tr -s ' '").Out);
        Assert.Equal("123", t.Run("echo 'abc123' | tr -cd '[:digit:]'").Out);
        Assert.Equal("ABC\n", t.Run("echo 'aabbcc' | tr -s a-z A-Z").Out);
        Assert.Equal("1 2\n", t.Run("echo 'x1  2' | tr -ds x ' '").Out);
    }

    [Fact(DisplayName = "läser bara stdin och ger fel som GNU tr")]
    public void TrErrors()
    {
        var t = new TestShell();
        Assert.Contains("tr: extra operand 'dokument/frukter.txt'", t.Run("tr a-z A-Z dokument/frukter.txt").Out);
        Assert.Contains("tr: missing operand", t.Run("tr").Out);
        Assert.Contains("tr: missing operand after 'a'", t.Run("echo x | tr a").Out);
        Assert.Contains("reverse collating sequence order", t.Run("echo x | tr z-a A").Out);
        Assert.Contains("invalid character class 'foo'", t.Run("echo x | tr '[:foo:]' a").Out);
        Assert.Contains("BANAN\n", t.Run("tr a-z A-Z < dokument/frukter.txt").Out);
    }

    // describe('sed')

    [Fact(DisplayName = "s med flaggor, avgränsare, & och grupper")]
    public void SedSubstitute()
    {
        var t = new TestShell();
        Assert.Equal("b a a\n", t.Run("echo 'a a a' | sed 's/a/b/'").Out);
        Assert.Equal("b b b\n", t.Run("echo 'a a a' | sed 's/a/b/g'").Out);
        Assert.Equal("a b a\n", t.Run("echo 'a a a' | sed 's/a/b/2'").Out);
        Assert.Equal("a b b\n", t.Run("echo 'a a a' | sed 's/a/b/2g'").Out);
        Assert.Equal("x x\n", t.Run("echo 'Hej HEJ' | sed 's/hej/x/gI'").Out);
        Assert.Equal("/opt/bin\n", t.Run("echo /usr/bin | sed 's|/usr|/opt|'").Out);
        Assert.Equal("[hej]\n", t.Run("echo hej | sed 's/.*/[&]/'").Out);
        Assert.Equal("Svensson, Anna\n", t.Run("echo 'Anna Svensson' | sed 's/\\(.*\\) \\(.*\\)/\\2, \\1/'").Out);
        Assert.Equal("Svensson, Anna\n", t.Run("echo 'Anna Svensson' | sed -E 's/(.*) (.*)/\\2, \\1/'").Out);
        Assert.Equal("aBc\n", t.Run("echo 'abc' | sed 's/b/\\U&/'").Out);
        Assert.Equal("z+y\n", t.Run("echo 'x+y' | sed 's/x\\+/z/'").Out);
        Assert.Equal("b\n", t.Run("echo 'aaa' | sed 's/a\\+/b/'").Out);
        Assert.Equal("####\n", t.Run("echo '2026' | sed 's/[[:digit:]]/#/g'").Out);
    }

    [Fact(DisplayName = "d, p, q, = och adresser")]
    public void SedCommandsAndAddresses()
    {
        var t = new TestShell();
        const string log = "dokument/server.log";
        Assert.Contains("Reading configuration", t.Run($"sed -n '2p' {log}").Out);
        Assert.Equal(3, NonEmptyLines(t.Run($"sed -n '2,4p' {log}").Out));
        Assert.Contains("Rotating", t.Run($"sed -n '$p' {log}").Out);
        Assert.Equal(6, NonEmptyLines(t.Run($"sed '/INFO/d' {log}").Out));
        Assert.Equal(3, NonEmptyLines(t.Run($"sed '/ERROR/!d' {log}").Out));
        Assert.Equal(4 + 3, NonEmptyLines(t.Run($"sed -n '/WARN/,/ERROR/p' {log}").Out));
        Assert.Equal(3, NonEmptyLines(t.Run($"sed 3q {log}").Out));
        Assert.Equal("15\n", t.Run($"sed -n '$=' {log}").Out);
        Assert.Equal("3\n8\n", t.Run("sed -n \"/kiwi/=\" dokument/frukter.txt").Out);
        Assert.Equal("1\n4\n5\n", t.Run("seq 5 | sed '2,3d'").Out);
        Assert.Equal("4\n", t.Run("seq 5 | sed -n '4,2p'").Out);
        Assert.Equal("1 x\n2\n3 x\n", t.Run("seq 3 | sed '2!s/$/ x/'").Out);
        Assert.Equal("1\n3\n5\n", t.Run("seq 6 | sed -n '1~2p'").Out);
    }

    [Fact(DisplayName = "flera skript med ; och -e, samt y, a, i och c")]
    public void SedScripts()
    {
        var t = new TestShell();
        Assert.Equal("AbC\n", t.Run("echo abc | sed 's/a/A/; s/c/C/'").Out);
        Assert.Equal("AbC\n", t.Run("echo abc | sed -e 's/a/A/' -e 's/c/C/'").Out);
        Assert.Equal("xyz\n", t.Run("echo abc | sed 'y/abc/xyz/'").Out);
        Assert.Equal("1\nefter\n2\n", t.Run("seq 2 | sed '1a efter'").Out);
        Assert.Equal("1\nföre\n2\n", t.Run("seq 2 | sed '2i före'").Out);
        Assert.Equal("1\nny\n3\n", t.Run("seq 3 | sed '2c ny'").Out);
    }

    [Fact(DisplayName = "-i ändrar filen på plats och kräver skrivrättighet")]
    public void SedInPlace()
    {
        var t = new TestShell();
        Assert.Equal("", t.Run("sed -i 's/kiwi/KIWI/g' dokument/frukter.txt").Out);
        Assert.Contains("KIWI\n", t.Content("~/dokument/frukter.txt"));
        Assert.DoesNotContain("kiwi", t.Content("~/dokument/frukter.txt"));
        t.Run("sed -i.bak '1d' dokument/frukter.txt");
        Assert.True(t.Content("~/dokument/frukter.txt.bak")?.StartsWith("äpple\n", StringComparison.Ordinal) == true);
        Assert.True(t.Content("~/dokument/frukter.txt")?.StartsWith("banan\n", StringComparison.Ordinal) == true);
        var r = t.Run("sed -i 's/localhost/lokal/' /etc/hosts");
        Assert.Contains("Permission denied", r.Out);
        Assert.NotEqual(0, r.ExitCode);
        Assert.Equal(0, t.Run("sudo sed -i 's/localhost/lokal/' /etc/hosts").ExitCode);
        Assert.Contains("lokal", t.Content("/etc/hosts"));
        Assert.Equal("sed: no input files\n", t.Run("sed -i 's/a/b/'").Out);
    }

    [Fact(DisplayName = "felmeddelanden som GNU sed")]
    public void SedErrors()
    {
        var t = new TestShell();
        Assert.Equal("sed: -e expression #1, char 1: unknown command: `k'\n", t.Run("echo x | sed 'k'").Out);
        Assert.Contains("unterminated `s' command", t.Run("echo x | sed 's/a/b'").Out);
        Assert.Contains("unknown option to `s'", t.Run("echo x | sed 's/a/b/z'").Out);
        Assert.Contains("-e expression #2", t.Run("echo x | sed -e p -e 'k'").Out);
        Assert.Contains("invalid reference \\1 on `s' command's RHS", t.Run("echo x | sed 's/a/\\1/'").Out);
        Assert.Equal("sed: can't read finnsinte.txt: No such file or directory\n", t.Run("sed p finnsinte.txt").Out);
        var r = t.Run("echo x | sed 'h'");
        Assert.Contains("stöds inte", r.Out);
        Assert.Equal(1, r.ExitCode);
        Assert.Equal(1, t.Run("sed").ExitCode);
    }

    // describe('awk')

    [Fact(DisplayName = "fält, -F och $NF")]
    public void AwkFields()
    {
        var t = new TestShell();
        Assert.Equal("b\n", t.Run("echo 'a b  c' | awk '{print $2}'").Out);
        Assert.Equal("c 3\n", t.Run("echo 'a b  c' | awk '{print $NF, NF}'").Out);
        Assert.Equal("b\n", t.Run("echo 'a b c' | awk '{print $(NF-1)}'").Out);
        Assert.Contains("elev /bin/bash\n", t.Run("awk -F: '{print $1, $7}' /etc/passwd").Out);
        Assert.Equal("nobody\nelev\n", t.Run("awk -F: '$3 >= 1000 {print $1}' /etc/passwd").Out);
        Assert.Equal("ba\n", t.Run("echo 'a,b' | awk -F, '{print $2 $1}'").Out);
        Assert.Equal("a-b\n", t.Run("echo 'a b' | awk '{print $1 \"-\" $2}'").Out);
        Assert.Equal("a-b\n", t.Run("echo 'a b' | awk 'BEGIN {OFS=\"-\"} {$1=$1; print}'").Out);
        Assert.Equal("a X c\n3\n", t.Run("echo 'a b c' | awk '{$2=\"X\"; print; print NF}'").Out);
    }

    [Fact(DisplayName = "mönster: regex, jämförelser, NR och BEGIN/END")]
    public void AwkPatterns()
    {
        var t = new TestShell();
        const string csv = "dokument/betyg.csv";
        Assert.Equal("590\n", t.Run($"awk -F, 'NR > 1 {{s += $3}} END {{print s}}' {csv}").Out);
        Assert.Equal("73.75\n", t.Run($"awk -F, 'NR > 1 {{s += $3; n++}} END {{print s / n}}' {csv}").Out);
        Assert.Equal("Cleo\nFarid\n", t.Run($"awk -F, 'NR > 1 && $3 >= 90 {{print $1}}' {csv}").Out);
        Assert.Equal("Alva\nBilal\nFarid\n", t.Run($"awk -F, '$2 == \"matte\" {{print $1}}' {csv}").Out);
        Assert.Equal("Alva\nBilal\nCleo\n", t.Run($"awk -F, '$1 ~ /^[A-C]/ {{print $1}}' {csv}").Out);
        // The header row is compared as text: "poäng" > "70".
        Assert.Equal("namn", t.Run($"awk -F, '$3 > 70 {{print $1}}' {csv}").Out.Split('\n')[0]);
        Assert.Equal("3\n", t.Run("awk '/ERROR/ {n++} END {print n}' dokument/server.log").Out);
        Assert.Equal(6, NonEmptyLines(t.Run("awk '!/INFO/' dokument/server.log").Out));
        Assert.Equal("10\n", t.Run("awk 'END {print NR}' dokument/frukter.txt").Out);
        Assert.Equal("3 3.5 1024 1\n", t.Run("awk 'BEGIN {print 1 + 2, 7 / 2, 2 ^ 10, 10 % 3}'").Out);
        Assert.Equal("Hej Elev\n", t.Run("awk -v namn=Elev 'BEGIN {print \"Hej\", namn}'").Out);
        Assert.Equal("6\n6 5\n", t.Run("awk 'BEGIN {x = 1; x += 4; x++; print x; print x--, x}'").Out);
    }

    [Fact(DisplayName = "printf och inbyggda funktioner")]
    public void AwkPrintfAndBuiltins()
    {
        var t = new TestShell();
        Assert.Equal("ab    |  3.1|007|ff|%\n", t.Run("awk 'BEGIN {printf \"%-6s|%5.1f|%03d|%x|%%\\n\", \"ab\", 3.14159, 7, 255}'").Out);
        Assert.Equal("x=42\n", t.Run("awk 'BEGIN {printf(\"%s=%d\\n\", \"x\", 42.9)}'").Out);
        Assert.Equal("äPPLE 5 5\n", t.Run("echo äpple | awk '{print toupper($0), length($0), length()}'").Out);
        // Arch and Fedora have GNU awk, which handles å, ä and ö.
        Assert.Equal("ÄPPLE\n", new TestShell("fedora").Run("echo äpple | awk '{print toupper($0)}'").Out);
        Assert.Equal("ell 3 abc 3\n", t.Run("awk 'BEGIN {print substr(\"hello\", 2, 3), index(\"hello\", \"l\"), tolower(\"ABC\"), int(3.9)}'").Out);
        Assert.Equal("3 c\n", t.Run("echo 'a-b-c' | awk '{n = split($0, p, \"-\"); print n, p[3]}'").Out);
        Assert.Equal("bbb\n", t.Run("echo 'aaa' | awk '{gsub(/a/, \"b\"); print}'").Out);
        Assert.Equal("[a]aa\n", t.Run("echo 'aaa' | awk '{sub(/a/, \"[&]\"); print}'").Out);
        Assert.Equal("    x|\n", t.Run("awk 'BEGIN {print sprintf(\"%5s\", \"x\") \"|\"}'").Out);
    }

    [Fact(DisplayName = "if, loopar och arrayer")]
    public void AwkControlFlowAndArrays()
    {
        var t = new TestShell();
        Assert.Equal("3 2 6\n", t.Run("awk '{c[$1]++} END {print c[\"äpple\"], c[\"kiwi\"], length(c)}' dokument/frukter.txt").Out);
        Assert.Equal("123\n", t.Run("awk 'BEGIN {for (i = 1; i <= 3; i++) s = s i; print s}'").Out);
        Assert.Equal("3\n", t.Run("awk 'BEGIN {i = 0; while (i < 3) {i++}; print i}'").Out);
        Assert.Equal("ja\n", t.Run("awk 'BEGIN {if (2 > 1) print \"ja\"; else print \"nej\"}'").Out);
        Assert.Equal("stor\n", t.Run("awk 'BEGIN {x = 5 > 3 ? \"stor\" : \"liten\"; print x}'").Out);
        Assert.Equal("1\n2\n4\n5\n", t.Run("seq 5 | awk '$1 == 3 {next} {print}'").Out);
        Assert.Equal("1\n2\n", t.Run("seq 5 | awk '$1 == 3 {exit} {print}'").Out);
        Assert.Equal(
            "matte 246\nsvenska 241\nengelska 103\n",
            t.Run("awk -F, 'NR > 1 {s[$2] += $3} END {for (k in s) print k, s[k]}' dokument/betyg.csv").Out);
    }

    [Fact(DisplayName = "fel")]
    public void AwkErrors()
    {
        var t = new TestShell();
        var r = t.Run("awk '{print $1'");
        Assert.Contains("awk: cmd. line:1: {print $1\n", r.Out);
        Assert.Contains("^ unexpected newline or end of string", r.Out);
        Assert.Contains("simulatorn", r.Out);
        Assert.NotEqual(0, r.ExitCode);
        Assert.Contains("omdirigering av utdata", t.Run("awk '{print $1 > \"fil\"}'").Out);
        Assert.Contains("egna funktioner", t.Run("awk 'function f(x) {return x}'").Out);
        Assert.Contains("getline stöds inte", t.Run("awk '{getline}'").Out);
        Assert.Contains("fatal: division by zero attempted", t.Run("awk 'BEGIN {print 1/0}'").Out);
        Assert.Contains("cannot open file `finnsinte' for reading: No such file or directory", t.Run("awk '{print}' finnsinte").Out);
        Assert.Contains("oändlig loop", t.Run("awk 'BEGIN {while (1) x++}'").Out);
        Assert.Equal(2, t.Run("awk").ExitCode);
    }

    [Fact(DisplayName = "formatering av tal")]
    public void NumberFormatting()
    {
        Assert.Equal("3.14159", AwkCmd.FormatG(3.14159265));
        Assert.Equal("0.3", AwkCmd.FormatG(0.1 + 0.2));
        Assert.Equal("1e-07", AwkCmd.FormatG(1e-7));
        Assert.Equal("1.23457e+08", AwkCmd.FormatG(123456789));
        Assert.Equal(" 2.50|3   |1.234500e+04", AwkCmd.AwkSprintf("%5.2f|%-4d|%e", new List<object> { 2.5, 3.0, 12345.0 }));
    }
}
