namespace Codestead.Shell.Commands;

// Helpers shared by several of the local subcommands (init, commit, log, restore, switch, merge).

public static partial class GitCmd
{
    private const string Exclude =
        "# git ls-files --others --exclude-from=.git/info/exclude\n" +
        "# Lines that start with '#' are comments.\n" +
        "# For a project mostly in C, the following would be a good set of\n" +
        "# exclude patterns (uncomment them if you want to use them):\n" +
        "# *.[oa]\n" +
        "# *~\n";

    /// <summary>Creates a new repository. Existed is true if it was already there.</summary>
    private static (string GitDir, bool Existed) InitRepo(G g, string dir, bool bare, string branch)
    {
        var gitDir = bare ? dir : Join(dir, ".git");
        Mkdirp(g, dir);
        if (LooksLikeGitDir(g, gitDir)) return (gitDir, true);
        Mkdirp(g, gitDir);
        foreach (var d in new[] { "objects/info", "objects/pack", "refs/heads", "refs/tags", "hooks", "info" }) Mkdirp(g, $"{gitDir}/{d}");
        WriteText(g, $"{gitDir}/HEAD", $"ref: refs/heads/{branch}\n");
        WriteText(
            g,
            $"{gitDir}/config",
            $"[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = {(bare ? "true" : "false")}\n{(bare ? "" : "\tlogallrefupdates = true\n")}");
        WriteText(g, $"{gitDir}/description", "Unnamed repository; edit this file 'description' to name the repository.\n");
        WriteText(g, $"{gitDir}/info/exclude", Exclude);
        return (gitDir, false);
    }

    // commit

    private static readonly Regex TrailingWsAnyRe = new("\\s+\\z", RO);

    private static string CleanMessage(string msg)
    {
        var lines = msg.Split('\n').Where(l => !l.StartsWith('#')).Select(l => TrailingWsAnyRe.Replace(l, "", 1)).ToList();
        while (lines.Count > 0 && lines[0] == "") lines.RemoveAt(0);
        while (lines.Count > 0 && lines[^1] == "") lines.RemoveAt(lines.Count - 1);
        var res = new List<string>();
        foreach (var l in lines)
            if (!(l == "" && res.Count > 0 && res[^1] == "")) res.Add(l);
        return res.Count > 0 ? string.Join("\n", res) + "\n" : "";
    }

    // log

    private sealed record Deco(string Text, string Color);

    private static Dictionary<string, List<Deco>> Decorations(Repo r)
    {
        var map = new Dictionary<string, List<Deco>>(StringComparer.Ordinal);
        void Add(string? h, string text, string color)
        {
            if (string.IsNullOrEmpty(h)) return;
            if (!map.TryGetValue(h, out var list)) map[h] = list = new List<Deco>();
            list.Add(new Deco(text, color));
        }
        var head = ReadHead(r);
        if (!string.IsNullOrEmpty(head.Branch)) Add(head.Hash, $"HEAD -> {head.Branch}", "head");
        else Add(head.Hash, "HEAD", Col.BoldCyan);
        foreach (var b in ListRefs(r, "refs/heads/"))
            if (b != head.Branch) Add(ReadRef(r, $"refs/heads/{b}"), b, Col.BoldGreen);
        foreach (var b in ListRefs(r, "refs/remotes/")) Add(ReadRef(r, $"refs/remotes/{b}"), b, Col.BoldRed);
        foreach (var t in ListRefs(r, "refs/tags/"))
        {
            var h = ReadRef(r, $"refs/tags/{t}");
            Add(!string.IsNullOrEmpty(h) ? Peel(r, h) : null, $"tag: {t}", Col.BoldYellow);
        }
        return map;
    }

    private static string Decorate(G g, Dictionary<string, List<Deco>>? map, string h)
    {
        List<Deco>? list = null;
        map?.TryGetValue(h, out list);
        if (list is null || list.Count == 0) return "";
        var parts = list.Select(d =>
        {
            if (d.Color == "head")
            {
                var segs = d.Text.Split(" -> ");
                var b = segs.Length > 1 ? segs[1] : "";
                return $"{g.C(Col.BoldCyan, "HEAD")}{g.C(Col.Yellow, " -> ")}{g.C(Col.BoldGreen, b)}";
            }
            return g.C(d.Color, d.Text);
        });
        return $" {g.C(Col.Yellow, "(")}{string.Join(g.C(Col.Yellow, ", "), parts)}{g.C(Col.Yellow, ")")}";
    }

