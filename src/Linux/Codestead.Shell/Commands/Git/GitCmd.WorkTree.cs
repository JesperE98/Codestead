namespace Codestead.Shell.Commands;

// The work tree: .gitignore, scanning and writing files, switching trees and pathspecs.

public static partial class GitCmd
{
    private sealed class IgnoreRule
    {
        public string Base = "";
        public required Regex Re;
        public bool Neg;
        public bool DirOnly;
        public bool Anchored;
    }

    private static readonly Regex GlobEscapeRe = new("[.+^${}()|\\]\\\\/]", RO);

    /// <summary>Translates a glob to a regular expression source (the same text the TypeScript builds).</summary>
    private static string GlobToRegex(string glob, bool slashStar)
    {
        var re = new StringBuilder();
        for (int i = 0; i < glob.Length; i++)
        {
            char ch = glob[i];
            if (ch == '*')
            {
                if (glob.CharAt(i + 1) == "*")
                {
                    i++;
                    if (glob.CharAt(i + 1) == "/")
                    {
                        i++;
                        re.Append("(?:.*/)?");
                    }
                    else re.Append(".*");
                }
                else re.Append(slashStar ? ".*" : "[^/]*");
            }
            else if (ch == '?') re.Append("[^/]");
            else if (ch == '[')
            {
                int end = i + 2 <= glob.Length ? glob.IndexOf(']', i + 2) : -1;
                if (end < 0) re.Append("\\[");
                else
                {
                    var cls = glob.Slice(i + 1, end);
                    if (cls.StartsWith('!')) cls = "^" + cls.Slice(1);
                    // JS keeps "[" literal inside a class; .NET may read "-[" as subtraction, so escape it.
                    re.Append('[').Append(cls.Replace("\\", "\\\\").Replace("[", "\\[")).Append(']');
                    i = end;
                }
            }
            else if (ch == '\\' && i + 1 < glob.Length)
            {
                // JS reads an escaped letter or digit as the character itself; .NET would see \d, \w, \a ...
                char n = glob[++i];
                re.Append(char.IsAsciiLetterOrDigit(n) ? n.ToString() : "\\" + n);
            }
            else re.Append(GlobEscapeRe.Replace(ch.ToString(), "\\$0"));
        }
        return re.ToString();
    }

    private static readonly Regex TrailingWsRe = new("(?<!\\\\)\\s+\\z", RO);

    private static List<IgnoreRule> ParseIgnore(string text, string @base)
    {
        var rules = new List<IgnoreRule>();
        foreach (var raw in text.Split('\n'))
        {
            var line = TrailingWsRe.Replace(raw, "", 1);
            if (line == "" || line.StartsWith('#')) continue;
            bool neg = false;
            if (line.StartsWith('!'))
            {
                neg = true;
                line = line.Slice(1);
            }
            else if (line.StartsWith("\\!", StringComparison.Ordinal) || line.StartsWith("\\#", StringComparison.Ordinal)) line = line.Slice(1);
            bool dirOnly = false;
            if (line.EndsWith('/'))
            {
                dirOnly = true;
                line = line.TrimEnd('/');
            }
            if (line == "") continue;
            bool anchored = line.Contains('/');
            if (line.StartsWith('/')) line = line.Slice(1);
            Regex re;
            try
            {
                re = new Regex($"^{GlobToRegex(line, false)}\\z", RO);
            }
            catch (ArgumentException)
            {
                re = new Regex("(?!)", RO);
            }
            rules.Add(new IgnoreRule { Base = @base, Re = re, Neg = neg, DirOnly = dirOnly, Anchored = anchored });
        }
        return rules;
    }

    private sealed class Ignores
    {
        private readonly List<IgnoreRule> rules;

        public Ignores(List<IgnoreRule> rules) => this.rules = rules;

        private bool Match(string path, bool isDir)
        {
            bool result = false;
            foreach (var rule in rules)
            {
                if (rule.DirOnly && !isDir) continue;
                if (rule.Base != "" && !path.StartsWith(rule.Base + "/", StringComparison.Ordinal)) continue;
                var rel = rule.Base != "" ? path.Slice(rule.Base.Length + 1) : path;
                var subject = rule.Anchored ? rel : rel.Slice(rel.LastIndexOf('/') + 1);
                if (rule.Re.IsMatch(subject)) result = !rule.Neg;
            }
            return result;
        }

