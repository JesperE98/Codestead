namespace Codestead.Shell.Commands;

// git pull.

public static partial class GitCmd
{
    private static int CmdPull(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "ff-only", "no-ff", "rebase", "no-rebase", "q|quiet" }, "pull");
        var r = NeedRepo(g);
        NeedWork(r);
        var head = ReadHead(r);
        if (o.Has("rebase"))
        {
            g.Note("git.pullRebaseUnsupported");
            return 1;
        }
        var up = !string.IsNullOrEmpty(head.Branch) ? UpstreamOf(r, head.Branch) : null;
        var remote = (o.Operands.Count > 0 ? o.Operands[0] : null) ?? up?.Remote;
        if (string.IsNullOrEmpty(remote))
        {
            throw Fail(
                $"There is no tracking information for the current branch.\nPlease specify which branch you want to merge with.\nSee git-pull(1) for details.\n\n    git pull <remote> <branch>\n\nIf you wish to set tracking information for this branch you can do so with:\n\n    git branch --set-upstream-to=origin/<branch> {head.Branch ?? ""}",
                1);
        }
        int code = FetchRemote(r, remote);
        if (code != 0) return code;
        var branch = (o.Operands.Count > 1 ? o.Operands[1] : null) ?? (up is not null && up.Remote == remote ? up.Ref.Slice($"refs/remotes/{remote}/".Length) : head.Branch);
        var @ref = $"refs/remotes/{remote}/{branch}";
        var theirs = ReadRef(r, @ref) ?? (!string.IsNullOrEmpty(RemoteUrl(r, remote)) ? null : ReadText(g, Gpath(r, "FETCH_HEAD"))?.Split('\t')[0]);
        if (string.IsNullOrEmpty(theirs)) throw Fatal($"couldn't find remote ref {branch}");
        return MergeInto(r, theirs, $"{remote}/{branch}", new MergeOpts { FfOnly = o.Has("ff-only"), NoFf = o.Has("no-ff"), ReflogName = $"{remote}/{branch}" });
    }
}
