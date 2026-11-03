namespace Codestead.Shell.Commands;

// Diff (line diff, hunks, patches and stats), the three-way merge, and git diff.

public static partial class GitCmd
{
    private readonly record struct Op(char T, string S);

    private const string NoEol = "\u0000";

    private static List<string> DiffLinesOf(string text)
    {
        if (text == "") return new List<string>();
        var lines = text.Split('\n').ToList();
        if (lines[^1] == "") lines.RemoveAt(lines.Count - 1);
        else lines[^1] += NoEol;
        return lines;
    }

    /// <summary>Line diff (longest common subsequence).</summary>
    private static List<Op> DiffOps(List<string> a, List<string> b)
    {
        int pre = 0;
        while (pre < a.Count && pre < b.Count && a[pre] == b[pre]) pre++;
        int suf = 0;
        while (suf < a.Count - pre && suf < b.Count - pre && a[a.Count - 1 - suf] == b[b.Count - 1 - suf]) suf++;
        var A = JsSlice(a, pre, a.Count - suf);
        var B = JsSlice(b, pre, b.Count - suf);
        var mid = new List<Op>();
        int n = A.Count;
        int m = B.Count;
        if ((long)n * m > 4_000_000)
        {
            foreach (var s in A) mid.Add(new Op('-', s));
            foreach (var s in B) mid.Add(new Op('+', s));
        }
        else
        {
            var dp = new int[(n + 1) * (m + 1)];
            for (int ii = n - 1; ii >= 0; ii--)
                for (int jj = m - 1; jj >= 0; jj--)
                    dp[ii * (m + 1) + jj] = A[ii] == B[jj] ? dp[(ii + 1) * (m + 1) + jj + 1] + 1 : Math.Max(dp[(ii + 1) * (m + 1) + jj], dp[ii * (m + 1) + jj + 1]);
            int i = 0;
            int j = 0;
            while (i < n || j < m)
            {
                if (i < n && j < m && A[i] == B[j])
                {
                    mid.Add(new Op(' ', A[i]));
                    i++;
                    j++;
                }
                else if (j < m && (i == n || dp[i * (m + 1) + j + 1] >= dp[(i + 1) * (m + 1) + j]))
                {
                    if (i < n && dp[i * (m + 1) + j + 1] == dp[(i + 1) * (m + 1) + j]) mid.Add(new Op('-', A[i++]));
                    else mid.Add(new Op('+', B[j++]));
                }
                else mid.Add(new Op('-', A[i++]));
            }
        }
        var res = a.Take(pre).Select(s => new Op(' ', s)).ToList();
        res.AddRange(mid);
        res.AddRange(b.Skip(b.Count - suf).Select(s => new Op(' ', s)));
        return res;
    }

    private static (int Ins, int Del) CountChanges(string oldText, string newText)
    {
        int ins = 0;
        int del = 0;
        foreach (var op in DiffOps(DiffLinesOf(oldText), DiffLinesOf(newText)))
        {
            if (op.T == '+') ins++;
            else if (op.T == '-') del++;
        }
        return (ins, del);
    }

    private static List<string> HunkLines(G g, string oldText, string newText, int context = 3)
    {
        var ops = DiffOps(DiffLinesOf(oldText), DiffLinesOf(newText));
        var aPos = new List<int>();
        var bPos = new List<int>();
        int a = 0;
        int b = 0;
        foreach (var op in ops)
        {
            aPos.Add(a);
            bPos.Add(b);
            if (op.T != '+') a++;
            if (op.T != '-') b++;
        }
        var changes = ops.Select((op, i) => op.T == ' ' ? -1 : i).Where(i => i >= 0).ToList();
        var ranges = new List<int[]>();
        foreach (var i in changes)
        {
            int start = Math.Max(0, i - context);
            int end = Math.Min(ops.Count - 1, i + context);
            var last = ranges.Count > 0 ? ranges[^1] : null;
            if (last is not null && start <= last[1] + 1) last[1] = Math.Max(last[1], end);
            else ranges.Add(new[] { start, end });
        }
        static string Fmt(int start, int count) => count == 0 ? $"{start},0" : count == 1 ? $"{start + 1}" : $"{start + 1},{count}";
        var res = new List<string>();
        foreach (var range in ranges)
        {
            int s = range[0], e = range[1];
            var slice = JsSlice(ops, s, e + 1);
            int aCount = slice.Count(o => o.T != '+');
            int bCount = slice.Count(o => o.T != '-');
            res.Add(g.C(Col.Cyan, $"@@ -{Fmt(aPos[s], aCount)} +{Fmt(bPos[s], bCount)} @@"));
            foreach (var op in slice)
            {
                bool noEol = op.S.EndsWith(NoEol, StringComparison.Ordinal);
                var text = op.T + (noEol ? op.S.Slice(0, -1) : op.S);
                res.Add(op.T == '-' ? g.C(Col.Red, text) : op.T == '+' ? g.C(Col.Green, text) : text);
                if (noEol) res.Add("\\ No newline at end of file");
            }
        }
        return res;
    }

