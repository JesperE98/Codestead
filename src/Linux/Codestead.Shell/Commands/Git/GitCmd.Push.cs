namespace Codestead.Shell.Commands;

// git push.

public static partial class GitCmd
{
    private static int CmdPush(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "u|set-upstream", "f|force", "all", "d|delete", "q|quiet", "tags" }, "push");
        var r = NeedRepo(g);
        var head = ReadHead(r);
        var up = !string.IsNullOrEmpty(head.Branch) ? UpstreamOf(r, head.Branch) : null;
        var remotes = ConfigAll(g, r).Where(e => e.Scope == "local" && RemoteUrlKeyRe.IsMatch(e.Key)).ToList();
        var remote = (o.Operands.Count > 0 ? o.Operands[0] : null) ?? up?.Remote ?? (remotes.Count == 1 ? RemoteNameOfKey(remotes[0].Key) : null);
        if (string.IsNullOrEmpty(remote))
        {
            throw Fail(
                "fatal: No configured push destination.\nEither specify the URL from the command-line or configure a remote repository using\n\n    git remote add <name> <url>\n\nand then push using the remote name\n\n    git push <name>\n",
                128);
        }
        var specs = o.Operands.Skip(1).ToList();
        if (specs.Count == 0)
        {
            if (o.Has("all")) specs = ListRefs(r, "refs/heads/");
            else if (string.IsNullOrEmpty(head.Branch)) throw Fatal("You are not currently on a branch.\nTo push the history leading to the current (detached HEAD)\nstate now, use\n\n    git push " + remote + " HEAD:<name-of-remote-branch>\n");
            else if (up is null && !o.Has("set-upstream"))
                throw Fail($"fatal: The current branch {head.Branch} has no upstream branch.\nTo push the current branch and set the remote as upstream, use\n\n    git push --set-upstream {remote} {head.Branch}\n", 128);
            else specs = new List<string> { up is not null && !o.Has("set-upstream") ? $"{head.Branch}:{up.Ref.Slice($"refs/remotes/{up.Remote}/".Length)}" : head.Branch };
        }
        var url = RemoteUrl(r, remote) ?? remote;
        if (IsNetworkUrl(url)) return NetworkError(g, url, "push");
        var dst = OpenRemote(g, url);
        if (dst is null)
        {
            g.Err($"fatal: '{url}' does not appear to be a git repository\n{NotARepoTail}");
            return 128;
        }
        var dstHead = ReadHead(dst);
        var lines = new List<string>();
        bool failed = false;
        bool rejectedFf = false;
        CopyObjects(r, dst);
        foreach (var spec in specs)
        {
            string srcName, dstName0;
            if (spec.Contains(':'))
            {
                var parts = spec.Split(':');
                srcName = parts[0];
                dstName0 = parts[1];
            }
            else srcName = dstName0 = spec;
            var dstName = RefsHeadsRe.Replace(dstName0 != "" ? dstName0 : srcName, "", 1);
            if (o.Has("delete"))
            {
                var oldRef = ReadRef(dst, $"refs/heads/{dstName}");
                if (string.IsNullOrEmpty(oldRef))
                {
                    g.Err($"error: unable to delete '{dstName}': remote ref does not exist\n");
                    failed = true;
                    continue;
                }
                DeleteRef(dst, $"refs/heads/{dstName}");
                DeleteRef(r, $"refs/remotes/{remote}/{dstName}");
                lines.Add($" - [deleted]         {dstName}");
                continue;
            }
            var h = ResolveCommit(r, srcName);
            if (h is null)
            {
                g.Err($"error: src refspec {srcName} does not match any\n");
                failed = true;
                continue;
            }
            var old = ReadRef(dst, $"refs/heads/{dstName}");
            var label = $"{srcName} -> {dstName}";
            if (old == h)
            {
                lines.Add($" = [up to date]      {label}");
                continue;
            }
            if (dst.Root is not null && dstHead.Branch == dstName)
            {
                g.Err(
                    $"remote: error: refusing to update checked out branch: refs/heads/{dstName}\nremote: error: By default, updating the current branch in a non-bare repository\nremote: is denied, because it will make the index and work tree inconsistent\nremote: with what you pushed, and will require 'git reset --hard' to match\nremote: the work tree to HEAD.\n");
                lines.Add($" ! [remote rejected] {label} (branch is currently checked out)");
                failed = true;
                continue;
            }
            if (!string.IsNullOrEmpty(old) && !IsAncestor(r, old, h) && !o.Has("force"))
            {
                lines.Add($" ! [rejected]        {label} ({(ReadObj(r, old) is not null ? "non-fast-forward" : "fetch first")})");
                failed = true;
                rejectedFf = true;
                continue;
            }
            WriteRef(dst, $"refs/heads/{dstName}", h);
            if (!string.IsNullOrEmpty(RemoteUrl(r, remote))) WriteRef(r, $"refs/remotes/{remote}/{dstName}", h);
            if (string.IsNullOrEmpty(old)) lines.Add($" * [new branch]      {label}");
            else if (IsAncestor(r, old, h)) lines.Add($"   {Short(old)}..{Short(h)}  {label}");
            else lines.Add($" + {Short(old)}...{Short(h)} {label} (forced update)");
            if (o.Has("set-upstream") && !string.IsNullOrEmpty(RemoteUrl(r, remote)))
            {
                var local = srcName == "HEAD" ? head.Branch : srcName;
                if (!string.IsNullOrEmpty(local) && BranchExists(r, local))
                {
                    SetConfig(g, Gpath(r, "config"), $"branch.{local}.remote", remote);
                    SetConfig(g, Gpath(r, "config"), $"branch.{local}.merge", $"refs/heads/{dstName}");
                    lines.Add($"branch '{local}' set up to track '{remote}/{dstName}'.");
                }
            }
        }
        if (lines.Count > 0 && !o.Has("quiet"))
        {
            bool upToDate = lines.All(l => l.Contains("[up to date]"));
            g.Err(upToDate ? "Everything up-to-date\n" : $"To {dst.Root ?? dst.GitDir}\n{string.Join("\n", lines.Where(l => !l.Contains("[up to date]")))}\n");
        }
        if (failed)
        {
            g.Err($"error: failed to push some refs to '{dst.Root ?? dst.GitDir}'\n");
            if (rejectedFf)
                g.Hint(
                    "Updates were rejected because the tip of your current branch is behind\nits remote counterpart. If you want to integrate the remote changes,\nuse 'git pull' before pushing again.\nSee the 'Note about fast-forwards' in 'git push --help' for details.");
            return 1;
        }
        return 0;
    }
}
