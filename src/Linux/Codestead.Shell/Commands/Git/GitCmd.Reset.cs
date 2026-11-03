namespace Codestead.Shell.Commands;

// git reset.

public static partial class GitCmd
{
    private static int CmdReset(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "soft", "mixed", "hard", "q|quiet", "keep", "merge" }, "reset");
        var r = NeedRepo(g);
        var head = ReadHead(r);
        var rev = "HEAD";
        var ops = new List<string>(o.Operands);
        if (ops.Count > 0 && ResolveCommit(r, ops[0]) is not null && (o.Paths is not null || ops.Count == 1 || !ExistsAt(g, VfsLib.ResolvePath(g.Cwd, ops[0]))))
        {
            rev = ops[0];
            ops.RemoveAt(0);
        }
        var paths = ops.Concat(o.Paths ?? new List<string>()).ToList();
        if (paths.Count > 0)
        {
            if (o.Has("hard") || o.Has("soft")) throw Fatal($"Cannot do {(o.Has("hard") ? "hard" : "soft")} reset with paths.");
            NeedWork(r);
            var t = rev == "HEAD" && string.IsNullOrEmpty(head.Hash) ? new JsMap<string>() : (RevTree(r, rev) ?? throw Fatal($"Failed to resolve '{rev}' as a valid revision."));
            var specs = paths.Select(p => ToSpec(r, p)).ToList();
            var idx = ReadIndex(r);
            foreach (var p in Union(idx.Entries.Keys, t.Keys))
            {
                if (!specs.Any(s => SpecMatch(s, p))) continue;
                if (!string.IsNullOrEmpty(t[p])) idx.Entries[p] = t[p];
                else idx.Entries.Delete(p);
                idx.Unmerged.Delete(p);
            }
            WriteIndex(r, idx);
            PrintUnstaged(r, o.Has("quiet"));
            return 0;
        }
        var target = rev == "HEAD" && string.IsNullOrEmpty(head.Hash)
            ? null
            : (ResolveCommit(r, rev) ?? throw Fatal($"ambiguous argument '{rev}': unknown revision or path not in the working tree."));
        var tree = CommitTree(r, target);
        if (o.Has("hard"))
        {
            NeedWork(r);
            SwitchTree(r, CommitTree(r, head.Hash), tree, "checkout", true);
        }
        else if (!o.Has("soft"))
        {
            WriteIndex(r, new Index { Entries = tree.Copy(), Unmerged = new JsMap<Unmerged>() });
        }
        foreach (var f in new[] { "MERGE_HEAD", "MERGE_MSG", "MERGE_MODE" }) RemoveFile(g, Gpath(r, f));
        if (!string.IsNullOrEmpty(target) && target != head.Hash) MoveHead(r, target, $"reset: moving to {rev}");
        if (o.Has("hard"))
        {
            if (!string.IsNullOrEmpty(target) && !o.Has("quiet")) g.Out($"HEAD is now at {Short(target)} {Subject(ReadCommit(r, target))}\n");
        }
        else if (!o.Has("soft") && r.Root is not null) PrintUnstaged(r, o.Has("quiet"));
        return 0;
    }

    private static void PrintUnstaged(Repo r, bool quiet)
    {
        if (quiet) return;
        var s = ComputeStatus(r);
        if (s.Unstaged.Count == 0) return;
        r.G.Out($"Unstaged changes after reset:\n{string.Concat(s.Unstaged.Select(c => $"{c.Status}\t{c.Path}\n"))}");
    }
}