    private sealed class Change
    {
        /// <summary>A, M, D or R.</summary>
        public char Status;
        public string Path = "";
        public string? OldPath;
        public string? OldHash;
        public string? NewHash;
    }

    /// <summary>The differences between two trees, with simple rename detection (same content).</summary>
    private static List<Change> TreeChanges(JsMap<string> A, JsMap<string> B, Func<string, bool>? filter = null)
    {
        var changes = new List<Change>();
        foreach (var p in Union(A.Keys, B.Keys))
        {
            if (filter is not null && !filter(p)) continue;
            if (A[p] == B[p]) continue;
            if (!A.Has(p)) changes.Add(new Change { Status = 'A', Path = p, NewHash = B[p] });
            else if (!B.Has(p)) changes.Add(new Change { Status = 'D', Path = p, OldHash = A[p] });
            else changes.Add(new Change { Status = 'M', Path = p, OldHash = A[p], NewHash = B[p] });
        }
        foreach (var add in changes.Where(c => c.Status == 'A').ToList())
        {
            var del = changes.FirstOrDefault(c => c.Status == 'D' && c.OldHash == add.NewHash);
            if (del is null) continue;
            changes.Remove(del);
            add.Status = 'R';
            add.OldPath = del.Path;
            add.OldHash = del.OldHash;
        }
        return changes.StableSort((x, y) => string.CompareOrdinal(x.Path, y.Path) switch { < 0 => -1, > 0 => 1, _ => 0 });
    }

    private static void PrintPatch(Repo r, List<Change> changes, string mode = "patch")
    {
        var g = r.G;
        if (mode == "stat")
        {
            g.Out(StatText(r, changes, false));
            return;
        }
        foreach (var ch in changes)
        {
            if (mode == "name-only")
            {
                g.Out(ch.Path + "\n");
                continue;
            }
            if (mode == "name-status")
            {
                g.Out(ch.Status == 'R' ? $"R100\t{ch.OldPath}\t{ch.Path}\n" : $"{ch.Status}\t{ch.Path}\n");
                continue;
            }
            var oldP = ch.OldPath ?? ch.Path;
            var lines = new List<string> { $"diff --git a/{oldP} b/{ch.Path}" };
            if (ch.Status == 'A') lines.Add("new file mode 100644");
            if (ch.Status == 'D') lines.Add("deleted file mode 100644");
            if (ch.Status == 'R') lines.AddRange(new[] { "similarity index 100%", $"rename from {oldP}", $"rename to {ch.Path}" });
            if (ch.Status != 'R') lines.Add($"index {Short(ch.OldHash ?? Zero)}..{Short(ch.NewHash ?? Zero)}{(ch.Status == 'M' ? " 100644" : "")}");
            var oldText = !string.IsNullOrEmpty(ch.OldHash) ? ReadBlob(r, ch.OldHash) : "";
            var newText = !string.IsNullOrEmpty(ch.NewHash) ? ReadBlob(r, ch.NewHash) : "";
            var hunks = oldText == newText ? new List<string>() : HunkLines(g, oldText, newText);
            if (hunks.Count > 0)
            {
                lines.Add(ch.Status == 'A' ? "--- /dev/null" : $"--- a/{oldP}");
                lines.Add(ch.Status == 'D' ? "+++ /dev/null" : $"+++ b/{ch.Path}");
            }
            g.Out(string.Join("\n", lines.Select(l => g.C(Col.Bold, l))) + "\n");
            if (hunks.Count > 0) g.Out(string.Join("\n", hunks) + "\n");
        }
    }

    private static string SummaryLine(int files, int ins, int del)
    {
        var s = $" {files} file{(files == 1 ? "" : "s")} changed";
        if (ins != 0 || del == 0) s += $", {ins} insertion{(ins == 1 ? "" : "s")}(+)";
        if (del != 0 || ins == 0) s += $", {del} deletion{(del == 1 ? "" : "s")}(-)";
        return s + "\n";
    }

