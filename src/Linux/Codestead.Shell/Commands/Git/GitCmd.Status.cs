namespace Codestead.Shell.Commands;

// Status: what has changed between HEAD, the index and the work tree, how it is printed, and git status.

public static partial class GitCmd
{
    private sealed record UnmergedRow(string Path, string Code, string Label);

    private sealed class StatusInfo
    {
        public required Head Head;
        public required JsMap<string> HeadTree;
        public required Index Index;
        public required Work Work;
        public required List<Change> Staged;
        public required List<Change> Unstaged;
        public required List<UnmergedRow> Unmerged;
        public required List<string> Untracked;
        public required bool Merging;
    }

    private static List<string> CollapseUntracked(List<string> paths, List<string> tracked)
    {
        var trackedDirs = new HashSet<string>(StringComparer.Ordinal);
        foreach (var t in tracked)
        {
            var parts = t.Split('/');
            for (int i = 1; i < parts.Length; i++) trackedDirs.Add(string.Join("/", parts.Take(i)));
        }
        var units = new List<string>();
        foreach (var p in paths)
        {
            var parts = p.Split('/');
            var unit = p;
            for (int i = 1; i < parts.Length; i++)
            {
                var d = string.Join("/", parts.Take(i));
                if (!trackedDirs.Contains(d))
                {
                    unit = d + "/";
                    break;
                }
            }
            units.Add(unit);
        }
        return SortedOrdinal(Union(units));
    }

    private static StatusInfo ComputeStatus(Repo r, bool all = false)
    {
        var head = ReadHead(r);
        var headTree = CommitTree(r, head.Hash);
        var index = ReadIndex(r);
        var work = ScanWork(r);
        var clean = new JsMap<string>();
        foreach (var p in index.Entries.Keys)
            if (!index.Unmerged.Has(p)) clean[p] = index.Entries[p];
        var headClean = new JsMap<string>();
        foreach (var p in headTree.Keys)
            if (!index.Unmerged.Has(p)) headClean[p] = headTree[p];
        var staged = TreeChanges(headClean, clean);
        var unstaged = new List<Change>();
        foreach (var p in clean.Keys)
        {
            var h = clean[p];
            var w = work.Get(p);
            if (w is null) unstaged.Add(new Change { Status = 'D', Path = p, OldHash = h });
            else if (w.Hash != h) unstaged.Add(new Change { Status = 'M', Path = p, OldHash = h, NewHash = w.Hash });
        }
        unstaged.StableSort((a, b) => string.CompareOrdinal(a.Path, b.Path));
        var unmerged = index.Unmerged.Keys
            .Select(path =>
            {
                var u = index.Unmerged[path]!;
                if (string.IsNullOrEmpty(u.Base) && !string.IsNullOrEmpty(u.Ours) && !string.IsNullOrEmpty(u.Theirs)) return new UnmergedRow(path, "AA", "both added:");
                if (string.IsNullOrEmpty(u.Ours)) return new UnmergedRow(path, "DU", "deleted by us:");
                if (string.IsNullOrEmpty(u.Theirs)) return new UnmergedRow(path, "UD", "deleted by them:");
                return new UnmergedRow(path, "UU", "both modified:");
            })
            .ToList()
            .StableSort((a, b) => string.CompareOrdinal(a.Path, b.Path));
        var untrackedFiles = work.Files.Where(kv => !index.Entries.Has(kv.Key) && !index.Unmerged.Has(kv.Key) && !kv.Value.Ignored).Select(kv => kv.Key).ToList();
        var untracked = all ? SortedOrdinal(untrackedFiles) : CollapseUntracked(untrackedFiles, index.Entries.Keys);
        return new StatusInfo
        {
            Head = head,
            HeadTree = headTree,
            Index = index,
            Work = work,
            Staged = staged,
            Unstaged = unstaged,
            Unmerged = unmerged,
            Untracked = untracked,
            Merging = ExistsAt(r.G, Gpath(r, "MERGE_HEAD")),
        };
    }

    private sealed record Upstream(string Remote, string Ref, string Name);

    private static readonly Regex RefsHeadsRe = new("^refs/heads/", RO);

    /// <summary>The upstream branch of a local branch, e.g. "origin/main".</summary>
    private static Upstream? UpstreamOf(Repo r, string branch)
    {
        var remote = GetConfig(r.G, r, $"branch.{branch}.remote");
        var merge = GetConfig(r.G, r, $"branch.{branch}.merge");
        if (string.IsNullOrEmpty(remote) || string.IsNullOrEmpty(merge)) return null;
        var b = RefsHeadsRe.Replace(merge, "", 1);
        return new Upstream(remote, $"refs/remotes/{remote}/{b}", $"{remote}/{b}");
    }

