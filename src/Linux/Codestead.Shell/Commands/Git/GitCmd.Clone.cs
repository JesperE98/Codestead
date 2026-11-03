namespace Codestead.Shell.Commands;

// git clone.

public static partial class GitCmd
{
    private static readonly Regex TrailingSlashesRe = new("/+\\z", RO);
    private static readonly Regex SlashDotGitRe = new("/\\.git\\z", RO);
    private static readonly Regex DotGitRe = new("\\.git\\z", RO);
    private static readonly Regex SlashColonRe = new("[/:]", RO);

    private static int CmdClone(G g, List<string> args)
    {
        // Packages from AUR (git clone https://aur.archlinux.org/PACKAGE.git) – see ReposCmd.
        var aur = ReposCmd.AurClone(g.Ctx, args);
        if (aur is not null) return aur.Value;
        var o = ParseArgs(args, new[] { "q|quiet", "bare", "b|branch=", "o|origin=", "depth=" }, "clone");
        var url = o.Operands.Count > 0 ? o.Operands[0] : null;
        var dirArg = o.Operands.Count > 1 ? o.Operands[1] : null;
        if (string.IsNullOrEmpty(url)) throw Fail("fatal: You must specify a repository to clone.\n\nusage: git clone [<options>] [--] <repo> [<dir>]", 129);
        var name = dirArg ?? DotGitRe.Replace(SlashColonRe.Split(SlashDotGitRe.Replace(TrailingSlashesRe.Replace(url, "", 1), "", 1))[^1], "", 1) + (o.Has("bare") ? ".git" : "");
        var dest = VfsLib.ResolvePath(g.Cwd, ExpandTilde(g, name));
        var destNode = g.Sh.Vfs.TryLookup(dest, g.User);
        if (destNode is not null && (destNode.Type != "dir" || (destNode.Children?.Count ?? 0) > 0)) throw Fatal($"destination path '{dirArg ?? name}' already exists and is not an empty directory.");
        if (!o.Has("quiet")) g.Err($"Cloning into {(o.Has("bare") ? "bare repository " : "")}'{dirArg ?? name}'...\n");
        if (IsNetworkUrl(url)) return NetworkError(g, url, "clone");
        var src = OpenRemote(g, url);
        if (src is null)
        {
            if (!ExistsAt(g, VfsLib.ResolvePath(g.Cwd, ExpandTilde(g, url)))) throw Fatal($"repository '{url}' does not exist");
            g.Err($"fatal: '{url}' does not appear to be a git repository\n{NotARepoTail}");
            return 128;
        }
        var srcHead = ReadHead(src);
        var branch = o.Get("branch") ?? srcHead.Branch ?? "main";
        if (!string.IsNullOrEmpty(o.Get("branch")) && string.IsNullOrEmpty(ReadRef(src, $"refs/heads/{branch}"))) throw Fatal($"Remote branch {branch} not found in upstream origin");
        var (gitDir, _) = InitRepo(g, dest, o.Has("bare"), branch);
        var r = OpenRepo(g, gitDir, o.Has("bare") ? null : dest);
        var remote = o.Get("origin") ?? "origin";
        var abs = src.Root ?? src.GitDir;
        CopyObjects(src, r);
        if (o.Has("bare"))
        {
            foreach (var b in ListRefs(src, "refs/heads/")) WriteRef(r, $"refs/heads/{b}", ReadRef(src, $"refs/heads/{b}")!);
            foreach (var t in ListRefs(src, "refs/tags/")) WriteRef(r, $"refs/tags/{t}", ReadRef(src, $"refs/tags/{t}")!);
            if (!o.Has("quiet")) g.Err("done.\n");
            return 0;
        }
        var cfg = Gpath(r, "config");
        SetConfig(g, cfg, $"remote.{remote}.url", abs);
        SetConfig(g, cfg, $"remote.{remote}.fetch", $"+refs/heads/*:refs/remotes/{remote}/*");
        FetchRemote(r, remote, true);
        foreach (var t in ListRefs(src, "refs/tags/")) WriteRef(r, $"refs/tags/{t}", ReadRef(src, $"refs/tags/{t}")!);
        var h = ReadRef(src, $"refs/heads/{branch}");
        if (!string.IsNullOrEmpty(h))
        {
            WriteRef(r, $"refs/heads/{branch}", h);
            SetConfig(g, cfg, $"branch.{branch}.remote", remote);
            SetConfig(g, cfg, $"branch.{branch}.merge", $"refs/heads/{branch}");
            var tree = CommitTree(r, h);
            foreach (var p in tree.Keys) WriteWorkFile(r, p, ReadBlob(r, tree[p]!));
            WriteIndex(r, new Index { Entries = tree.Copy(), Unmerged = new JsMap<Unmerged>() });
            Reflog(r, null, h, $"clone: from {abs}");
            if (!o.Has("quiet")) g.Err("done.\n");
        }
        else g.Err("warning: You appear to have cloned an empty repository.\n");
        return 0;
    }
}
