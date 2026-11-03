using Codestead.Learning.Game;
using Codestead.Shell.Commands;

namespace Codestead.Content.Game;

/// <summary>What a command line contained: command names, pipes, redirections, loops … (for statistics and achievements).</summary>
/// <remarks><see cref="CommandFacts.Names"/> are the commands the simulator knows, also those run through sudo, time,
/// xargs …; <see cref="CommandFacts.FirstWords"/> the first word of each simple command, known or not (e.g. "sl", ":q").</remarks>
public sealed class CommandInfo : CommandFacts
{
    /// <summary>The longest pipeline (1 = no pipe).</summary>
    public int MaxPipeline { get; private set; } = 1;
    public bool HasRedirect { get; private set; }
    public bool HasLoop { get; private set; }
    public bool UsesSudo { get; private set; }
    public bool IsScriptRun { get; private set; }
    /// <summary>The page read with man, or null.</summary>
    public string? ManPage { get; private set; }
    /// <summary>The words of every simple command (after leading VAR=value).</summary>
    public List<List<string>> Commands { get; } = new();

    /// <summary>The terminal's own counters: man pages, pipes, redirections, loops, scripts and sudo.</summary>
    public override void CountInto(GameStats s)
    {
        if (ManPage is { } page && !s.ManPages.Contains(page)) s.ManPages.Add(page);
        if (MaxPipeline > 1) s.Pipes++;
        s.LongestPipe = Math.Max(s.LongestPipe, MaxPipeline);
        if (HasRedirect) s.Redirects++;
        if (HasLoop) s.Loops++;
        if (IsScriptRun) s.Scripts++;
        if (UsesSudo) s.Sudo++;
    }

    private static readonly HashSet<string> Wrappers = new(StringComparer.Ordinal) { "sudo", "time", "nohup", "env", "xargs", "watch", "exec", "command", "builtin" };
    private static readonly HashSet<string> OutputRedirects = new(StringComparer.Ordinal) { ">", ">>", "&>", "2>", "2>>", "<" };

    /// <summary>Analyses a command line and its result. A line that does not parse gives what the text alone shows.</summary>
    public static CommandInfo Analyze(string line, string output, int exitCode)
    {
        var info = new CommandInfo { Line = line.Trim(), Output = UtilCmd.StripAnsi(output), ExitCode = exitCode };
        try
        {
            info.Walk(ParserLib.Parse(line));
        }
        catch (Exception e) when (e is ParseError or ArgumentException or InvalidOperationException)
        {
            var first = info.Line.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
            if (first is not null) info.FirstWords.Add(first);
        }
        return info;
    }

    private static bool IsAssignment(string w) =>
        w.Length > 1 && w.IndexOf('=') is > 0 and var eq && w[..eq].All(c => char.IsLetterOrDigit(c) || c == '_') && !char.IsDigit(w[0]);

    private void Walk(Node? node)
    {
        switch (node)
        {
            case null:
                return;
            case SimpleNode s:
                Simple(s);
                return;
            case PipelineNode p:
                MaxPipeline = Math.Max(MaxPipeline, p.Commands.Count);
                foreach (var c in p.Commands) Walk(c);
                return;
            case AndOrNode a:
                Walk(a.First);
                foreach (var r in a.Rest) Walk(r.Node);
                return;
            case ListNode l:
                foreach (var i in l.Items) Walk(i.Node);
                return;
            case IfNode i:
                foreach (var c in i.Clauses)
                {
                    Walk(c.Cond);
                    Walk(c.Body);
                }
                Walk(i.ElseBody);
                Redirects(i.Redirects);
                return;
            case ForNode f:
                HasLoop = true;
                Walk(f.Body);
                Redirects(f.Redirects);
                return;
            case CForNode cf:
                HasLoop = true;
                Walk(cf.Body);
                Redirects(cf.Redirects);
                return;
            case WhileNode w:
                HasLoop = true;
                Walk(w.Cond);
                Walk(w.Body);
                Redirects(w.Redirects);
                return;
            case CaseNode cs:
                foreach (var item in cs.Items) Walk(item.Body);
                Redirects(cs.Redirects);
                return;
            case GroupNode g:
                Walk(g.Body);
                Redirects(g.Redirects);
                return;
            case FuncDefNode fd:
                Walk(fd.Body);
                return;
        }
    }

    private void Redirects(List<Redirect> redirects)
    {
        if (redirects.Any(r => OutputRedirects.Contains(r.Op))) HasRedirect = true;
    }

    private void Simple(SimpleNode s)
    {
        Redirects(s.Redirects);
        var words = s.Words.Select(w => w.Raw).SkipWhile(IsAssignment).ToList();
        if (words.Count == 0) return;
        Commands.Add(words);
        FirstWords.Add(words[0]);
        int i = 0;
        while (i < words.Count)
        {
            var name = words[i];
            if (IndexCmd.Commands.ContainsKey(name) && !Names.Contains(name)) Names.Add(name);
            if (name == "sudo") UsesSudo = true;
            if (name == "man" && i + 1 < words.Count && !words[i + 1].StartsWith('-')) ManPage = words[^1];
            if (name.StartsWith("./", StringComparison.Ordinal) || ((name is "bash" or "sh" or "zsh") && i + 1 < words.Count && words[i + 1].EndsWith(".sh", StringComparison.Ordinal)))
                IsScriptRun = true;
            if (!Wrappers.Contains(name)) break;
            // The command after sudo/time/env …: skip its options (and the value of sudo -u USER).
            i++;
            while (i < words.Count && (words[i].StartsWith('-') || IsAssignment(words[i])))
            {
                if (name == "sudo" && words[i] is "-u" or "-g") i++;
                i++;
            }
        }
    }
}