    private static string TrackingText(Repo r, string branch, string? hash)
    {
        var up = UpstreamOf(r, branch);
        if (up is null) return "";
        var upHash = ReadRef(r, up.Ref);
        if (upHash is null) return $"Your branch is based on '{up.Name}', but the upstream is gone.\n  (use \"git branch --unset-upstream\" to fixup)\n";
        var mine = Ancestors(r, hash);
        var theirs = Ancestors(r, upHash);
        int ahead = mine.Count(x => !theirs.Has(x));
        int behind = theirs.Count(x => !mine.Has(x));
        static string Commits(int n) => $"{n} commit{(n == 1 ? "" : "s")}";
        if (ahead == 0 && behind == 0) return $"Your branch is up to date with '{up.Name}'.\n";
        if (ahead != 0 && behind == 0) return $"Your branch is ahead of '{up.Name}' by {Commits(ahead)}.\n  (use \"git push\" to publish your local commits)\n";
        if (ahead == 0) return $"Your branch is behind '{up.Name}' by {Commits(behind)}, and can be fast-forwarded.\n  (use \"git pull\" to update your local branch)\n";
        return $"Your branch and '{up.Name}' have diverged,\nand have {ahead} and {behind} different commits each, respectively.\n  (use \"git pull\" if you want to integrate the remote branch with yours)\n";
    }

    private static void PrintLongStatus(Repo r, StatusInfo s)
    {
        var g = r.G;
        var sb = new StringBuilder(!string.IsNullOrEmpty(s.Head.Branch) ? $"On branch {s.Head.Branch}\n" : $"HEAD detached at {Short(s.Head.Hash ?? Zero)}\n");
        if (!string.IsNullOrEmpty(s.Head.Branch) && !string.IsNullOrEmpty(s.Head.Hash))
        {
            var t = TrackingText(r, s.Head.Branch, s.Head.Hash);
            if (t != "") sb.Append(t + "\n");
        }
        if (s.Merging)
        {
            sb.Append(s.Unmerged.Count > 0
                ? "You have unmerged paths.\n  (fix conflicts and run \"git commit\")\n  (use \"git merge --abort\" to abort the merge)\n\n"
                : "All conflicts fixed but you are still merging.\n  (use \"git commit\" to conclude merge)\n\n");
        }
        if (string.IsNullOrEmpty(s.Head.Hash)) sb.Append("\nNo commits yet\n\n");
        // Every section ends with an empty line, just like in real git.
        void Section(string title, IEnumerable<string> hints, IEnumerable<string> lines) =>
            sb.Append($"{title}\n{string.Concat(hints.Select(h => $"  ({h})\n"))}{string.Concat(lines)}\n");
        static string Label(Change ch) => (ch.Status switch { 'A' => "new file:", 'M' => "modified:", 'D' => "deleted:", _ => "renamed:" }).PadRight(12);
        string Name(Change ch) => ch.Status == 'R' ? $"{Show(r, ch.OldPath!)} -> {Show(r, ch.Path)}" : Show(r, ch.Path);
        if (s.Staged.Count > 0)
        {
            var hint = s.Merging ? new List<string>() : new List<string> { !string.IsNullOrEmpty(s.Head.Hash) ? "use \"git restore --staged <file>...\" to unstage" : "use \"git rm --cached <file>...\" to unstage" };
            Section("Changes to be committed:", hint, s.Staged.Select(ch => $"\t{g.C(Col.Green, Label(ch) + Name(ch))}\n"));
        }
        if (s.Unmerged.Count > 0)
        {
            Section(
                "Unmerged paths:",
                new[] { s.Unmerged.Any(u => u.Code != "UU" && u.Code != "AA") ? "use \"git add/rm <file>...\" as appropriate to mark resolution" : "use \"git add <file>...\" to mark resolution" },
                s.Unmerged.Select(u => $"\t{g.C(Col.Red, u.Label.PadRight(17) + Show(r, u.Path))}\n"));
        }
        if (s.Unstaged.Count > 0)
        {
            bool del = s.Unstaged.Any(c => c.Status == 'D');
            Section(
                "Changes not staged for commit:",
                new[] { del ? "use \"git add/rm <file>...\" to update what will be committed" : "use \"git add <file>...\" to update what will be committed", "use \"git restore <file>...\" to discard changes in working directory" },
                s.Unstaged.Select(ch => $"\t{g.C(Col.Red, Label(ch) + Name(ch))}\n"));
        }
        if (s.Untracked.Count > 0)
        {
            Section("Untracked files:", new[] { "use \"git add <file>...\" to include in what will be committed" }, s.Untracked.Select(p => $"\t{g.C(Col.Red, Show(r, p))}\n"));
        }
        if (s.Staged.Count == 0)
        {
            if (s.Unstaged.Count > 0 || s.Unmerged.Count > 0) sb.Append("no changes added to commit (use \"git add\" and/or \"git commit -a\")\n");
            else if (s.Untracked.Count > 0) sb.Append("nothing added to commit but untracked files present (use \"git add\" to track)\n");
            else if (string.IsNullOrEmpty(s.Head.Hash)) sb.Append("nothing to commit (create/copy files and use \"git add\" to track)\n");
            else sb.Append("nothing to commit, working tree clean\n");
        }
        g.Out(sb.ToString());
    }