        public bool Ignored(string path, bool isDir = false)
        {
            var parts = path.Split('/');
            for (int i = 1; i < parts.Length; i++)
                if (Match(string.Join("/", parts.Take(i)), true)) return true;
            return Match(path, isDir);
        }
    }

    private sealed class WorkFile
    {
        public string Content = "";
        public bool Ignored;
        public string Hash = "";
    }

    private sealed class Work
    {
        public OrderedDictionary<string, WorkFile> Files = new(StringComparer.Ordinal);
        public required Ignores Ignores;

        public WorkFile? Get(string p) => Files.TryGetValue(p, out var w) ? w : null;
    }

    /// <summary>Reads every file in the work tree (except .git) and the rules in .gitignore.</summary>
    private static Work ScanWork(Repo r)
    {
        var root = NeedWork(r);
        var g = r.G;
        var found = new List<(string Path, string Content)>();
        var ignoreFiles = new List<(string Rel, string Text)>();
        void Walk(FsNode node, string rel)
        {
            if (!VfsLib.HasPerm(node, g.User, 'r') || !VfsLib.HasPerm(node, g.User, 'x')) return;
            if (node.Children is null) return;
            foreach (var name in SortedOrdinal(node.Children.Keys))
            {
                if (name == ".git") continue;
                var child = node.Children[name];
                var p = rel != "" ? $"{rel}/{name}" : name;
                if (child.Type == "dir") Walk(child, p);
                else if (VfsLib.HasPerm(child, g.User, 'r'))
                {
                    found.Add((p, child.Content ?? ""));
                    if (name == ".gitignore") ignoreFiles.Add((rel, child.Content ?? ""));
                }
            }
        }
        Walk(g.Sh.Vfs.Lookup(root, g.User), "");
        ignoreFiles.StableSort((a, b) => (a.Rel != "" ? a.Rel.Split('/').Length : 0) - (b.Rel != "" ? b.Rel.Split('/').Length : 0));
        var rules = ParseIgnore(ReadText(g, Gpath(r, "info/exclude")) ?? "", "");
        foreach (var (b, text) in ignoreFiles) rules.AddRange(ParseIgnore(text, b));
        var ignores = new Ignores(rules);
        var work = new Work { Ignores = ignores };
        foreach (var (p, content) in found)
        {
            var hash = BlobHash(content);
            r.Blobs[hash] = content;
            work.Files[p] = new WorkFile { Content = content, Hash = hash, Ignored = ignores.Ignored(p) };
        }
        return work;
    }

    private static void WriteWorkFile(Repo r, string path, string content)
    {
        var abs = Join(NeedWork(r), path);
        var node = r.G.Sh.Vfs.TryLookup(abs, r.G.User);
        if (node?.Type == "dir") throw new FsError("EISDIR");
        WriteText(r.G, abs, content);
    }

    private static void RemoveWorkFile(Repo r, string path)
    {
        var root = NeedWork(r);
        var abs = Join(root, path);
        RemoveFile(r.G, abs);
        PruneDirs(r.G, VfsLib.Dirname(abs), root);
    }

    private sealed class Spec
    {
        public string Raw = "";
        public string Rel = "";
        public Regex? Glob;
    }

    private static readonly Regex GlobCharsRe = new("[*?\\[]", RO);

    private static Spec ToSpec(Repo r, string raw)
    {
        var root = NeedWork(r);
        var abs = VfsLib.ResolvePath(r.G.Cwd, raw == "" ? "." : raw);
        string rel;
        if (abs == root) rel = "";
        else if (abs.StartsWith(root + "/", StringComparison.Ordinal)) rel = abs.Slice(root.Length + 1);
        else throw Fatal($"{raw}: '{raw}' is outside repository at '{root}'");
        Regex? glob = null;
        if (GlobCharsRe.IsMatch(rel))
        {
            try
            {
                glob = new Regex($"^{GlobToRegex(rel, true)}(/.*)?\\z", RO);
            }
            catch (ArgumentException)
            {
                glob = new Regex("(?!)", RO);
            }
        }
        return new Spec { Raw = raw, Rel = rel, Glob = glob };
    }