    private static List<string> CommitHeader(Repo r, Commit c, Dictionary<string, List<Deco>>? deco)
    {
        var g = r.G;
        var lines = new List<string> { $"{g.C(Col.Yellow, $"commit {c.Hash}")}{Decorate(g, deco, c.Hash)}" };
        if (c.Parents.Count > 1) lines.Add($"Merge: {string.Join(" ", c.Parents.Select(Short))}");
        lines.Add($"Author: {c.Author.Name} <{c.Author.Email}>");
        lines.Add($"Date:   {FmtDate(c.Author)}");
        lines.Add("");
        var msg = c.Message.EndsWith('\n') ? c.Message[..^1] : c.Message;
        foreach (var l in msg.Split('\n')) lines.Add(l != "" ? $"    {l}" : "");
        return lines;
    }

    private static readonly Regex RangeSepRe = new("\\.{2,3}", RO);

    /// <summary>Splits the arguments into revisions and paths, like real git.</summary>
    private static (List<string> Revs, List<string> Paths) RevsAndPaths(Repo r, Parsed o)
    {
        var revs = new List<string>();
        var paths = new List<string>(o.Paths ?? new List<string>());
        foreach (var a in o.Operands)
        {
            var range = a.Contains("..") ? RangeSepRe.Split(a).ToList() : new List<string> { a };
            bool isRev = range.All(x => x == "" || ResolveRev(r, x) is not null);
            if (isRev && paths.Count == 0) revs.Add(a);
            else if (r.Root is not null && ExistsAt(r.G, VfsLib.ResolvePath(r.G.Cwd, a))) paths.Add(a);
            else if (r.Root is not null && o.Paths is null && ReadIndex(r).Entries.Keys.Any(p => SpecMatch(ToSpec(r, a), p))) paths.Add(a);
            else
                throw Fail(
                    $"fatal: ambiguous argument '{a}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'",
                    128);
        }
        return (revs, paths);
    }

    private static int SliceEnd(double limit) =>
        double.IsNaN(limit) ? 0 : limit >= int.MaxValue ? int.MaxValue : limit <= int.MinValue ? int.MinValue : (int)Math.Truncate(limit);

    // restore / checkout of files

    private sealed class RestoreOpts
    {
        public bool Staged;
        public bool Worktree;
        public string? Source;
        public bool Ours;
        public bool Theirs;
        public bool CheckoutStyle;
    }

    private static int RestorePaths(Repo r, List<string> pathspecs, RestoreOpts opts)
    {
        var g = r.G;
        var specs = pathspecs.Select(p => ToSpec(r, p)).ToList();
        var idx = ReadIndex(r);
        var head = ReadHead(r);
        JsMap<string>? source = null;
        if (!string.IsNullOrEmpty(opts.Source)) source = RevTree(r, opts.Source) ?? throw Fatal($"could not resolve {opts.Source}");
        else if (opts.Staged) source = CommitTree(r, head.Hash);
        var work = ScanWork(r);
        var known = Union(idx.Entries.Keys, idx.Unmerged.Keys, source?.Keys ?? new List<string>());
        int count = 0;
        foreach (var spec in specs)
        {
            var hits = known.Where(p => SpecMatch(spec, p)).ToList();
            if (hits.Count == 0) throw Fail($"error: pathspec '{spec.Raw}' did not match any file(s) known to git");
            foreach (var p in SortedOrdinal(hits))
            {
                var u = idx.Unmerged[p];
                if (opts.Worktree)
                {
                    if (u is not null && string.IsNullOrEmpty(opts.Source))
                    {
                        var side = opts.Ours ? u.Ours : opts.Theirs ? u.Theirs : null;
                        if (!opts.Ours && !opts.Theirs) throw Fail($"error: path '{Show(r, p)}' is unmerged");
                        if (string.IsNullOrEmpty(side)) throw Fail($"error: path '{Show(r, p)}' does not have {(opts.Ours ? "our" : "their")} version");
                        WriteWorkFile(r, p, ReadBlob(r, side));
                        count++;
                        continue;
                    }
                    var want = source is not null ? source[p] : idx.Entries[p];
                    if (want is null)
                    {
                        if (source is not null && idx.Entries.Has(p) && work.Files.ContainsKey(p))
                        {
                            RemoveWorkFile(r, p);
                            count++;
                        }
                    }
                    else if (work.Get(p)?.Hash != want)
                    {
                        WriteWorkFile(r, p, ReadBlob(r, want));
                        count++;
                    }
                    else count++;
                }
                if (opts.Staged)
                {
                    var want = source![p];
                    if (want is null) idx.Entries.Delete(p);
                    else idx.Entries[p] = want;
                    idx.Unmerged.Delete(p);
                }
            }
        }
        WriteIndex(r, idx);
        if (opts.CheckoutStyle) g.Err($"Updated {count} path{(count == 1 ? "" : "s")} from {(!string.IsNullOrEmpty(opts.Source) ? "the tree" : "the index")}\n");
        return 0;
    }