    private static int JsRound(double x) => (int)Math.Floor(x + 0.5);

    /// <summary>Diffstat as after `git merge` (bar chart) or `git commit` (summary only, short=true).</summary>
    private static string StatText(Repo r, List<Change> changes, bool @short)
    {
        var g = r.G;
        var rows = changes.Select(ch =>
        {
            var (ins, del) = CountChanges(!string.IsNullOrEmpty(ch.OldHash) ? ReadBlob(r, ch.OldHash) : "", !string.IsNullOrEmpty(ch.NewHash) ? ReadBlob(r, ch.NewHash) : "");
            var name = ch.Status == 'R' ? $"{ch.OldPath} => {ch.Path}" : ch.Path;
            return (Ch: ch, Ins: ins, Del: del, Name: name);
        }).ToList();
        int totalIns = rows.Sum(x => x.Ins);
        int totalDel = rows.Sum(x => x.Del);
        var sb = new StringBuilder();
        if (!@short)
        {
            int nameW = Math.Max(0, rows.Count > 0 ? rows.Max(x => x.Name.Length) : 0);
            int numW = Math.Max(1, rows.Count > 0 ? rows.Max(x => Js.Num(x.Ins + x.Del).Length) : 0);
            int maxBar = Math.Max(1, rows.Count > 0 ? rows.Max(x => x.Ins + x.Del) : 0);
            double scale = maxBar > 50 ? 50.0 / maxBar : 1;
            foreach (var x in rows)
            {
                int plus = JsRound(x.Ins * scale);
                if (plus == 0) plus = x.Ins != 0 ? 1 : 0;
                int minus = JsRound(x.Del * scale);
                if (minus == 0) minus = x.Del != 0 ? 1 : 0;
                var bar = g.C(Col.Green, "+".Repeat(plus)) + g.C(Col.Red, "-".Repeat(minus));
                sb.Append($" {x.Name.PadRight(nameW)} | {Js.Num(x.Ins + x.Del).PadLeft(numW)}{(bar != "" ? " " + bar : "")}\n");
            }
        }
        if (rows.Count > 0) sb.Append(SummaryLine(rows.Count, totalIns, totalDel));
        foreach (var x in rows)
        {
            if (x.Ch.Status == 'A') sb.Append($" create mode 100644 {x.Ch.Path}\n");
            else if (x.Ch.Status == 'D') sb.Append($" delete mode 100644 {x.Ch.Path}\n");
            else if (x.Ch.Status == 'R' && @short) sb.Append($" rename {x.Ch.OldPath} => {x.Ch.Path} (100%)\n");
        }
        return sb.ToString();
    }

    /// <summary>Which lines in a match lines in b (index in b, or -1).</summary>
    private static int[] Matches(List<string> a, List<string> b)
    {
        var res = Enumerable.Repeat(-1, a.Count).ToArray();
        int i = 0;
        int j = 0;
        foreach (var op in DiffOps(a, b))
        {
            if (op.T == ' ') res[i++] = j++;
            else if (op.T == '-') i++;
            else j++;
        }
        return res;
    }

    private static string ReplaceFirst(string s, string find, string repl)
    {
        int i = s.IndexOf(find, StringComparison.Ordinal);
        return i < 0 ? s : s[..i] + repl + s[(i + find.Length)..];
    }

