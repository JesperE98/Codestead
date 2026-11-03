namespace Codestead.Shell.Commands;

// Helpers for the chapter checks: the state of a repository as seen by the tasks.

public static partial class GitCmd
{
    /// <summary>Opens the repository in `dir` as root (for task checks and tests).</summary>
    private static Repo? RepoFor(Shell sh, string dir)
    {
        var g = MakeG(new CmdCtx(new IO(_ => { }, _ => { }), sh, "git", new List<string>()));
        g.User = sh.RootUser();
        return LooksLikeGitDir(g, Join(dir, ".git")) ? OpenRepo(g, Join(dir, ".git"), dir) : null;
    }

    /// <summary>A summary of the repository in the directory `dir`, or null if there is no repository there.</summary>
    public static RepoState? GitRepoState(Shell sh, string dir)
    {
        try
        {
            var r = RepoFor(sh, dir);
            if (r is null) return null;
            var head = ReadHead(r);
            var branches = Js.Obj<string>();
            foreach (var b in ListRefs(r, "refs/heads/")) branches[b] = ReadRef(r, $"refs/heads/{b}")!;
            return new RepoState { Branch = head.Branch, Head = head.Hash, Branches = branches, Files = CommitTree(r, head.Hash).Keys, Commits = Ancestors(r, head.Hash).Count };
        }
        catch (Exception)
        {
            return null;
        }
    }

    /// <summary>True if the commit `a` is in the history behind `b` (or is `b`).</summary>
    public static bool GitIsAncestor(Shell sh, string dir, string a, string b)
    {
        try
        {
            var r = RepoFor(sh, dir);
            return r is not null && IsAncestor(r, a, b);
        }
        catch (Exception)
        {
            return false;
        }
    }

    /// <summary>The value of a key in the global git configuration (~/.gitconfig) of the user with the home `home`.</summary>
    public static string? GitGlobalConfig(Shell sh, string home, string key)
    {
        var text = sh.Vfs.TryLookup($"{home}/.gitconfig", sh.RootUser())?.Content ?? "";
        var k = SplitKey(key);
        if (k is null) return null;
        return ParseConfig(text).Where(e => e.Key == NormKey(k)).LastOrDefault()?.Value;
    }
}
