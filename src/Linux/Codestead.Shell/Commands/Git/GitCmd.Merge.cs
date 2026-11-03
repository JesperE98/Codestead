namespace Codestead.Shell.Commands;

// git merge.

public static partial class GitCmd
{
    private static int CmdMerge(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "no-ff", "ff", "ff-only", "m|message=", "abort", "continue", "no-edit", "e|edit", "q|quiet", "squash" }, "merge");
        var r = NeedRepo(g);
        NeedWork(r);
        var mergeHead = ReadText(g, Gpath(r, "MERGE_HEAD"));
        if (o.Has("abort"))
        {
            if (string.IsNullOrEmpty(mergeHead)) throw Fatal("There is no merge to abort (MERGE_HEAD missing).");
            var head = ReadHead(r);
            var idx = ReadIndex(r);
            var t = CommitTree(r, head.Hash);
            foreach (var p in Union(idx.Entries.Keys, idx.Unmerged.Keys))
            {
                if (!t.Has(p)) RemoveWorkFile(r, p);
            }
            foreach (var p in t.Keys) WriteWorkFile(r, p, ReadBlob(r, t[p]!));
            WriteIndex(r, new Index { Entries = t.Copy(), Unmerged = new JsMap<Unmerged>() });
            foreach (var f in new[] { "MERGE_HEAD", "MERGE_MSG", "MERGE_MODE" }) RemoveFile(g, Gpath(r, f));
            return 0;
        }
        if (o.Has("continue"))
        {
            if (string.IsNullOrEmpty(mergeHead)) throw Fatal("There is no merge in progress (MERGE_HEAD missing).");
            return CmdCommit(g, new List<string>());
        }
        if (!string.IsNullOrEmpty(mergeHead)) throw Fatal("You have not concluded your merge (MERGE_HEAD exists).\nPlease, commit your changes before you merge.");
        if (o.Has("squash"))
        {
            g.Note("git.mergeSquashUnsupported");
            return 1;
        }
        var name = o.Operands.Count > 0 ? o.Operands[0] : null;
        var hd = ReadHead(r);
        if (string.IsNullOrEmpty(name))
        {
            var up = !string.IsNullOrEmpty(hd.Branch) ? UpstreamOf(r, hd.Branch) : null;
            if (up is null) throw Fatal("No remote for the current branch.");
            name = up.Name;
        }
        if (o.Operands.Count > 1)
        {
            g.Note("git.octopusUnsupported");
            return 1;
        }
        if (name == "-") name = PreviousBranch(r) ?? throw Fatal("No previous branch.");
        var theirs = ResolveCommit(r, name) ?? throw Fatal($"{name} - not something we can merge");
        var msgs = o.GetAll("message");
        return MergeInto(r, theirs, name, new MergeOpts
        {
            NoFf = o.Has("no-ff") || GetConfig(g, r, "merge.ff") == "false",
            FfOnly = o.Has("ff-only") || GetConfig(g, r, "merge.ff") == "only",
            Message = msgs is not null ? string.Join("\n\n", msgs) : null,
            ReflogName = name,
        });
    }
}
