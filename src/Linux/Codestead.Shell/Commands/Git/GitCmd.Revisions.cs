namespace Codestead.Shell.Commands;

// Revisions: resolving names like HEAD~2 or main^ to commits, ancestors and merge bases.

public static partial class GitCmd
{
    private static readonly Regex RevRe = new("^(.*?)((?:[~^][0-9]*)*)\\z", RO);
    private static readonly Regex SpecialHeadRe = new("^(HEAD|ORIG_HEAD|MERGE_HEAD|FETCH_HEAD)\\z", RO);
    private static readonly Regex ShortHexRe = new("^[0-9a-f]{4,40}\\z", RO);
    private static readonly Regex RevOpRe = new("[~^][0-9]*", RO);
    private static readonly Regex WsRe = new("\\s", RO);

    /// <summary>Resolves e.g. HEAD, main, origin/main, v1.0, a1b2c3d, HEAD~2 and main^2. Returns an object id.</summary>
    private static string? ResolveRev(Repo r, string rev)
    {
        var m = RevRe.Match(rev);
        if (!m.Success) return null;
        var @base = m.Groups[1].Value;
        var suffix = m.Groups[2].Value;
        if (@base == "" || @base == "@") @base = "HEAD";
        string? h = null;
        if (SpecialHeadRe.IsMatch(@base))
        {
            h = @base == "HEAD" ? ReadHead(r).Hash : ReadText(r.G, Gpath(r, @base)) is { } txt ? WsRe.Split(txt.Trim())[0] : null;
        }
        else if (@base == "@{-1}" || @base == "-")
        {
            var prev = PreviousBranch(r);
            h = prev is not null ? (ReadRef(r, $"refs/heads/{prev}") ?? (Hash40Re.IsMatch(prev) ? prev : null)) : null;
        }
        else
        {
            var refs = @base.StartsWith("refs/", StringComparison.Ordinal)
                ? new[] { @base }
                : new[] { $"refs/{@base}", $"refs/tags/{@base}", $"refs/heads/{@base}", $"refs/remotes/{@base}", $"refs/remotes/{@base}/HEAD" };
            foreach (var rf in refs)
            {
                h = ReadRef(r, rf);
                if (!string.IsNullOrEmpty(h)) break;
            }
            if (string.IsNullOrEmpty(h) && ShortHexRe.IsMatch(@base))
            {
                var hits = AllObjects(r).Where(id => id.StartsWith(@base, StringComparison.Ordinal)).ToList();
                if (hits.Count == 1) h = hits[0];
                else if (hits.Count > 1) throw Fatal($"short object ID {@base} is ambiguous");
            }
        }
        if (string.IsNullOrEmpty(h) || !Hash40Re.IsMatch(h)) return null;
        foreach (Match opm in RevOpRe.Matches(suffix))
        {
            var op = opm.Value;
            double n = op.Length > 1 ? Js.Number(op.Slice(1)) : 1;
            var c = ReadCommit(r, Peel(r, h));
            if (op[0] == '~')
            {
                for (double i = 0; i < n; i++)
                {
                    if (c.Parents.Count == 0) return null;
                    c = ReadCommit(r, c.Parents[0]);
                }
                h = c.Hash;
            }
            else
            {
                if (n == 0)
                {
                    h = c.Hash;
                    continue;
                }
                var pi = n - 1;
                if (pi < 0 || pi >= c.Parents.Count) return null;
                h = c.Parents[(int)pi];
            }
        }
        return h;
    }

    private static string? ResolveCommit(Repo r, string rev)
    {
        var h = ResolveRev(r, rev);
        if (h is null) return null;
        var p = Peel(r, h);
        return ReadObj(r, p)?.Type == "commit" ? p : null;
    }

    private static string NeedCommit(Repo r, string rev) => ResolveCommit(r, rev) ?? throw Fatal($"not a valid object name: '{rev}'");

    /// <summary>A tree from e.g. "HEAD", a commit or a tree id.</summary>
    private static JsMap<string>? RevTree(Repo r, string rev)
    {
        var h = ResolveRev(r, rev);
        if (h is null) return null;
        var p = Peel(r, h);
        var o = ReadObj(r, p);
        if (o?.Type == "commit") return ReadTree(r, ReadCommit(r, p).Tree);
        if (o?.Type == "tree") return ReadTree(r, p);
        return null;
    }

    private static OSet Ancestors(Repo r, string? h)
    {
        var seen = new OSet();
        var stack = new List<string>();
        if (!string.IsNullOrEmpty(h)) stack.Add(h);
        while (stack.Count > 0)
        {
            var x = stack[^1];
            stack.RemoveAt(stack.Count - 1);
            if (seen.Has(x)) continue;
            seen.Add(x);
            stack.AddRange(ReadCommit(r, x).Parents);
        }
        return seen;
    }

    private static bool IsAncestor(Repo r, string a, string b) => Ancestors(r, b).Has(a);

    private static string? MergeBase(Repo r, string a, string b)
    {
        var A = Ancestors(r, a);
        var common = Ancestors(r, b).Where(A.Has).ToList();
        var best = common.Where(x => !common.Any(y => y != x && IsAncestor(r, x, y))).ToList();
        best.StableSort((x, y) => ReadCommit(r, y).Committer.Time.CompareTo(ReadCommit(r, x).Committer.Time));
        return best.Count > 0 ? best[0] : null;
    }
}
