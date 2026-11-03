namespace Codestead.Shell.Commands;

// git ls-tree.

public static partial class GitCmd
{
    private static int CmdLsTree(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "r", "name-only", "l|long" }, "ls-tree");
        var r = NeedRepo(g);
        var rev = o.Operands.Count > 0 ? o.Operands[0] : null;
        if (string.IsNullOrEmpty(rev)) throw Fail("usage: git ls-tree [<options>] <tree-ish> [<path>...]", 129);
        var t = RevTree(r, rev) ?? throw Fatal("Not a valid object name " + rev);
        var rows = new OrderedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var p in t.Keys)
        {
            var h = t[p];
            if (o.Has("r") || !p.Contains('/')) rows[p] = o.Has("name-only") ? p : $"100644 blob {h}\t{p}";
            else
            {
                var d = p.Split('/')[0];
                if (!rows.ContainsKey(d))
                {
                    var sub = new JsMap<string>();
                    foreach (var q in t.Keys)
                        if (q.StartsWith(d + "/", StringComparison.Ordinal)) sub[q.Slice(d.Length + 1)] = t[q];
                    rows[d] = o.Has("name-only") ? d : $"040000 tree {WriteTree(r, sub)}\t{d}";
                }
            }
        }
        foreach (var k in SortedOrdinal(rows.Keys)) g.Out(rows[k] + "\n");
        return 0;
    }
}
