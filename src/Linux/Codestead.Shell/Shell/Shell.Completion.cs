using Codestead.Shell.Commands;

namespace Codestead.Shell;

// Shell: tab completion of commands and file names.

public partial class Shell
{
    // ---------- Tab completion ----------

    /// <summary>Every command that can run right now (builtins + functions + executable files in PATH).</summary>
    public List<string> AvailableCommands()
    {
        var names = new HashSet<string>(IndexCmd.Commands.Values.Where(c => c.Builtin).Select(c => c.Name), StringComparer.Ordinal);
        var user = CurrentUser();
        foreach (var dir in (Env.TryGetValue("PATH", out var p) ? p : "").Split(':'))
        {
            var node = dir != "" ? Vfs.TryLookup(dir, user) : null;
            if (node?.Type == "dir")
            {
                foreach (var (n, child) in node.Children!)
                {
                    var target = child.Type == "link" ? Vfs.TryLookup($"{dir}/{n}", user) : child;
                    if (target?.Type == "file" && VfsLib.HasPerm(target, user, 'x')) names.Add(n);
                }
            }
        }
        foreach (var a in Aliases.Keys) names.Add(a);
        foreach (var f in Functions.Keys) names.Add(f);
        return names.ToList().SortJs();
    }

    private static readonly Regex CompleteWordRe = new(@"(^|[\s|;&]+)([^\s|;&]*)\z", RegexOptions.CultureInvariant);
    private static readonly Regex CompleteCmdPosRe = new(@"(^|[|;&]\s*)\z", RegexOptions.CultureInvariant);
    private static readonly Regex CompleteSudoRe = new(@"(^|\s)sudo\s+\z", RegexOptions.CultureInvariant);

    public (string Line, List<string> Options) Complete(string line)
    {
        var m = CompleteWordRe.Match(line);
        var word = m.Groups[2].Value;
        var before = line[..(line.Length - word.Length)];
        bool isCommand = CompleteCmdPosRe.IsMatch(before.TrimEnd()) || before.Trim() == "" || CompleteSudoRe.IsMatch(before);

        List<string> candidates;
        var prefix = word;
        var dirPart = "";
        if (isCommand && !word.Contains('/'))
        {
            candidates = AvailableCommands().Where(c => c.StartsWith(word, StringComparison.Ordinal)).ToList();
        }
        else
        {
            int slash = word.LastIndexOf('/');
            dirPart = slash >= 0 ? word[..(slash + 1)] : "";
            prefix = word[(slash + 1)..];
            var dirPath = dirPart != "" ? dirPart : ".";
            if (dirPath == "~/" || dirPath.StartsWith("~/", StringComparison.Ordinal)) dirPath = Home + dirPath[1..];
            var node = Vfs.TryLookup(Resolve(dirPath), CurrentUser());
            if (node is null || node.Type != "dir") return (line, new List<string>());
            candidates = node.Children!
                .Where(kv => kv.Key.StartsWith(prefix, StringComparison.Ordinal) && (prefix.StartsWith('.') || !kv.Key.StartsWith('.')))
                .Select(kv => kv.Value.Type == "dir" || (kv.Value.Type == "link" && Vfs.TryLookup(Resolve($"{dirPath.TrimEnd('/')}/{kv.Key}"), CurrentUser())?.Type == "dir") ? $"{kv.Key}/" : kv.Key)
                .ToList()
                .SortJs();
        }
        if (candidates.Count == 0) return (line, new List<string>());
        if (candidates.Count == 1)
        {
            var c = candidates[0];
            return (before + dirPart + c + (c.EndsWith('/') ? "" : " "), new List<string>());
        }
        var common = candidates[0];
        foreach (var c in candidates)
        {
            while (!c.StartsWith(common, StringComparison.Ordinal)) common = common[..^1];
        }
        return (before + dirPart + common, common.Length > prefix.Length ? new List<string>() : candidates);
    }
}
