namespace Codestead.Shell.Commands;

// git switch.

public static partial class GitCmd
{
    private static int CmdSwitch(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "c|create=", "C|force-create=", "d|detach", "f|force|discard-changes", "t|track", "q|quiet" }, "switch");
        var r = NeedRepo(g);
        NeedWork(r);
        if (ExistsAt(g, Gpath(r, "MERGE_HEAD")) && !o.Has("force")) throw Fatal("cannot switch branch while merging\nConsider \"git merge --quit\" or \"git worktree add\".");
        var create = o.Get("create") ?? o.Get("force-create");
        if (!string.IsNullOrEmpty(create))
        {
            CheckBranchName(g, create);
            if (BranchExists(r, create) && !o.Has("force-create")) throw Fatal($"a branch named '{create}' already exists");
            var start = o.Operands.Count > 0 ? o.Operands[0] : null;
            var track = !string.IsNullOrEmpty(start) && !string.IsNullOrEmpty(ReadRef(r, $"refs/remotes/{start}")) ? start : null;
            return DoSwitch(r, new SwitchTarget { Create = create, StartRev = start, Force = o.Has("force"), Track = track });
        }
        var name = o.Operands.Count > 0 ? o.Operands[0] : null;
        if (string.IsNullOrEmpty(name)) throw Fatal("missing branch or commit argument");
        if (name == "-") name = PreviousBranch(r) ?? throw Fatal("invalid reference: @{-1}");
        if (o.Has("detach")) return DoSwitch(r, new SwitchTarget { Detach = NeedCommit(r, name), StartRev = name, Force = o.Has("force") });
        if (BranchExists(r, name)) return DoSwitch(r, new SwitchTarget { Branch = name, Force = o.Has("force") });
        if (Hash40Re.IsMatch(name) && ResolveCommit(r, name) is not null) return DoSwitch(r, new SwitchTarget { Detach = name, StartRev = Short(name), Force = o.Has("force") });
        var remote = RemoteGuess(r, name);
        if (remote is not null) return DoSwitch(r, new SwitchTarget { Create = name, StartRev = remote, Track = remote, Force = o.Has("force") });
        if (ResolveCommit(r, name) is not null)
        {
            g.Err($"fatal: a branch is expected, got {(!string.IsNullOrEmpty(ReadRef(r, $"refs/tags/{name}")) ? "tag" : "commit")} '{name}'\n");
            g.Hint("If you want to detach HEAD at the commit, try again with the --detach option.");
            return 128;
        }
        throw Fatal($"invalid reference: {name}");
    }
}
