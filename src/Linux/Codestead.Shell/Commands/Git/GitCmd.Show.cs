namespace Codestead.Shell.Commands;

// git show.

public static partial class GitCmd
{
    private static readonly Regex TagBodyRe = new("\ntag (.*)\ntagger (.*)\n\n([\\s\\S]*)\\z", RO);

    private static int CmdShow(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "stat", "name-only", "name-status", "oneline", "s|no-patch", "pretty=", "format=" }, "show");
        var r = NeedRepo(g);
        var targets = o.Operands.Count > 0 ? o.Operands : new List<string> { "HEAD" };
        var deco = g.Tty ? Decorations(r) : null;
        for (int n = 0; n < targets.Count; n++)
        {
            var rev = targets[n];
            if (n != 0) g.Out("\n");
            int colon = rev.IndexOf(':');
            if (colon >= 0)
            {
                var revPart = rev.Slice(0, colon);
                var t = RevTree(r, revPart != "" ? revPart : "HEAD") ?? throw Fatal($"invalid object name '{revPart}'.");
                var p = rev.Slice(colon + 1);
                if (p.StartsWith("./", StringComparison.Ordinal) && r.Root is not null) p = ToSpec(r, p).Rel;
                var hh = t[p];
                if (string.IsNullOrEmpty(hh))
                {
                    var dir = t.Keys.Where(x => x.StartsWith(p != "" ? p + "/" : "", StringComparison.Ordinal)).ToList();
                    if (dir.Count == 0) throw Fatal($"path '{p}' does not exist in '{(revPart != "" ? revPart : "HEAD")}'");
                    var names = Union(dir.Select(x =>
                    {
                        var rest = x.Slice(p != "" ? p.Length + 1 : 0);
                        return rest.Split('/')[0] + (rest.Contains('/') ? "/" : "");
                    }));
                    g.Out($"tree {rev}\n\n{string.Join("\n", names)}\n");
                    continue;
                }
                g.Out(ReadBlob(r, hh));
                continue;
            }
            var h = ResolveRev(r, rev);
            if (h is null)
            {
                if (rev == "HEAD") throw Fatal($"your current branch '{ReadHead(r).Branch}' does not have any commits yet");
                throw Fail($"fatal: ambiguous argument '{rev}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'", 128);
            }
            var obj = ReadObj(r, h)!;
            if (obj.Type == "blob")
            {
                g.Out(obj.Data);
                continue;
            }
            if (obj.Type == "tree")
            {
                g.Out($"tree {rev}\n\n{string.Join("\n", ReadTree(r, h).Keys)}\n");
                continue;
            }
            var ch = h;
            if (obj.Type == "tag")
            {
                var tag = TagBodyRe.Match(obj.Data);
                if (tag.Success)
                {
                    var t = ParseIdent(tag.Groups[2].Value);
                    g.Out($"{g.C(Col.Yellow, $"tag {tag.Groups[1].Value}")}\nTagger: {t.Name} <{t.Email}>\nDate:   {FmtDate(t)}\n\n{tag.Groups[3].Value}\n");
                }
                ch = Peel(r, h);
            }
            var c = ReadCommit(r, ch);
            if (o.Has("oneline")) g.Out($"{g.C(Col.Yellow, Short(c.Hash))}{Decorate(g, deco, c.Hash)} {Subject(c)}\n");
            else g.Out(string.Join("\n", CommitHeader(r, c, deco)) + "\n");
            if (o.Has("no-patch") || c.Parents.Count > 1) continue;
            var changes = TreeChanges(CommitTree(r, c.Parents.Count > 0 ? c.Parents[0] : null), ReadTree(r, c.Tree));
            if (changes.Count > 0 && !o.Has("oneline")) g.Out("\n");
            PrintPatch(r, changes, o.Has("stat") ? "stat" : o.Has("name-only") ? "name-only" : o.Has("name-status") ? "name-status" : "patch");
        }
        return 0;
    }
}
