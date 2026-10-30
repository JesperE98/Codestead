namespace Codestead.Shell.Commands;

// Port of src/shell/commands/git.ts (part 2: diff, three-way merge, switching trees, status, arguments).

public static partial class GitCmd
{
    // ---------- Diff ----------

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

    // ---------- Three-way merge ----------

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

    // ---------- Switching trees in the work tree ----------

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

    // ---------- Status ----------

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

    // ---------- Arguments ----------

    private sealed class Parsed
    {
        public OrderedDictionary<string, List<string>> Opts = new(StringComparer.Ordinal);
        public List<string> Operands = new();
        /// <summary>What came after "--" (null if there was no "--").</summary>
        public List<string>? Paths;

        public bool Has(string name) => Opts.ContainsKey(name);
        public string? Get(string name) => Opts.TryGetValue(name, out var v) && v.Count > 0 ? v[^1] : null;
        public List<string>? GetAll(string name) => Opts.TryGetValue(name, out var v) ? v : null;
    }

    private static readonly Regex NegNumRe = new("^-[0-9]+\\z", RO);

    /// <summary>
    /// Parses flags according to a list like ["a|all", "m|message=", "amend"]:
    /// short|long name, "=" means the flag takes a value. Flags can be repeated.
    /// </summary>
    private static Parsed ParseArgs(List<string> args, string[] spec, string cmd)
    {
        var shortDefs = new Dictionary<string, (string Name, bool Value)>(StringComparer.Ordinal);
        var longDefs = new OrderedDictionary<string, (string Name, bool Value)>(StringComparer.Ordinal);
        foreach (var s in spec)
        {
            bool value = s.EndsWith('=');
            var names = (value ? s[..^1] : s).Split('|');
            var name = names.FirstOrDefault(n => n.Length > 1) ?? names[0];
            foreach (var n in names)
            {
                if (n.Length == 1) shortDefs[n] = (name, value);
                else longDefs[n] = (name, value);
            }
        }
        var o = new Parsed();
        void Add(string name, string v)
        {
            if (!o.Opts.TryGetValue(name, out var list)) o.Opts[name] = list = new List<string>();
            list.Add(v);
        }
        GitExit Bad(string what) => new($"error: unknown {what}\nusage: git {cmd} [<options>]\n", 129);
        for (int i = 0; i < args.Count; i++)
        {
            var a = args[i];
            if (a == "--")
            {
                o.Paths = args.Skip(i + 1).ToList();
                break;
            }
            if (a.StartsWith("--", StringComparison.Ordinal) && a.Length > 2)
            {
                int eq = a.IndexOf('=');
                var key = eq >= 0 ? a.Slice(2, eq) : a.Slice(2);
                (string Name, bool Value)? def = longDefs.TryGetValue(key, out var d0) ? d0 : null;
                bool negated = false;
                if (def is null && key.StartsWith("no-", StringComparison.Ordinal) && longDefs.ContainsKey(key.Slice(3)))
                {
                    def = longDefs[key.Slice(3)];
                    key = key.Slice(3);
                    negated = true;
                }
                if (def is null)
                {
                    // Abbreviations such as --stag for --staged.
                    var hits = longDefs.Keys.Where(k => k.StartsWith(key, StringComparison.Ordinal)).ToList();
                    if (hits.Count == 1) def = longDefs[hits[0]];
                }
                if (def is null) throw Bad($"option '{a.Slice(2)}'");
                if (negated)
                {
                    o.Opts.Remove(def.Value.Name);
                    Add("no-" + def.Value.Name, "");
                }
                else if (def.Value.Value)
                {
                    string? v = eq >= 0 ? a.Slice(eq + 1) : (++i < args.Count ? args[i] : null);
                    if (v is null) throw new GitExit($"error: option `{key}' requires a value\n", 129);
                    Add(def.Value.Name, v);
                }
                else Add(def.Value.Name, "");
                continue;
            }
            if (a.StartsWith('-') && a.Length > 1 && !NegNumRe.IsMatch(a))
            {
                for (int j = 1; j < a.Length; j++)
                {
                    var c = a[j].ToString();
                    if (!shortDefs.TryGetValue(c, out var def)) throw Bad($"switch `{c}'");
                    if (def.Value)
                    {
                        var rest = a.Slice(j + 1);
                        string? v = rest != "" ? rest : (++i < args.Count ? args[i] : null);
                        if (v is null) throw new GitExit($"error: switch `{c}' requires a value\n", 129);
                        Add(def.Name, v);
                        break;
                    }
                    Add(def.Name, "");
                }
                continue;
            }
            o.Operands.Add(a);
        }
        return o;
    }
}