    private static bool SpecMatch(Spec s, string path) =>
        s.Rel == "" || path == s.Rel || path.StartsWith(s.Rel + "/", StringComparison.Ordinal) || (s.Glob?.IsMatch(path) ?? false);

    /// <summary>How the path in the repository is shown, relative to the current directory.</summary>
    private static string Show(Repo r, string path)
    {
        var root = NeedWork(r);
        bool dir = path.EndsWith('/');
        var p = RelPath(r.G.Cwd, Join(root, dir ? path[..^1] : path));
        return dir ? p + "/" : p;
    }

    /// <summary>
    /// Makes the work tree and the index equal to the tree `target` (from the HEAD tree `from`).
    /// Local changes in files that are not affected are carried along. If a change would be
    /// overwritten, everything is aborted with the same error as real git.
    /// </summary>
    private static Index SwitchTree(Repo r, JsMap<string> from, JsMap<string> target, string verb, bool force = false, List<string>? alsoCheck = null)
    {
        alsoCheck ??= new List<string>();
        var work = ScanWork(r);
        var idx = ReadIndex(r);
        var paths = SortedOrdinal(Union(from.Keys, target.Keys).Where(p => from[p] != target[p]));
        var local = new List<string>();
        var untracked = new List<string>();
        if (!force)
        {
            foreach (var p in SortedOrdinal(Union(paths, alsoCheck)))
            {
                var w = work.Get(p);
                if (idx.Entries.Has(p) || from.Has(p))
                {
                    bool indexDirty = idx.Entries[p] != from[p] || idx.Unmerged.Has(p);
                    bool workDirty = w is not null ? w.Hash != idx.Entries[p] : idx.Entries.Has(p);
                    bool alreadyTarget = idx.Entries[p] == target[p] && (w is not null ? w.Hash == target[p] : target[p] is null);
                    if ((indexDirty || workDirty) && !alreadyTarget) local.Add(p);
                }
                else if (w is not null && !w.Ignored && w.Hash != target[p]) untracked.Add(p);
            }
        }
        if (local.Count > 0)
        {
            var what = verb == "checkout" ? "switch branches" : "merge";
            throw Fail(
                $"error: Your local changes to the following files would be overwritten by {verb}:\n{string.Concat(local.Select(p => $"\t{Show(r, p)}\n"))}Please commit your changes or stash them before you {what}.\nAborting");
        }
        if (untracked.Count > 0)
        {
            throw Fail(
                $"error: The following untracked working tree files would be overwritten by {verb}:\n{string.Concat(untracked.Select(p => $"\t{Show(r, p)}\n"))}Please move or remove them before you {(verb == "checkout" ? "switch branches" : "merge")}.\nAborting");
        }
        foreach (var p in paths)
        {
            if (target[p] is null)
            {
                RemoveWorkFile(r, p);
                idx.Entries.Delete(p);
            }
            else
            {
                WriteWorkFile(r, p, ReadBlob(r, target[p]!));
                idx.Entries[p] = target[p];
            }
            idx.Unmerged.Delete(p);
        }
        if (force)
        {
            foreach (var p in idx.Entries.Keys)
            {
                if (!target.Has(p))
                {
                    RemoveWorkFile(r, p);
                    idx.Entries.Delete(p);
                }
                else if (work.Get(p)?.Hash != target[p] || idx.Entries[p] != target[p])
                {
                    WriteWorkFile(r, p, ReadBlob(r, target[p]!));
                    idx.Entries[p] = target[p];
                }
            }
            foreach (var p in target.Keys)
            {
                if (!idx.Entries.Has(p))
                {
                    WriteWorkFile(r, p, ReadBlob(r, target[p]!));
                    idx.Entries[p] = target[p];
                }
            }
            idx.Unmerged = new JsMap<Unmerged>();
        }
        WriteIndex(r, idx);
        return idx;
    }
}