    /// <summary>Line-based three-way merge (diff3). Returns the text and whether there was a conflict.</summary>
    private static (string Text, bool Conflict) Merge3(string @base, string ours, string theirs, string oursLabel, string theirsLabel)
    {
        var B = DiffLinesOf(@base);
        var O = DiffLinesOf(ours);
        var T = DiffLinesOf(theirs);
        var mo = Matches(B, O);
        var mt = Matches(B, T);
        var res = new List<string>();
        bool conflict = false;
        int i = 0;
        int j = 0;
        int k = 0;
        static bool Eq(List<string> x, List<string> y) => x.Count == y.Count && x.Select((s, n) => s == y[n]).All(v => v);
        while (i < B.Count || j < O.Count || k < T.Count)
        {
            if (i < B.Count && mo[i] == j && mt[i] == k)
            {
                res.Add(B[i]);
                i++;
                j++;
                k++;
                continue;
            }
            int t = i;
            while (t < B.Count && !(mo[t] >= j && mt[t] >= k)) t++;
            int oj = t < B.Count ? mo[t] : O.Count;
            int tk = t < B.Count ? mt[t] : T.Count;
            var b = JsSlice(B, i, t);
            var o = JsSlice(O, j, oj);
            var th = JsSlice(T, k, tk);
            if (Eq(o, b)) res.AddRange(th);
            else if (Eq(th, b) || Eq(o, th)) res.AddRange(o);
            else
            {
                conflict = true;
                static IEnumerable<string> Strip(List<string> xs) => xs.Select(s => ReplaceFirst(s, NoEol, ""));
                res.Add($"<<<<<<< {oursLabel}");
                res.AddRange(Strip(o));
                res.Add("=======");
                res.AddRange(Strip(th));
                res.Add($">>>>>>> {theirsLabel}");
            }
            i = t;
            j = oj;
            k = tk;
        }
        var last = res.Count > 0 ? res[^1] : null;
        var text = string.Join("\n", res.Select(l => ReplaceFirst(l, NoEol, ""))) + (res.Count > 0 && !last!.EndsWith(NoEol, StringComparison.Ordinal) ? "\n" : "");
        return (text, conflict);
    }

    // diff

    private static int CmdDiff(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "staged", "cached", "stat", "name-only", "name-status", "exit-code", "quiet", "no-index" }, "diff");
        var r = NeedRepo(g);
        var (revs, paths) = RevsAndPaths(r, o);
        var specs = paths.Select(p => ToSpec(r, p)).ToList();
        bool Filter(string p) => specs.Count == 0 || specs.Any(s => SpecMatch(s, p));
        bool staged = o.Has("staged") || o.Has("cached");
        JsMap<string> A;
        JsMap<string> B;
        JsMap<string> WorktreeTree(JsMap<string> @base)
        {
            var work = ScanWork(r);
            var t = new JsMap<string>();
            foreach (var p in @base.Keys)
            {
                var w = work.Get(p);
                if (w is not null) t[p] = w.Hash;
            }
            return t;
        }
        var range = revs.FirstOrDefault(x => x.Contains(".."));
        if (range is not null || revs.Count == 2)
        {
            var ab = range is not null ? RangeSepRe.Split(range) : revs.ToArray();
            var a = ab[0];
            var b = ab.Length > 1 ? ab[1] : "";
            A = CommitTree(r, NeedCommit(r, a != "" ? a : "HEAD"));
            B = CommitTree(r, NeedCommit(r, b != "" ? b : "HEAD"));
        }
        else if (revs.Count == 1)
        {
            A = RevTree(r, revs[0]) ?? throw Fatal($"bad revision '{revs[0]}'");
            var idx = ReadIndex(r);
            B = staged ? idx.Entries : WorktreeTree(A.Merge(idx.Entries));
        }
        else if (staged)
        {
            A = CommitTree(r, ReadHead(r).Hash);
            B = ReadIndex(r).Entries;
        }
        else
        {
            NeedWork(r);
            var idx = ReadIndex(r);
            A = idx.Entries.Copy();
            foreach (var p in idx.Unmerged.Keys) A.Delete(p);
            B = WorktreeTree(A);
            var unmerged = idx.Unmerged.Keys.Where(Filter).ToList();
            if (unmerged.Count > 0 && !o.Has("quiet"))
            {
                // Show the conflicted files against "our" version (real git shows a combined diff).
                foreach (var p in unmerged)
                {
                    var ours = idx.Unmerged[p]!.Ours;
                    var w = ScanWork(r).Get(p);
                    g.Out($"{g.C(Col.Bold, $"diff --cc {p}")}\n");
                    if (!string.IsNullOrEmpty(ours) && w is not null)
                    {
                        var lines = HunkLines(g, ReadBlob(r, ours), w.Content);
                        if (lines.Count > 0) g.Out($"{g.C(Col.Bold, $"--- a/{p}")}\n{g.C(Col.Bold, $"+++ b/{p}")}\n{string.Join("\n", lines)}\n");
                    }
                }
            }
        }
        var changes = TreeChanges(A, B, Filter);
        if (!o.Has("quiet")) PrintPatch(r, changes, o.Has("stat") ? "stat" : o.Has("name-only") ? "name-only" : o.Has("name-status") ? "name-status" : "patch");
        return (o.Has("exit-code") || o.Has("quiet")) && changes.Count > 0 ? 1 : 0;
    }
}
