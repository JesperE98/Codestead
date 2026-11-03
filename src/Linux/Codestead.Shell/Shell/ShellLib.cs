namespace Codestead.Shell;

// Static helpers for the shell: flattening multi-line code, node to text and sleep detection.

public static partial class ShellLib
{
    public const string Dim = Shell.Dim;
    public const string Reset = Shell.Reset;

    private static readonly Regex JoinerEndRe = new(@"(\bdo|\bthen|\belse|\{|\||&&|\|\||\bin|;)\z", RegexOptions.CultureInvariant);
    private static readonly Regex JoinerStartRe = new(@"^(;|\))", RegexOptions.CultureInvariant);

    /// <summary>
    /// Turns multi-line code into one line for the history, like bash does:
    /// "for i in 1 2\ndo echo $i\ndone" becomes "for i in 1 2; do echo $i; done".
    /// </summary>
    public static string FlattenLines(string text)
    {
        var lines = text.Split('\n').Select(l => l.Trim()).Where(l => l != "").ToList();
        if (lines.Count <= 1) return text;
        var acc = lines[0];
        foreach (var l in lines.Skip(1))
        {
            var joiner = JoinerEndRe.IsMatch(acc) || JoinerStartRe.IsMatch(l) ? " " : "; ";
            acc = acc + joiner + l;
        }
        return acc;
    }

    /// <summary>Approximate source code for a command (shown by jobs and ps).</summary>
    public static string NodeToString(Node node) => node switch
    {
        SimpleNode s => string.Join(" ", s.Words.Select(w => w.Raw).Concat(s.Redirects.Select(r => r.Op + (r.Target is not null ? " " + r.Target.Raw : "")))),
        PipelineNode p => (p.Negate ? "! " : "") + string.Join(" | ", p.Commands.Select(NodeToString)),
        AndOrNode a => string.Join(" ", new[] { NodeToString(a.First) }.Concat(a.Rest.Select(r => $"{r.Op} {NodeToString(r.Node)}"))),
        ListNode l => string.Join("; ", l.Items.Select(i => NodeToString(i.Node) + (i.Background ? " &" : ""))),
        FuncDefNode f => $"{f.Name}()",
        _ => node.Type,
    };

    private static readonly Regex SleepRe = new(@"^([0-9]+(?:\.[0-9]+)?)([smh]?)\z", RegexOptions.CultureInvariant);

    /// <summary>If the node is `sleep N`: the number of seconds, otherwise null.</summary>
    public static double? SleepSeconds(Node node)
    {
        // "nohup sleep 60 &" is a sleep in the background too.
        int skip = node is SimpleNode n0 && n0.Words.Count == 3 && n0.Words[0].Raw == "nohup" ? 1 : 0;
        if (node is not SimpleNode s || s.Words.Count != 2 + skip || s.Words[skip].Raw != "sleep") return null;
        var m = SleepRe.Match(s.Words[1 + skip].Raw);
        if (!m.Success) return null;
        var n = double.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
        return n * (m.Groups[2].Value == "m" ? 60 : m.Groups[2].Value == "h" ? 3600 : 1);
    }
}
