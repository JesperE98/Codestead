namespace Codestead.Shell.Commands;

// git restore.

public static partial class GitCmd
{
    private static int CmdRestore(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "S|staged", "W|worktree", "s|source=", "ours", "theirs", "q|quiet" }, "restore");
        var r = NeedRepo(g);
        NeedWork(r);
        var paths = o.Operands.Concat(o.Paths ?? new List<string>()).ToList();
        if (paths.Count == 0) throw Fatal("you must specify path(s) to restore");
        bool staged = o.Has("staged");
        bool worktree = o.Has("worktree") || !staged;
        return RestorePaths(r, paths, new RestoreOpts { Staged = staged, Worktree = worktree, Source = o.Get("source"), Ours = o.Has("ours"), Theirs = o.Has("theirs") });
    }
}