    // switch / checkout

    private static void DetachedAdvice(G g, Repo r, string h, string rev)
    {
        if (ConfigBool(GetConfig(g, r, "advice.detachedHead"), true))
        {
            g.Err(
                $"Note: switching to '{rev}'.\n\nYou are in 'detached HEAD' state. You can look around, make experimental\nchanges and commit them, and you can discard any commits you make in this\nstate without impacting any branches by switching back to a branch.\n\nIf you want to create a new branch to retain commits you create, you may\ndo so (now or later) by using -c with the switch command. Example:\n\n  git switch -c <new-branch-name>\n\nOr undo this operation with:\n\n  git switch -\n\nTurn off this advice by setting config variable advice.detachedHead to false\n\n");
        }
        g.Err($"HEAD is now at {Short(h)} {Subject(ReadCommit(r, h))}\n");
    }

    private sealed class SwitchTarget
    {
        public string? Branch;
        public string? Create;
        public string? Detach;
        public bool Force;
        public string? StartRev;
        public string? Track;
    }

    /// <summary>Switches branch (or to a detached commit) and updates the work tree.</summary>
    private static int DoSwitch(Repo r, SwitchTarget target)
    {
        var g = r.G;
        var head = ReadHead(r);
        var fromName = head.Branch ?? head.Hash ?? "HEAD";
        string? newHash;
        if (!string.IsNullOrEmpty(target.Create))
        {
            newHash = !string.IsNullOrEmpty(target.StartRev) ? NeedCommit(r, target.StartRev) : head.Hash;
        }
        else if (!string.IsNullOrEmpty(target.Branch))
        {
            newHash = ReadRef(r, $"refs/heads/{target.Branch}");
        }
        else newHash = target.Detach;
        if (!string.IsNullOrEmpty(target.Branch) && target.Branch == head.Branch && string.IsNullOrEmpty(target.Create))
        {
            g.Err($"Already on '{target.Branch}'\n");
            if (!string.IsNullOrEmpty(head.Hash)) g.Err(TrackingText(r, head.Branch!, head.Hash));
            return 0;
        }
        if (!string.IsNullOrEmpty(newHash) && newHash != head.Hash) SwitchTree(r, CommitTree(r, head.Hash), CommitTree(r, newHash), "checkout", target.Force);
        else if (target.Force && !string.IsNullOrEmpty(newHash)) SwitchTree(r, CommitTree(r, head.Hash), CommitTree(r, newHash), "checkout", true);
        if (!string.IsNullOrEmpty(target.Create))
        {
            if (!string.IsNullOrEmpty(newHash)) WriteRef(r, $"refs/heads/{target.Create}", newHash);
            SetHeadBranch(r, target.Create);
            if (!string.IsNullOrEmpty(target.Track))
            {
                var segs = target.Track.Split('/');
                SetConfig(g, Gpath(r, "config"), $"branch.{target.Create}.remote", segs[0]);
                SetConfig(g, Gpath(r, "config"), $"branch.{target.Create}.merge", $"refs/heads/{string.Join("/", segs.Skip(1))}");
                g.Out($"branch '{target.Create}' set up to track '{target.Track}'.\n");
            }
        }
        else if (!string.IsNullOrEmpty(target.Branch)) SetHeadBranch(r, target.Branch);
        else SetHeadDetached(r, newHash!);
        var toName = target.Create ?? target.Branch ?? newHash!;
        if (!string.IsNullOrEmpty(newHash)) Reflog(r, head.Hash, newHash, $"checkout: moving from {fromName} to {toName}");
        // Local changes that are carried along are shown like in real git.
        if (r.Root is not null)
        {
            var s = ComputeStatus(r);
            var changed = new Dictionary<string, char>(StringComparer.Ordinal);
            foreach (var ch in s.Staged) changed[ch.Path] = ch.Status == 'R' ? 'A' : ch.Status;
            foreach (var ch in s.Unstaged) changed[ch.Path] = ch.Status;
            foreach (var p in SortedOrdinal(changed.Keys)) g.Out($"{changed[p]}\t{Show(r, p)}\n");
        }
        if (!string.IsNullOrEmpty(target.Detach))
        {
            DetachedAdvice(g, r, newHash!, target.StartRev ?? Short(newHash!));
            return 0;
        }
        if (string.IsNullOrEmpty(head.Branch) && !string.IsNullOrEmpty(head.Hash) && string.IsNullOrEmpty(target.Create))
            g.Err($"Previous HEAD position was {Short(head.Hash)} {Subject(ReadCommit(r, head.Hash))}\n");
        g.Err(!string.IsNullOrEmpty(target.Create) ? $"Switched to a new branch '{target.Create}'\n" : $"Switched to branch '{target.Branch}'\n");
        var nb = target.Create ?? target.Branch!;
        var h = ReadRef(r, $"refs/heads/{nb}");
        if (!string.IsNullOrEmpty(h)) g.Out(TrackingText(r, nb, h));
        return 0;
    }

