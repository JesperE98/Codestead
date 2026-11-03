namespace Codestead.Shell.Commands;

// git checkout.

public static partial class GitCmd
{
    private static int CmdCheckout(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "b=", "B=", "f|force", "q|quiet", "detach", "ours", "theirs", "t|track" }, "checkout");
        var r = NeedRepo(g);
        NeedWork(r);
        var create = o.Get("b") ?? o.Get("B");
        if (!string.IsNullOrEmpty(create))
        {
            CheckBranchName(g, create);
            if (BranchExists(r, create) && !o.Has("B")) throw Fatal($"a branch named '{create}' already exists");
            var start = o.Operands.Count > 0 ? o.Operands[0] : null;
            var track = !string.IsNullOrEmpty(start) && !string.IsNullOrEmpty(ReadRef(r, $"refs/remotes/{start}")) ? start : null;
            return DoSwitch(r, new SwitchTarget { Create = create, StartRev = start, Force = o.Has("force"), Track = track });
        }
        if (o.Paths is not null || o.Has("ours") || o.Has("theirs"))
        {
            var source = o.Operands.Count > 0 ? o.Operands[0] : null;
            var paths = o.Paths ?? o.Operands;
            if (o.Paths is not null && o.Operands.Count > 1) throw Fatal("only one reference expected");
            if (paths.Count == 0) throw Fatal("you must specify path(s) to restore");
            return RestorePaths(r, paths, new RestoreOpts
            {
                Worktree = true,
                Staged = !string.IsNullOrEmpty(source) && o.Paths is not null,
                Source = o.Paths is not null ? source : null,
                Ours = o.Has("ours"),
                Theirs = o.Has("theirs"),
                CheckoutStyle = true,
            });
        }
        var name = o.Operands.Count > 0 ? o.Operands[0] : null;
        if (string.IsNullOrEmpty(name)) return 0;
        if (name == "-") name = PreviousBranch(r) ?? throw Fatal("invalid reference: @{-1}");
        if (o.Operands.Count == 1)
        {
            if (ExistsAt(g, Gpath(r, "MERGE_HEAD")) && !o.Has("force") && (BranchExists(r, name) || ResolveCommit(r, name) is not null))
            {
                throw Fail("error: you need to resolve your current index first");
            }
            if (BranchExists(r, name) && !o.Has("detach")) return DoSwitch(r, new SwitchTarget { Branch = name, Force = o.Has("force") });
            var h = ResolveCommit(r, name);
            if (h is not null) return DoSwitch(r, new SwitchTarget { Detach = h, StartRev = name, Force = o.Has("force") });
            var remote = RemoteGuess(r, name);
            if (remote is not null) return DoSwitch(r, new SwitchTarget { Create = name, StartRev = remote, Track = remote, Force = o.Has("force") });
        }
        // Otherwise they are files: bring back the version from the index.
        bool isRev = o.Operands.Count > 1 && ResolveCommit(r, o.Operands[0]) is not null;
        var files = isRev ? o.Operands.Skip(1).ToList() : o.Operands;
        return RestorePaths(r, files, new RestoreOpts { Worktree = true, Staged = isRev, Source = isRev ? o.Operands[0] : null, CheckoutStyle = true });
    }
}
