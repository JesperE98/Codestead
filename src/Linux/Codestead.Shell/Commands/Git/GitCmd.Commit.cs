namespace Codestead.Shell.Commands;

// git commit.

public static partial class GitCmd
{
    private static int CmdCommit(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "m|message=", "a|all", "amend", "allow-empty", "q|quiet", "no-edit", "v|verbose", "F|file=", "e|edit" }, "commit");
        var r = NeedRepo(g);
        NeedWork(r);
        var id = Identity(g, r)!;
        var head = ReadHead(r);
        var idx = ReadIndex(r);
        var mergeHead = ReadText(g, Gpath(r, "MERGE_HEAD"))?.Trim();
        if (idx.Unmerged.Count > 0)
        {
            throw Fail(
                "error: Committing is not possible because you have unmerged files.\nhint: Fix them up in the work tree, and then use 'git add/rm <file>'\nhint: as appropriate to mark resolution and make a commit.\nfatal: Exiting because of an unresolved conflict.",
                128);
        }
        if (o.Has("amend") && string.IsNullOrEmpty(head.Hash)) throw Fatal("You have nothing to amend.");
        if (o.Has("amend") && !string.IsNullOrEmpty(mergeHead)) throw Fatal("You are in the middle of a merge -- cannot amend.");
        var paths = o.Operands.Concat(o.Paths ?? new List<string>()).ToList();
        if (o.Has("all") || paths.Count > 0)
        {
            if (o.Has("all") && paths.Count > 0) throw Fatal("paths with -a does not make sense.");
            if (!string.IsNullOrEmpty(mergeHead) && paths.Count > 0) throw Fatal("cannot do a partial commit during a merge.");
            var work = ScanWork(r);
            var specs = paths.Select(p => ToSpec(r, p)).ToList();
            var used = new HashSet<Spec>();
            foreach (var p in idx.Entries.Keys)
            {
                var hit = specs.Where(s => SpecMatch(s, p)).ToList();
                if (specs.Count > 0 && hit.Count == 0) continue;
                foreach (var s in hit) used.Add(s);
                var w = work.Get(p);
                if (w is not null)
                {
                    WriteObj(r, "blob", w.Content);
                    idx.Entries[p] = w.Hash;
                }
                else idx.Entries.Delete(p);
            }
            foreach (var s in specs)
                if (!used.Contains(s)) throw Fail($"error: pathspec '{s.Raw}' did not match any file(s) known to git");
        }
        string? message;
        var ms = o.GetAll("message");
        if (ms is not null) message = string.Join("\n\n", ms);
        else if (o.Get("file") is not null)
        {
            var f = o.Get("file")!;
            message = f == "-" ? (g.Ctx.Stdin ?? "") : (ReadText(g, VfsLib.ResolvePath(g.Cwd, f)) ?? throw Fatal($"could not read log file '{f}': No such file or directory"));
        }
        else if (o.Has("amend")) message = ReadCommit(r, head.Hash!).Message;
        else if (!string.IsNullOrEmpty(mergeHead))
        {
            message = ReadText(g, Gpath(r, "MERGE_MSG")) ?? $"Merge commit '{mergeHead}'\n";
            g.Note("git.mergeMsgUsed");
        }
        else
        {
            g.Note("git.commitNoEditor");
            g.Err("Aborting commit due to empty commit message.\n");
            return 1;
        }
        message = CleanMessage(message);
        if (message == "")
        {
            g.Err("Aborting commit due to empty commit message.\n");
            return 1;
        }
        var parents = o.Has("amend") ? new List<string>(ReadCommit(r, head.Hash!).Parents) : !string.IsNullOrEmpty(head.Hash) ? new List<string> { head.Hash } : new List<string>();
        if (!string.IsNullOrEmpty(mergeHead)) parents.Add(mergeHead);
        var tree = WriteTree(r, idx.Entries);
        var parentTree = parents.Count > 0 && parents[0] != "" ? ReadCommit(r, parents[0]).Tree : WriteTree(r, new JsMap<string>());
        if (tree == (!string.IsNullOrEmpty(head.Hash) ? ReadCommit(r, head.Hash).Tree : "") && !o.Has("allow-empty") && string.IsNullOrEmpty(mergeHead) && !o.Has("amend"))
        {
            WriteIndex(r, idx);
            PrintLongStatus(r, ComputeStatus(r));
            return 1;
        }
        if (string.IsNullOrEmpty(head.Hash) && idx.Entries.Count == 0 && !o.Has("allow-empty"))
        {
            PrintLongStatus(r, ComputeStatus(r));
            return 1;
        }
        WriteIndex(r, idx);
        var author = o.Has("amend") ? ReadCommit(r, head.Hash!).Author : id;
        var h = WriteCommit(r, new Commit { Tree = tree, Parents = parents, Author = author, Committer = id, Message = message });
        var kind = o.Has("amend") ? " (amend)" : !string.IsNullOrEmpty(mergeHead) ? " (merge)" : parents.Count == 0 ? " (initial)" : "";
        MoveHead(r, h, $"commit{kind}: {Subject(message)}");
        RemoveFile(g, Gpath(r, "MERGE_HEAD"));
        RemoveFile(g, Gpath(r, "MERGE_MSG"));
        RemoveFile(g, Gpath(r, "MERGE_MODE"));
        if (o.Has("quiet")) return 0;
        var where = head.Branch ?? "detached HEAD";
        var res = $"[{where}{(parents.Count > 0 ? "" : " (root-commit)")} {Short(h)}] {message.Split('\n')[0]}\n";
        if (o.Has("amend")) res += $" Date: {FmtDate(author)}\n";
        res += StatText(r, TreeChanges(ReadTree(r, parentTree), idx.Entries), true);
        g.Out(res);
        return 0;
    }
}