    /// <summary>If only origin/&lt;name&gt; exists, git creates a local branch that tracks it.</summary>
    private static string? RemoteGuess(Repo r, string name)
    {
        var hits = ListRefs(r, "refs/remotes/").Where(x => string.Join("/", x.Split('/').Skip(1)) == name).ToList();
        return hits.Count == 1 ? hits[0] : null;
    }

    // merge

    private sealed class MergeOpts
    {
        public bool NoFf;
        public bool FfOnly;
        public string? Message;
        public string ReflogName = "";
    }

    private static int MergeInto(Repo r, string theirs, string label, MergeOpts opts)
    {
        var g = r.G;
        var head = ReadHead(r);
        if (string.IsNullOrEmpty(head.Hash))
        {
            // Empty branch: the "merge" just points at the other commit.
            SwitchTree(r, new JsMap<string>(), CommitTree(r, theirs), "merge");
            MoveHead(r, theirs, $"merge {opts.ReflogName}: Fast-forward");
            return 0;
        }
        if (head.Hash == theirs || IsAncestor(r, theirs, head.Hash))
        {
            g.Out("Already up to date.\n");
            return 0;
        }
        var @base = MergeBase(r, head.Hash, theirs);
        var ourTree = CommitTree(r, head.Hash);
        var theirTree = CommitTree(r, theirs);
        if (@base == head.Hash && !opts.NoFf)
        {
            SwitchTree(r, ourTree, theirTree, "merge");
            MoveHead(r, theirs, $"merge {opts.ReflogName}: Fast-forward");
            g.Out($"Updating {Short(head.Hash)}..{Short(theirs)}\nFast-forward\n{StatText(r, TreeChanges(ourTree, theirTree), false)}");
            return 0;
        }
        if (opts.FfOnly)
        {
            g.Hint("Diverging branches can't be fast-forwarded, you need to either:\n\n\tgit merge --no-ff\n\nor:\n\n\tgit rebase\n\nDisable this message with \"git config set advice.diverging false\"");
            throw Fatal("Not possible to fast-forward, aborting.");
        }
        var baseTree = CommitTree(r, @base);
        var result = new JsMap<string>();
        var unmerged = new JsMap<Unmerged>();
        var conflictFiles = new JsMap<string>();
        var messages = new List<string>();
        var paths = SortedOrdinal(Union(baseTree.Keys, ourTree.Keys, theirTree.Keys));
        foreach (var p in paths)
        {
            var b = baseTree[p];
            var o = ourTree[p];
            var t = theirTree[p];
            if (o == t || t == b)
            {
                if (!string.IsNullOrEmpty(o)) result[p] = o;
                continue;
            }
            if (o == b)
            {
                if (!string.IsNullOrEmpty(t)) result[p] = t;
                continue;
            }
            // Both sides changed the file.
            if (string.IsNullOrEmpty(o) || string.IsNullOrEmpty(t))
            {
                var deletedIn = string.IsNullOrEmpty(o) ? "HEAD" : label;
                var modifiedIn = string.IsNullOrEmpty(o) ? label : "HEAD";
                messages.Add($"CONFLICT (modify/delete): {p} deleted in {deletedIn} and modified in {modifiedIn}.  Version {modifiedIn} of {p} left in tree.");
                unmerged[p] = new Unmerged { Base = b, Ours = o, Theirs = t };
                conflictFiles[p] = ReadBlob(r, (o ?? t)!);
                if (!string.IsNullOrEmpty(o)) result[p] = o;
                continue;
            }
            messages.Add($"Auto-merging {p}");
            var m = Merge3(!string.IsNullOrEmpty(b) ? ReadBlob(r, b) : "", ReadBlob(r, o), ReadBlob(r, t), "HEAD", label);
            if (m.Conflict)
            {
                messages.Add($"CONFLICT ({(!string.IsNullOrEmpty(b) ? "content" : "add/add")}): Merge conflict in {p}");
                unmerged[p] = new Unmerged { Base = b, Ours = o, Theirs = t };
                conflictFiles[p] = m.Text;
                result[p] = o;
            }
            else result[p] = WriteObj(r, "blob", m.Text);
        }
        // Check local changes before anything is written.
        var idx = SwitchTree(r, ourTree, result, "merge", false, unmerged.Keys);
        foreach (var p in conflictFiles.Keys) WriteWorkFile(r, p, conflictFiles[p]!);
        foreach (var p in unmerged.Keys)
        {
            idx.Unmerged[p] = unmerged[p];
            if (string.IsNullOrEmpty(unmerged[p]!.Ours)) idx.Entries.Delete(p);
        }
        WriteIndex(r, idx);
        var into = !string.IsNullOrEmpty(head.Branch) && head.Branch is not ("main" or "master") ? $" into {head.Branch}" : "";
        var message = !string.IsNullOrEmpty(opts.Message)
            ? CleanMessage(opts.Message)
            : $"Merge {(label.StartsWith("origin/", StringComparison.Ordinal) || label.Contains('/') ? "remote-tracking branch" : "branch")} '{label}'{into}\n";
        if (messages.Count > 0) g.Out(string.Concat(messages.Select(m => m + "\n")));
        if (unmerged.Count > 0)
        {
            WriteText(g, Gpath(r, "MERGE_HEAD"), theirs + "\n");
            WriteText(g, Gpath(r, "MERGE_MODE"), opts.NoFf ? "no-ff" : "");
            WriteText(g, Gpath(r, "MERGE_MSG"), $"{message}\n# Conflicts:\n{string.Concat(unmerged.Keys.Select(p => $"#\t{p}\n"))}");
            g.Out("Automatic merge failed; fix conflicts and then commit the result.\n");
            return 1;
        }
        var id = Identity(g, r)!;
        var h = WriteCommit(r, new Commit { Tree = WriteTree(r, result), Parents = new List<string> { head.Hash, theirs }, Author = id, Committer = id, Message = message });
        MoveHead(r, h, $"merge {opts.ReflogName}: Merge made by the 'ort' strategy.");
        g.Out($"Merge made by the 'ort' strategy.\n{StatText(r, TreeChanges(ourTree, result), false)}");
        return 0;
    }
}
