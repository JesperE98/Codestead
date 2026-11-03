namespace Codestead.Shell.Commands;

// git log.

public static partial class GitCmd
{
    /// <summary>
    /// Commits reachable from `starts` (but not from `exclude`), newest first and children before parents.
    /// With `topo` (as `git log --graph`), the order no longer depends on the commit times: after a merge
    /// the merged branch is shown before the first parent's line, like git's --topo-order.
    /// </summary>
    private static List<Commit> WalkCommits(Repo r, List<string> starts, List<string>? exclude = null, bool firstParent = false, bool topo = false)
    {
        exclude ??= new List<string>();
        var hidden = new HashSet<string>(StringComparer.Ordinal);
        foreach (var e in exclude)
            foreach (var h in Ancestors(r, e)) hidden.Add(h);
        var all = new OrderedDictionary<string, Commit>(StringComparer.Ordinal);
        var order = new Dictionary<string, int>(StringComparer.Ordinal);
        var queue = new LinkedList<string>(starts);
        List<string> ParentsOf(Commit c) => firstParent ? c.Parents.Take(1).ToList() : c.Parents;
        while (queue.Count > 0)
        {
            var h = queue.First!.Value;
            queue.RemoveFirst();
            if (all.ContainsKey(h) || hidden.Contains(h)) continue;
            var c = ReadCommit(r, h);
            all[h] = c;
            order[h] = order.Count;
            foreach (var p in ParentsOf(c)) queue.AddLast(p);
        }
        var pending = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var c in all.Values)
            foreach (var p in ParentsOf(c))
                if (all.ContainsKey(p)) pending[p] = (pending.TryGetValue(p, out var n) ? n : 0) + 1;
        var ready = all.Keys.Where(h => !pending.TryGetValue(h, out var n) || n == 0).ToList();
        int ByDate(string a, string b)
        {
            var d = all[b].Committer.Time.CompareTo(all[a].Committer.Time);
            return d != 0 ? d : order[a] - order[b];
        }
        var res = new List<Commit>();
        if (topo)
        {
            // A stack: the newest tip on top, and a commit's last parent is taken first.
            ready.StableSort(ByDate);
            ready.Reverse();
        }
        while (ready.Count > 0)
        {
            string h;
            if (topo)
            {
                h = ready[^1];
                ready.RemoveAt(ready.Count - 1);
            }
            else
            {
                ready.StableSort(ByDate);
                h = ready[0];
                ready.RemoveAt(0);
            }
            var c = all[h];
            res.Add(c);
            foreach (var p in ParentsOf(c))
            {
                if (!all.ContainsKey(p)) continue;
                int n = pending[p] - 1;
                pending[p] = n;
                if (n == 0) ready.Add(p);
            }
        }
        return res;
    }

    /// <summary>A JS array that grows when assigned past its end (holes join as "") – used to draw graph rows.</summary>
    private sealed class DrawArr
    {
        private readonly List<string?> items;

        public DrawArr(int width) => items = Enumerable.Repeat<string?>(" ", Math.Max(0, width)).ToList();

        public string this[int i]
        {
            set
            {
                if (i < 0) return; // arr[-1] = x sets a property, not an element
                while (items.Count <= i) items.Add(null);
                items[i] = value;
            }
        }

        public string Join() => string.Concat(items.Select(x => x ?? ""));
    }

    private static string Draw(int width, Action<DrawArr> set)
    {
        var arr = new DrawArr(width);
        set(arr);
        return TrailingWsAnyRe.Replace(arr.Join(), "", 1);
    }

    /// <summary>Draws a simple graph (like `git log --graph`) to the left of every commit.</summary>
    private static List<string> GraphLines(List<Commit> commits, Func<Commit, List<string>> render)
    {
        var inSet = new HashSet<string>(commits.Select(c => c.Hash), StringComparer.Ordinal);
        var cols = new List<string>();
        var res = new List<string>();
        foreach (var c in commits)
        {
            int idx = cols.IndexOf(c.Hash);
            if (idx < 0)
            {
                cols.Add(c.Hash);
                idx = cols.Count - 1;
            }
            var parents = c.Parents.Where(inSet.Contains).ToList();
            var next = new List<string>(cols);
            next.RemoveAt(idx);
            if (parents.Count > 0) next.Insert(idx, parents[0]);
            var extra = parents.Skip(1).Where(p => !next.Contains(p)).ToList();
            next.InsertRange(Math.Min(idx + 1, next.Count), extra);
            int width = Math.Max(cols.Count, next.Count) * 2;
            var row = string.Join(" ", cols.Select((_, i) => i == idx ? "*" : "|"));
            var prefixes = new List<string>();
            if (parents.Count > 1)
            {
                if (extra.Count > 0)
                {
                    var colsCount = cols.Count;
                    prefixes.Add(Draw(next.Count * 2, arr =>
                    {
                        for (int k = 0; k <= idx; k++) arr[2 * k] = "|";
                        arr[2 * idx + 1] = "\\";
                        for (int k = idx + 1; k < colsCount; k++) arr[2 * k + 1] = "\\";
                    }));
                }
                else
                {
                    int q = next.IndexOf(parents[1]);
                    var nextCount = next.Count;
                    prefixes.Add(Draw(next.Count * 2, arr =>
                    {
                        for (int k = 0; k < nextCount; k++) arr[2 * k] = "|";
                        if (q < idx) arr[2 * idx - 1] = "/";
                        else arr[2 * idx + 1] = "\\";
                    }));
                }
            }
            else if (parents.Count == 0 && idx < cols.Count - 1)
            {
                var colsCount = cols.Count;
                prefixes.Add(Draw(cols.Count * 2, arr =>
                {
                    for (int k = 0; k < idx; k++) arr[2 * k] = "|";
                    for (int k = idx + 1; k < colsCount; k++) arr[2 * k - 1] = "/";
                }));
            }
            cols = next;
            var bars = string.Join(" ", cols.Select(_ => "|"));
            var body = render(c);
            res.Add(row.PadRight(width) + body[0]);
            var rest = body.Skip(1).ToList();
            for (int i = 0; i < Math.Max(rest.Count, prefixes.Count); i++)
            {
                var pre = i < prefixes.Count ? prefixes[i] : bars;
                var line = i < rest.Count ? rest[i] : "";
                res.Add(line != "" ? pre.PadRight(width) + line : pre);
            }
            // Two columns waiting for the same commit are joined.
            for (int j = 0; j < cols.Count; j++)
            {
                int i = cols.IndexOf(cols[j]);
                if (i == j) continue;
                var jj = j;
                var colsCount = cols.Count;
                res.Add(Draw(cols.Count * 2, arr =>
                {
                    for (int k = 0; k < jj; k++) arr[2 * k] = "|";
                    arr[2 * jj - 1] = "/";
                    for (int k = jj + 1; k < colsCount; k++) arr[2 * k - 1] = "/";
                }));
                cols.RemoveAt(j);
                j--;
            }
        }
        return res;
    }

    private static readonly Regex LimitArgRe = new("^-([0-9]+)\\z", RO);

    private static int CmdLog(G g, List<string> args)
    {
        double limit = double.PositiveInfinity;
        args = args.Where(a =>
        {
            var m = LimitArgRe.Match(a);
            if (m.Success) limit = Js.Number(m.Groups[1].Value);
            return !m.Success;
        }).ToList();
        var o = ParseArgs(
            args,
            new[] { "oneline", "n|max-count=", "graph", "all", "decorate", "p|patch", "stat", "reverse", "first-parent", "name-only", "name-status", "pretty=", "format=", "abbrev-commit" },
            "log");
        if (!string.IsNullOrEmpty(o.Get("max-count"))) limit = Js.Number(o.Get("max-count"));
        var r = NeedRepo(g);
        var (revs, paths) = RevsAndPaths(r, o);
        var head = ReadHead(r);
        var starts = new List<string>();
        var exclude = new List<string>();
        foreach (var rev in revs)
        {
            if (rev.Contains(".."))
            {
                var ab = RangeSepRe.Split(rev);
                var a = ab[0];
                var b = ab.Length > 1 ? ab[1] : "";
                exclude.Add(NeedCommit(r, a != "" ? a : "HEAD"));
                starts.Add(NeedCommit(r, b != "" ? b : "HEAD"));
            }
            else if (rev.StartsWith('^')) exclude.Add(NeedCommit(r, rev.Slice(1)));
            else starts.Add(NeedCommit(r, rev));
        }
        if (o.Has("all"))
        {
            if (!string.IsNullOrEmpty(head.Hash)) starts.Add(head.Hash);
            foreach (var prefix in new[] { "refs/heads/", "refs/remotes/", "refs/tags/" })
                foreach (var n in ListRefs(r, prefix))
                {
                    var h = ReadRef(r, prefix + n);
                    if (!string.IsNullOrEmpty(h) && ReadObj(r, Peel(r, h))?.Type == "commit") starts.Add(Peel(r, h));
                }
        }
        if (starts.Count == 0 && !o.Has("all"))
        {
            if (string.IsNullOrEmpty(head.Hash)) throw Fatal(!string.IsNullOrEmpty(head.Branch) ? $"your current branch '{head.Branch}' does not have any commits yet" : "bad default revision 'HEAD'");
            starts.Add(head.Hash);
        }
        var commits = WalkCommits(r, Union(starts), exclude, o.Has("first-parent"), o.Has("graph"));
        if (paths.Count > 0)
        {
            var specs = paths.Select(p => ToSpec(r, p)).ToList();
            bool Touches(Commit c) => TreeChanges(CommitTree(r, c.Parents.Count > 0 ? c.Parents[0] : null), ReadTree(r, c.Tree), p => specs.Any(s => SpecMatch(s, p))).Count > 0;
            commits = commits.Where(Touches).ToList();
        }
        commits = JsSlice(commits, 0, SliceEnd(limit));
        if (o.Has("reverse")) commits.Reverse();
        var pretty = o.Get("pretty") ?? o.Get("format");
        bool oneline = o.Has("oneline") || pretty == "oneline";
        var deco = o.Has("no-decorate") ? null : o.Has("decorate") || g.Tty ? Decorations(r) : null;
        List<string> Render(Commit c)
        {
            List<string> lines;
            if (oneline) lines = new List<string> { $"{g.C(Col.Yellow, o.Has("oneline") || o.Has("abbrev-commit") ? Short(c.Hash) : c.Hash)}{Decorate(g, deco, c.Hash)} {Subject(c)}" };
            else if (pretty == "short") lines = new List<string> { $"{g.C(Col.Yellow, $"commit {c.Hash}")}{Decorate(g, deco, c.Hash)}", $"Author: {c.Author.Name} <{c.Author.Email}>", "", $"    {Subject(c)}" };
            else lines = CommitHeader(r, c, deco);
            var mode = o.Has("patch") ? "patch" : o.Has("stat") ? "stat" : o.Has("name-only") ? "name-only" : o.Has("name-status") ? "name-status" : null;
            if (mode is not null && c.Parents.Count < 2)
            {
                var text = new StringBuilder();
                var saved = g.Out;
                g.Out = s => text.Append(s);
                try
                {
                    PrintPatch(r, TreeChanges(CommitTree(r, c.Parents.Count > 0 ? c.Parents[0] : null), ReadTree(r, c.Tree)), mode);
                }
                finally
                {
                    g.Out = saved;
                }
                var t = text.ToString();
                if (t != "")
                {
                    if (!oneline) lines.Add("");
                    lines.AddRange((t.EndsWith('\n') ? t[..^1] : t).Split('\n'));
                }
            }
            return lines;
        }
        var blocks = new List<string>();
        if (o.Has("graph"))
        {
            bool sep = !oneline;
            blocks.AddRange(GraphLines(commits, c =>
            {
                var lines = Render(c);
                if (sep && !ReferenceEquals(c, commits[^1])) lines.Add("");
                return lines;
            }));
        }
        else
        {
            for (int i = 0; i < commits.Count; i++)
            {
                blocks.AddRange(Render(commits[i]));
                if (!oneline && i < commits.Count - 1) blocks.Add("");
            }
        }
        if (blocks.Count > 0) g.Out(string.Join("\n", blocks) + "\n");
        return 0;
    }
}