    private sealed class ShortRow
    {
        public string X = " ";
        public string Y = " ";
        public string Name = "";
    }

    private static void PrintShortStatus(Repo r, StatusInfo s, bool branch, bool color)
    {
        var g = r.G;
        string C(string col, string t) => color ? g.C(col, t) : t;
        var sb = new StringBuilder();
        if (branch)
        {
            if (string.IsNullOrEmpty(s.Head.Branch)) sb.Append($"## {C(Col.Red, "HEAD (no branch)")}\n");
            else if (string.IsNullOrEmpty(s.Head.Hash)) sb.Append($"## No commits yet on {C(Col.Green, s.Head.Branch)}\n");
            else
            {
                var up = UpstreamOf(r, s.Head.Branch);
                var extra = "";
                if (up is not null)
                {
                    var upHash = ReadRef(r, up.Ref);
                    if (upHash is not null)
                    {
                        var mine = Ancestors(r, s.Head.Hash);
                        var theirs = Ancestors(r, upHash);
                        int ahead = mine.Count(x => !theirs.Has(x));
                        int behind = theirs.Count(x => !mine.Has(x));
                        var parts = new[] { ahead != 0 ? $"ahead {ahead}" : "", behind != 0 ? $"behind {behind}" : "" }.Where(x => x != "").ToList();
                        extra = $"...{C(Col.Red, up.Name)}{(parts.Count > 0 ? $" [{string.Join(", ", parts)}]" : "")}";
                    }
                    else extra = $"...{C(Col.Red, up.Name)} [gone]";
                }
                sb.Append($"## {C(Col.Green, s.Head.Branch)}{extra}\n");
            }
        }
        var rows = new OrderedDictionary<string, ShortRow>(StringComparer.Ordinal);
        foreach (var ch in s.Staged)
            rows[ch.Path] = new ShortRow { X = ch.Status.ToString(), Y = " ", Name = ch.Status == 'R' ? $"{Show(r, ch.OldPath!)} -> {Show(r, ch.Path)}" : Show(r, ch.Path) };
        foreach (var ch in s.Unstaged)
        {
            var row = rows.TryGetValue(ch.Path, out var existing) ? existing : new ShortRow { X = " ", Y = " ", Name = Show(r, ch.Path) };
            row.Y = ch.Status.ToString();
            rows[ch.Path] = row;
        }
        foreach (var u in s.Unmerged) rows[u.Path] = new ShortRow { X = u.Code[0].ToString(), Y = u.Code[1].ToString(), Name = Show(r, u.Path) };
        foreach (var p in SortedOrdinal(rows.Keys))
        {
            var row = rows[p];
            bool unmerged = s.Unmerged.Any(u => u.Path == p);
            if (unmerged) sb.Append($"{C(Col.Red, row.X + row.Y)} {row.Name}\n");
            else
            {
                var x = C(Col.Green, row.X.Trim());
                var y = C(Col.Red, row.Y.Trim());
                sb.Append($"{(x != "" ? x : " ")}{(y != "" ? y : " ")} {row.Name}\n");
            }
        }
        foreach (var p in s.Untracked) sb.Append($"{C(Col.Red, "??")} {Show(r, p)}\n");
        g.Out(sb.ToString());
    }

    // status

    private static int CmdStatus(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "s|short", "b|branch", "porcelain", "long", "u|untracked-files=", "z" }, "status");
        var r = NeedRepo(g);
        NeedWork(r);
        bool all = o.Get("untracked-files") == "all";
        var s = ComputeStatus(r, all);
        if (o.Get("untracked-files") == "no") s.Untracked = new List<string>();
        if (o.Has("porcelain")) PrintShortStatus(r, s, o.Has("branch"), false);
        else if (o.Has("short") && !o.Has("long")) PrintShortStatus(r, s, o.Has("branch"), true);
        else PrintLongStatus(r, s);
        return 0;
    }
}
