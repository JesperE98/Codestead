using System.Text.Json;

namespace Codestead.Shell.Commands;

// Port of src/shell/commands/git.ts (part 4: clone/remote/fetch/pull/push, the small helper commands,
// stash, help, the command itself and the helpers for the chapter checks).

public static partial class GitCmd
{
    // clone / remote / fetch / pull / push

    private static readonly Regex SchemeRe = new("^[a-z+]+://", RO | RegexOptions.IgnoreCase);
    private static readonly Regex ScpRe = new("^[^/\\s]+@[^/\\s]+:", RO);
    private static readonly Regex UrlHostRe = new("^[a-z+]+://(?:[^@/]+@)?([^/:]+)", RO | RegexOptions.IgnoreCase);
    private static readonly Regex ScpHostRe = new("@([^:]+):", RO);
    private static readonly Regex TildeRe = new("^~(?=/|\\z)", RO);
    private static readonly Regex FileSchemeRe = new("^file://", RO);

    private static bool IsNetworkUrl(string url) => (SchemeRe.IsMatch(url) && !url.StartsWith("file://", StringComparison.Ordinal)) || ScpRe.IsMatch(url);

    private static int NetworkError(G g, string url, string action)
    {
        var m1 = UrlHostRe.Match(url);
        var m2 = ScpHostRe.Match(url);
        var host = m1.Success ? m1.Groups[1].Value : m2.Success ? m2.Groups[1].Value : url;
        if (ScpRe.IsMatch(url) || url.StartsWith("ssh://", StringComparison.Ordinal))
        {
            g.Err($"ssh: Could not resolve hostname {host}: Name or service not known\nfatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.\n");
        }
        else g.Err($"fatal: unable to access '{(url.EndsWith('/') ? url : url + "/")}': Could not resolve host: {host}\n");
        g.Note("git.noNetwork", ("action", action), ("host", host));
        return 128;
    }

    private static string ExpandTilde(G g, string path) => TildeRe.Replace(path, g.Sh.Home.Replace("$", "$$"), 1);

    /// <summary>Opens a local repository as a "remote".</summary>
    private static Repo? OpenRemote(G g, string url)
    {
        var path = VfsLib.ResolvePath(g.Cwd, ExpandTilde(g, FileSchemeRe.Replace(url, "", 1)));
        if (LooksLikeGitDir(g, Join(path, ".git"))) return OpenRepo(g, Join(path, ".git"), path);
        if (LooksLikeGitDir(g, path)) return OpenRepo(g, path, null);
        if (!path.EndsWith(".git", StringComparison.Ordinal) && LooksLikeGitDir(g, path + ".git")) return OpenRepo(g, path + ".git", null);
        return null;
    }

    /// <summary>Copies every object from one repository to another.</summary>
    private static void CopyObjects(Repo from, Repo to)
    {
        foreach (var h in AllObjects(from))
        {
            var p = ObjPath(to, h);
            if (ExistsAt(to.G, p)) continue;
            var raw = ReadText(from.G, ObjPath(from, h));
            if (raw is not null) WriteText(to.G, p, raw);
        }
    }

    private static string? RemoteUrl(Repo r, string name) => GetConfig(r.G, r, $"remote.{name}.url");

    private const string NotARepoTail = "fatal: Could not read from remote repository.\n\nPlease make sure you have the correct access rights\nand the repository exists.\n";

    /// <summary>Fetches branches from a remote into refs/remotes/&lt;name&gt;/.</summary>
    private static int FetchRemote(Repo r, string name, bool quiet = false)
    {
        var g = r.G;
        var url = RemoteUrl(r, name) ?? (OpenRemote(g, name) is not null ? name : null);
        if (string.IsNullOrEmpty(url))
        {
            g.Err($"fatal: '{name}' does not appear to be a git repository\n{NotARepoTail}");
            return 128;
        }
        if (IsNetworkUrl(url)) return NetworkError(g, url, "fetch");
        var src = OpenRemote(g, url);
        if (src is null)
        {
            g.Err($"fatal: '{url}' does not appear to be a git repository\n{NotARepoTail}");
            return 128;
        }
        CopyObjects(src, r);
        var lines = new List<string>();
        bool named = RemoteUrl(r, name) is not null;
        var srcHead = ReadHead(src);
        foreach (var b in ListRefs(src, "refs/heads/"))
        {
            var h = ReadRef(src, $"refs/heads/{b}")!;
            if (!named) continue;
            var @ref = $"refs/remotes/{name}/{b}";
            var old = ReadRef(r, @ref);
            if (old == h) continue;
            WriteRef(r, @ref, h);
            if (string.IsNullOrEmpty(old)) lines.Add($" * [new branch]      {b.PadRight(10)} -> {name}/{b}");
            else if (IsAncestor(r, old, h)) lines.Add($"   {Short(old)}..{Short(h)}  {b.PadRight(10)} -> {name}/{b}");
            else lines.Add($" + {Short(old)}...{Short(h)} {b.PadRight(10)} -> {name}/{b}  (forced update)");
        }
        if (named)
        {
            foreach (var b in ListRefs(r, $"refs/remotes/{name}/"))
            {
                if (b != "HEAD" && string.IsNullOrEmpty(ReadRef(src, $"refs/heads/{b}"))) DeleteRef(r, $"refs/remotes/{name}/{b}");
            }
            if (!string.IsNullOrEmpty(srcHead.Branch)) WriteText(g, Gpath(r, $"refs/remotes/{name}/HEAD"), $"ref: refs/remotes/{name}/{srcHead.Branch}\n");
        }
        var fetchHead = !string.IsNullOrEmpty(srcHead.Hash) ? $"{srcHead.Hash}\t\t{(!string.IsNullOrEmpty(srcHead.Branch) ? $"branch '{srcHead.Branch}' of " : "")}{url}\n" : "";
        WriteText(g, Gpath(r, "FETCH_HEAD"), fetchHead);
        if (lines.Count > 0 && !quiet) g.Err($"From {url}\n{string.Join("\n", lines)}\n");
        return 0;
    }

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

    private static readonly Regex RemoteUrlKeyRe = new("^remote\\..*\\.url\\z", RO);

    private static string RemoteNameOfKey(string key) => key.Slice(7, -4);

    private static int CmdRemote(G g, List<string> args)
    {
        var sub = args.Count > 0 && args[0] != "" && !args[0].StartsWith('-') ? args[0] : null;
        var o = ParseArgs(sub is not null ? args.Skip(1).ToList() : args, new[] { "v|verbose" }, "remote");
        var r = NeedRepo(g);
        var names = Union(ConfigAll(g, r).Where(e => e.Scope == "local" && RemoteUrlKeyRe.IsMatch(e.Key)).Select(e => RemoteNameOfKey(e.Key)));
        var cfg = Gpath(r, "config");
        if (sub is null)
        {
            foreach (var n in names)
            {
                if (o.Has("verbose")) g.Out($"{n}\t{RemoteUrl(r, n)} (fetch)\n{n}\t{RemoteUrl(r, n)} (push)\n");
                else g.Out(n + "\n");
            }
            return 0;
        }
        var a = o.Operands.Count > 0 ? o.Operands[0] : null;
        var b = o.Operands.Count > 1 ? o.Operands[1] : null;
        switch (sub)
        {
            case "add":
                if (string.IsNullOrEmpty(a) || string.IsNullOrEmpty(b)) throw Fail("usage: git remote add [<options>] <name> <url>", 129);
                if (names.Contains(a)) throw Fail($"error: remote {a} already exists.", 3);
                SetConfig(g, cfg, $"remote.{a}.url", b);
                SetConfig(g, cfg, $"remote.{a}.fetch", $"+refs/heads/*:refs/remotes/{a}/*");
                return 0;
            case "remove":
            case "rm":
            {
                if (string.IsNullOrEmpty(a) || !names.Contains(a)) throw Fail($"error: No such remote: '{a ?? ""}'", 2);
                var text = ReadText(g, cfg) ?? "";
                text = SetConfigText(text, new KeyParts { Section = "remote", Sub = a, Name = "url" }, null);
                text = SetConfigText(text, new KeyParts { Section = "remote", Sub = a, Name = "fetch" }, null);
                // The name goes into the pattern unescaped, like in the TypeScript.
                Regex? re = null;
                try
                {
                    re = new Regex($"\\[remote \"{a}\"\\]\\n(?=\\[|\\z)", RO);
                }
                catch (ArgumentException)
                {
                }
                WriteText(g, cfg, re is not null ? re.Replace(text, "", 1) : text);
                foreach (var rf in ListRefs(r, $"refs/remotes/{a}/")) DeleteRef(r, $"refs/remotes/{a}/{rf}");
                return 0;
            }
            case "get-url":
                if (string.IsNullOrEmpty(a) || !names.Contains(a)) throw Fail($"error: No such remote '{a ?? ""}'", 2);
                g.Out(RemoteUrl(r, a) + "\n");
                return 0;
            case "set-url":
                if (string.IsNullOrEmpty(a) || string.IsNullOrEmpty(b)) throw Fail("usage: git remote set-url [--push] <name> <newurl> [<oldurl>]", 129);
                if (!names.Contains(a)) throw Fail($"error: No such remote '{a}'", 2);
                SetConfig(g, cfg, $"remote.{a}.url", b);
                return 0;
            case "show":
                foreach (var n in !string.IsNullOrEmpty(a) ? new List<string> { a } : names) g.Out($"* remote {n}\n  Fetch URL: {RemoteUrl(r, n)}\n  Push  URL: {RemoteUrl(r, n)}\n");
                return 0;
            default:
                throw Fail($"error: unknown subcommand: `{sub}'", 129);
        }
    }

    private static int CmdFetch(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "all", "q|quiet", "prune", "p" }, "fetch");
        var r = NeedRepo(g);
        var head = ReadHead(r);
        var remote = (o.Operands.Count > 0 ? o.Operands[0] : null) ?? (!string.IsNullOrEmpty(head.Branch) ? GetConfig(g, r, $"branch.{head.Branch}.remote") : null) ?? "origin";
        if (string.IsNullOrEmpty(RemoteUrl(r, remote)) && o.Operands.Count == 0)
        {
            // No remotes at all: real git says nothing.
            return 0;
        }
        return FetchRemote(r, remote, o.Has("quiet"));
    }

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

    // Small helper commands: reflog, rev-parse, cat-file, hash-object, ls-files, ls-tree

    private static int CmdReflog(G g, List<string> args)
    {
        var r = NeedRepo(g);
        var sub = args.Count > 0 ? args[0] : null;
        if (!string.IsNullOrEmpty(sub) && sub != "show")
        {
            g.Note("git.reflogShowOnly");
            return 1;
        }
        var log = ReadReflog(r);
        log.Reverse();
        if (log.Count == 0)
        {
            var head = ReadHead(r);
            if (string.IsNullOrEmpty(head.Hash)) throw Fatal($"your current branch '{head.Branch}' does not have any commits yet");
        }
        var deco = g.Tty ? Decorations(r) : null;
        for (int i = 0; i < log.Count; i++)
        {
            var e = log[i];
            g.Out($"{g.C(Col.Yellow, Short(e.To))}{(i == 0 ? Decorate(g, deco, e.To) : "")} HEAD@{{{i}}}: {e.Msg}\n");
        }
        return 0;
    }

    private static int CmdRevParse(G g, List<string> args)
    {
        var r = Discover(g, g.Cwd);
        double shortLen = 0;
        bool abbrev = false;
        foreach (var a in args)
        {
            if (a == "--is-inside-work-tree")
            {
                g.Out(r?.Root is not null ? "true\n" : r is not null ? "false\n" : "");
                if (r is null) throw Fatal("not a git repository (or any of the parent directories): .git");
                continue;
            }
            if (r is null) throw Fatal("not a git repository (or any of the parent directories): .git");
            var repo = r;
            if (a == "--show-toplevel") g.Out((repo.Root ?? throw Fatal("this operation must be run in a work tree")) + "\n");
            else if (a == "--git-dir") g.Out((repo.Root is not null && repo.Root == g.Cwd ? ".git" : repo.GitDir) + "\n");
            else if (a == "--is-bare-repository") g.Out(repo.Root is not null ? "false\n" : "true\n");
            else if (a.StartsWith("--short", StringComparison.Ordinal))
            {
                var parts = a.Split('=');
                shortLen = parts.Length > 1 ? Js.Number(parts[1]) : 7;
            }
            else if (a == "--abbrev-ref") abbrev = true;
            else if (a.StartsWith('-')) continue;
            else
            {
                if (abbrev && (a == "HEAD" || a == "@"))
                {
                    var head = ReadHead(repo);
                    g.Out((head.Branch ?? "HEAD") + "\n");
                    continue;
                }
                var h = ResolveRev(repo, a);
                if (h is null)
                    throw Fail($"{a}\nfatal: ambiguous argument '{a}': unknown revision or path not in the working tree.\nUse '--' to separate paths from revisions, like this:\n'git <command> [<revision>...] -- [<file>...]'", 128);
                g.Out((shortLen != 0 && !double.IsNaN(shortLen) ? h.Slice(0, SliceEnd(shortLen)) : h) + "\n");
            }
        }
        return 0;
    }

    private static int CmdCatFile(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "p", "t", "s", "e" }, "cat-file");
        var r = NeedRepo(g);
        var rev = o.Operands.Count > 0 ? o.Operands[0] : null;
        if (string.IsNullOrEmpty(rev)) throw Fail("usage: git cat-file <type> <object>\n   or: git cat-file (-e | -p) <object>\n   or: git cat-file (-t | -s) <object>", 129);
        string? h;
        int colon = rev.IndexOf(':');
        if (colon >= 0)
        {
            var revPart = rev.Slice(0, colon);
            h = RevTree(r, revPart != "" ? revPart : "HEAD")?[rev.Slice(colon + 1)];
        }
        else h = ResolveRev(r, rev);
        if (o.Has("e")) return !string.IsNullOrEmpty(h) && ReadObj(r, h) is not null ? 0 : 1;
        var obj = !string.IsNullOrEmpty(h) ? ReadObj(r, h) : null;
        if (obj is null) throw Fatal($"Not a valid object name {rev}");
        if (o.Has("t")) g.Out(obj.Type + "\n");
        else if (o.Has("s")) g.Out(Js.Utf8Length(obj.Data) + "\n");
        else g.Out(obj.Data);
        return 0;
    }

    private static int CmdHashObject(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "w", "stdin", "t=" }, "hash-object");
        var r = o.Has("w") ? NeedRepo(g) : null;
        var inputs = o.Has("stdin")
            ? new List<string> { g.Ctx.Stdin ?? "" }
            : o.Operands.Select(f => ReadText(g, VfsLib.ResolvePath(g.Cwd, f)) ?? throw Fatal($"could not open '{f}' for reading: No such file or directory")).ToList();
        foreach (var data in inputs) g.Out((r is not null ? WriteObj(r, "blob", data) : BlobHash(data)) + "\n");
        return 0;
    }

    private static int CmdLsFiles(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "s|stage", "o|others", "c|cached", "u|unmerged", "exclude-standard", "i|ignored", "d|deleted", "m|modified" }, "ls-files");
        var r = NeedRepo(g);
        NeedWork(r);
        var idx = ReadIndex(r);
        var specs = o.Operands.Select(p => ToSpec(r, p)).ToList();
        bool Pick(string p) => specs.Count == 0 || specs.Any(s => SpecMatch(s, p));
        var prefix = RelPath(r.Root!, g.Cwd) == "." ? "" : RelPath(r.Root!, g.Cwd) + "/";
        bool InCwd(string p) => p.StartsWith(prefix, StringComparison.Ordinal);
        List<string> list;
        if (o.Has("others") || o.Has("ignored"))
        {
            var work = ScanWork(r);
            list = work.Files.Where(kv => !idx.Entries.Has(kv.Key) && (o.Has("ignored") ? kv.Value.Ignored : !o.Has("exclude-standard") || !kv.Value.Ignored)).Select(kv => kv.Key).ToList();
        }
        else if (o.Has("deleted") || o.Has("modified"))
        {
            var work = ScanWork(r);
            list = idx.Entries.Keys.Where(p => (o.Has("deleted") && !work.Files.ContainsKey(p)) || (o.Has("modified") && work.Get(p)?.Hash != idx.Entries[p])).ToList();
        }
        else list = Union(idx.Entries.Keys, idx.Unmerged.Keys);
        foreach (var p in SortedOrdinal(list.Where(Pick).Where(InCwd)))
        {
            var name = p.Slice(prefix.Length);
            if (o.Has("stage"))
            {
                var u = idx.Unmerged[p];
                if (u is not null)
                {
                    foreach (var (v, n) in new[] { (u.Base, 1), (u.Ours, 2), (u.Theirs, 3) })
                        if (!string.IsNullOrEmpty(v)) g.Out($"100644 {v} {n}\t{name}\n");
                }
                else g.Out($"100644 {idx.Entries[p]} 0\t{name}\n");
            }
            else g.Out(name + "\n");
        }
        return 0;
    }

    private static int CmdLsTree(G g, List<string> args)
    {
        var o = ParseArgs(args, new[] { "r", "name-only", "l|long" }, "ls-tree");
        var r = NeedRepo(g);
        var rev = o.Operands.Count > 0 ? o.Operands[0] : null;
        if (string.IsNullOrEmpty(rev)) throw Fail("usage: git ls-tree [<options>] <tree-ish> [<path>...]", 129);
        var t = RevTree(r, rev) ?? throw Fatal("Not a valid object name " + rev);
        var rows = new OrderedDictionary<string, string>(StringComparer.Ordinal);
        foreach (var p in t.Keys)
        {
            var h = t[p];
            if (o.Has("r") || !p.Contains('/')) rows[p] = o.Has("name-only") ? p : $"100644 blob {h}\t{p}";
            else
            {
                var d = p.Split('/')[0];
                if (!rows.ContainsKey(d))
                {
                    var sub = new JsMap<string>();
                    foreach (var q in t.Keys)
                        if (q.StartsWith(d + "/", StringComparison.Ordinal)) sub[q.Slice(d.Length + 1)] = t[q];
                    rows[d] = o.Has("name-only") ? d : $"040000 tree {WriteTree(r, sub)}\t{d}";
                }
            }
        }
        foreach (var k in SortedOrdinal(rows.Keys)) g.Out(rows[k] + "\n");
        return 0;
    }

    // stash (simplified: saves changes in tracked files)

    private sealed class StashEntry
    {
        public string Base = "";
        public string Branch = "";
        public JsMap<string> Index = new();
        public JsMap<string> Work = new();
        public string Message = "";
    }

    private static List<StashEntry> ReadStash(Repo r)
    {
        var text = ReadText(r.G, Gpath(r, "stash.json"));
        try
        {
            if (string.IsNullOrEmpty(text)) return new List<StashEntry>();
            using var doc = JsonDocument.Parse(text);
            if (doc.RootElement.ValueKind != JsonValueKind.Array) return new List<StashEntry>();
            var list = new List<StashEntry>();
            foreach (var e in doc.RootElement.EnumerateArray())
            {
                string Str(string k) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(k, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString()! : "";
                JsonElement Prop(string k) => e.ValueKind == JsonValueKind.Object && e.TryGetProperty(k, out var v) ? v : default;
                list.Add(new StashEntry { Base = Str("base"), Branch = Str("branch"), Index = TreeFromJson(Prop("index")), Work = TreeFromJson(Prop("work")), Message = Str("message") });
            }
            return list;
        }
        catch (JsonException)
        {
            return new List<StashEntry>();
        }
    }

    private static void WriteStash(Repo r, List<StashEntry> list)
    {
        if (list.Count == 0)
        {
            RemoveFile(r.G, Gpath(r, "stash.json"));
            return;
        }
        var json = list.Select(e => (object)new List<KeyValuePair<string, object?>>
        {
            new("base", e.Base),
            new("branch", e.Branch),
            new("index", JsonTree(e.Index)),
            new("work", JsonTree(e.Work)),
            new("message", e.Message),
        }).ToList();
        WriteText(r.G, Gpath(r, "stash.json"), JsonStringify(json) + "\n");
    }

    private static readonly Regex StashRefRe = new("^(?:stash@\\{)?([0-9]+)\\}?\\z", RO);

    private static int CmdStash(G g, List<string> args)
    {
        bool hasSub = args.Count > 0 && args[0] != "" && !args[0].StartsWith('-');
        var sub = hasSub ? args[0] : "push";
        var o = ParseArgs(hasSub ? args.Skip(1).ToList() : args, new[] { "m|message=", "u|include-untracked", "q|quiet" }, "stash");
        var r = NeedRepo(g);
        NeedWork(r);
        var head = ReadHead(r);
        var list = ReadStash(r);
        var where = head.Branch ?? "(no branch)";
        int PickIndex()
        {
            var @ref = o.Operands.Count > 0 ? o.Operands[0] : "stash@{0}";
            var m = StashRefRe.Match(@ref);
            double n = m.Success ? Js.Number(m.Groups[1].Value) : -1;
            if (!(n >= 0 && n < list.Count)) throw Fail($"error: {@ref} is not a valid reference");
            return (int)n;
        }
        switch (sub)
        {
            case "push":
            case "save":
            {
                if (string.IsNullOrEmpty(head.Hash)) throw Fatal("You do not have the initial commit yet");
                var s = ComputeStatus(r);
                if (s.Staged.Count == 0 && s.Unstaged.Count == 0)
                {
                    g.Out("No local changes to save\n");
                    return 0;
                }
                var work = new JsMap<string>();
                foreach (var p in s.Index.Entries.Keys)
                {
                    var w = s.Work.Get(p);
                    if (w is not null) work[p] = WriteObj(r, "blob", w.Content);
                }
                var c = ReadCommit(r, head.Hash);
                var message = !string.IsNullOrEmpty(o.Get("message")) ? $"On {where}: {o.Get("message")}" : $"WIP on {where}: {Short(c.Hash)} {Subject(c)}";
                list.Insert(0, new StashEntry { Base = head.Hash, Branch = where, Index = s.Index.Entries.Copy(), Work = work, Message = message });
                WriteStash(r, list);
                SwitchTree(r, CommitTree(r, head.Hash), CommitTree(r, head.Hash), "checkout", true);
                g.Out($"Saved working directory and index state {message}\n");
                return 0;
            }
            case "list":
                for (int i = 0; i < list.Count; i++) g.Out($"stash@{{{i}}}: {list[i].Message}\n");
                return 0;
            case "show":
            {
                var e = list[PickIndex()];
                PrintPatch(r, TreeChanges(CommitTree(r, e.Base), e.Work), "stat");
                return 0;
            }
            case "drop":
            {
                int n = PickIndex();
                g.Out($"Dropped stash@{{{n}}} ({list[n].Message})\n");
                list.RemoveAt(n);
                WriteStash(r, list);
                return 0;
            }
            case "clear":
                WriteStash(r, new List<StashEntry>());
                return 0;
            case "pop":
            case "apply":
            {
                if (list.Count == 0) throw Fail("No stash entries found.");
                int n = PickIndex();
                var e = list[n];
                var work = ScanWork(r);
                var idx = ReadIndex(r);
                var headTree = CommitTree(r, head.Hash);
                var baseTree = CommitTree(r, e.Base);
                var conflicts = new List<string>();
                foreach (var p in Union(e.Work.Keys, baseTree.Keys))
                {
                    if (e.Work[p] == baseTree[p]) continue;
                    var cur = work.Get(p)?.Hash;
                    if (cur != headTree[p] && cur != e.Work[p]) conflicts.Add(p);
                }
                if (conflicts.Count > 0)
                {
                    throw Fail($"error: Your local changes to the following files would be overwritten by merge:\n{string.Concat(conflicts.Select(p => $"\t{Show(r, p)}\n"))}Please commit your changes or stash them before you merge.\nAborting");
                }
                foreach (var p in Union(e.Work.Keys, baseTree.Keys))
                {
                    if (e.Work[p] == baseTree[p]) continue;
                    if (e.Work[p] is null)
                    {
                        RemoveWorkFile(r, p);
                        continue;
                    }
                    (string Text, bool Conflict)? cur = headTree[p] != baseTree[p] && !string.IsNullOrEmpty(headTree[p]) && !string.IsNullOrEmpty(baseTree[p])
                        ? Merge3(ReadBlob(r, baseTree[p]!), ReadBlob(r, headTree[p]!), ReadBlob(r, e.Work[p]!), "Updated upstream", "Stashed changes")
                        : null;
                    if (cur?.Conflict == true) g.Out($"CONFLICT (content): Merge conflict in {p}\n");
                    WriteWorkFile(r, p, cur is not null ? cur.Value.Text : ReadBlob(r, e.Work[p]!));
                    if (!idx.Entries.Has(p) && !string.IsNullOrEmpty(e.Index[p])) idx.Entries[p] = e.Index[p];
                }
                WriteIndex(r, idx);
                PrintLongStatus(r, ComputeStatus(r));
                if (sub == "pop")
                {
                    list.RemoveAt(n);
                    WriteStash(r, list);
                    g.Out($"Dropped stash@{{{n}}} ({e.Message})\n");
                }
                return 0;
            }
            default:
                throw Fail($"error: unknown subcommand: {sub}", 129);
        }
    }

    // help / version

    private const string Common = """
usage: git [-v | --version] [-h | --help] [-C <path>] [-c <name>=<value>]
           <command> [<args>]

These are common Git commands used in various situations:

start a working area
   clone      Clone a repository into a new directory
   init       Create an empty Git repository or reinitialize an existing one

work on the current change
   add        Add file contents to the index
   mv         Move or rename a file, a directory, or a symlink
   restore    Restore working tree files
   rm         Remove files from the working tree and from the index

examine the history and state
   diff       Show changes between commits, commit and working tree, etc
   log        Show commit logs
   show       Show various types of objects
   status     Show the working tree status

grow, mark and tweak your common history
   branch     List, create, or delete branches
   commit     Record changes to the repository
   merge      Join two or more development histories together
   reset      Reset current HEAD to the specified state
   switch     Switch branches
   tag        Create, list, delete or verify a tag object signed with GPG

collaborate
   fetch      Download objects and refs from another repository
   pull       Fetch from and integrate with another repository or a local branch
   push       Update remote refs along with associated objects

'git help -a' and 'git help -g' list available subcommands and some
concept guides. See 'git help <command>' or 'git help <concept>'
to read about a specific subcommand or concept.
See 'git help git' for an overview of the system.
""" + "\n";

    private static readonly OrderedDictionary<string, Func<G, List<string>, int>> Subs = new(StringComparer.Ordinal)
    {
        ["init"] = CmdInit,
        ["config"] = CmdConfig,
        ["status"] = CmdStatus,
        ["add"] = CmdAdd,
        ["commit"] = CmdCommit,
        ["log"] = CmdLog,
        ["diff"] = CmdDiff,
        ["restore"] = CmdRestore,
        ["rm"] = CmdRm,
        ["mv"] = CmdMv,
        ["branch"] = CmdBranch,
        ["switch"] = CmdSwitch,
        ["checkout"] = CmdCheckout,
        ["merge"] = CmdMerge,
        ["reset"] = CmdReset,
        ["show"] = CmdShow,
        ["tag"] = CmdTag,
        ["clone"] = CmdClone,
        ["remote"] = CmdRemote,
        ["fetch"] = CmdFetch,
        ["pull"] = CmdPull,
        ["push"] = CmdPush,
        ["stash"] = CmdStash,
        ["reflog"] = CmdReflog,
        ["rev-parse"] = CmdRevParse,
        ["cat-file"] = CmdCatFile,
        ["hash-object"] = CmdHashObject,
        ["ls-files"] = CmdLsFiles,
        ["ls-tree"] = CmdLsTree,
    };

    private static int Levenshtein(string a, string b)
    {
        var dp = new int[a.Length + 1, b.Length + 1];
        for (int i = 0; i <= a.Length; i++) dp[i, 0] = i;
        for (int j = 1; j <= b.Length; j++) dp[0, j] = j;
        for (int i = 1; i <= a.Length; i++)
            for (int j = 1; j <= b.Length; j++)
                dp[i, j] = Math.Min(Math.Min(dp[i - 1, j] + 1, dp[i, j - 1] + 1), dp[i - 1, j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1));
        return dp[a.Length, b.Length];
    }

    private static readonly Regex WhitespaceRunRe = new("\\s+", RO);

    private static int RunGit(G g, List<string> args, int depth = 0)
    {
        // Global flags before the subcommand.
        while (args.Count > 0 && args[0].StartsWith('-'))
        {
            var a = args[0];
            if (a == "--version" || a == "-v")
            {
                g.Out("git version 2.51.1\n");
                return 0;
            }
            if (a == "--help" || a == "-h")
            {
                g.Out(Common);
                return 0;
            }
            if (a == "-C")
            {
                if (args.Count < 2 || args[1] == "") throw Fail("error: no directory given for '-C' option\n", 129);
                var dir = VfsLib.ResolvePath(g.Cwd, ExpandTilde(g, args[1]));
                if (!IsDirAt(g, dir)) throw Fatal($"cannot change to '{args[1]}': No such file or directory");
                g.Cwd = dir;
                args = args.Skip(2).ToList();
                continue;
            }
            if (a is "--no-pager" or "-P" or "--paginate" or "-p")
            {
                args = args.Skip(1).ToList();
                continue;
            }
            if (a == "-c")
            {
                args = args.Skip(2).ToList();
                continue;
            }
            throw Fail($"unknown option: {a}\n{string.Join("\n", Common.Split('\n').Take(2))}", 129);
        }
        var cmd = args.Count > 0 ? args[0] : null;
        var rest = args.Skip(1).ToList();
        if (string.IsNullOrEmpty(cmd))
        {
            g.Out(Common);
            return 1;
        }
        if (cmd == "version")
        {
            g.Out("git version 2.51.1\n");
            return 0;
        }
        if (cmd == "help")
        {
            if (rest.Count > 0 && rest[0] != "" && Subs.ContainsKey(rest[0]))
            {
                g.Note("git.manGitHint");
                return 0;
            }
            g.Out(Common);
            return 0;
        }
        if (rest.Contains("-h") && Subs.ContainsKey(cmd))
        {
            g.Out($"usage: git {cmd} [<options>]\n");
            g.Note("git.manGitOptions");
            return 129;
        }
        if (Subs.TryGetValue(cmd, out var sub)) return sub(g, rest);
        var r = Discover(g, g.Cwd);
        var alias = GetConfig(g, r, $"alias.{cmd}");
        if (!string.IsNullOrEmpty(alias) && depth < 5)
        {
            if (alias.StartsWith('!'))
            {
                g.Note("git.shellAliasUnsupported");
                return 1;
            }
            return RunGit(g, WhitespaceRunRe.Split(alias).Where(x => x != "").Concat(rest).ToList(), depth + 1);
        }
        g.Err($"git: '{cmd}' is not a git command. See 'git --help'.\n");
        var prefixed = cmd.Length >= 2 ? Subs.Keys.Where(s => s.StartsWith(cmd, StringComparison.Ordinal)).ToList() : new List<string>();
        var dist = Subs.Keys.Select(s => (S: s, D: Levenshtein(s, cmd))).ToList();
        int best = dist.Min(x => x.D);
        var similar = prefixed.Count > 0 ? prefixed : best <= 2 ? dist.Where(x => x.D == best).Select(x => x.S).ToList() : new List<string>();
        if (similar.Count > 0) g.Err($"\nThe most similar command{(similar.Count > 1 ? "s are" : " is")}\n{string.Concat(similar.Select(s => $"\t{s}\n"))}");
        return 1;
    }

    // ---------- Helpers for the chapter checks ----------

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

    // ---------- The command ----------

    private const string ManSv = """
NAMN
       git - distribuerad versionshantering

SYNOPSIS
       git [-C KATALOG] KOMMANDO [FLAGGOR] [ARGUMENT]

BESKRIVNING
       git sparar ögonblicksbilder (commits) av filerna i ett projekt så att
       du kan se vad som ändrats, gå tillbaka och arbeta i flera grenar.
       Repot ligger i den dolda katalogen .git i projektets rot.

       Arbetskatalogen är filerna du ser. Indexet (staging area) är det som
       ska med i nästa commit. En commit är en sparad version med meddelande,
       författare och tid.

       Simulatorn har en egen, förenklad git som sparar allt i .git som
       textfiler. Nätverk saknas, men clone, fetch, pull och push fungerar
       mot repon på samma dator.

KOMMANDON
       init [KATALOG]           skapa ett nytt repo (-b GREN, --bare)
       config                   inställningar, t.ex.
                                git config --global user.name "Namn"
                                (--list, --unset, --global, --local)
       status [-s] [-b]         visa vad som ändrats (git status är kompassen!)
       add FIL... | . | -A      lägg ändringar i indexet (-u, -f, -n)
       commit -m MEDDELANDE     spara en commit (-a, --amend, --allow-empty)
       log                      historiken (--oneline, -n N, --graph, --all,
                                --stat, -p, A..B, -- FIL)
       diff                     arbetskatalog mot index (--staged, --stat,
                                COMMIT, A B, -- FIL)
       show [COMMIT[:FIL]]      visa en commit eller en fil i en commit
       restore FIL              ångra ändringar i arbetskatalogen
                                (--staged för att plocka ur indexet,
                                --source=COMMIT, --ours, --theirs)
       rm [--cached] [-r] FIL   ta bort filer (ur indexet)
       mv KÄLLA MÅL             flytta eller byt namn
       branch [NAMN]            lista eller skapa grenar (-d, -D, -m, -v, -a)
       switch GREN              byt gren (-c NY för att skapa, -, --detach)
       checkout GREN | -- FIL   äldre kommando: byt gren eller återställ fil
                                (-b NY)
       merge GREN               slå ihop en gren (--no-ff, --ff-only,
                                --abort, -m)
       reset [--soft|--hard] [COMMIT] | reset FIL
                                flytta grenen eller plocka ur indexet
       stash [list|pop|apply|drop]
                                lägg undan ändringar tillfälligt
       tag [-a -m MEDD] NAMN    märk en commit (t.ex. v1.0)
       clone KÄLLA [MÅL]        kopiera ett repo (bara lokala i simulatorn)
       remote [-v] | remote add NAMN URL
       fetch, pull, push [-u] FJÄRR GREN
                                utbyt commits med ett annat repo
       reflog                   var HEAD har varit (bra för att rädda saker)
       rev-parse, cat-file -p, hash-object, ls-files, ls-tree
                                titta in i maskineriet

FILER
       ~/.gitconfig             dina globala inställningar
       .git/                    repot: objects/, refs/heads/, HEAD, index ...
       .gitignore               filer som git ska strunta i

EXEMPEL
       git config --global user.name "Elev Elevsson"
       git init
       git add .
       git commit -m "Första versionen"
       git switch -c ny-design
       git log --oneline --graph --all
""";

    private const string ManEn = """
NAME
       git - distributed version control

SYNOPSIS
       git [-C DIR] COMMAND [OPTIONS] [ARGUMENTS]

DESCRIPTION
       git stores snapshots (commits) of the files in a project so you can
       see what changed, go back in time and work in several branches.
       The repository lives in the hidden directory .git in the project root.

       The working tree is the files you see. The index (staging area) is
       what will go into the next commit. A commit is a saved version with a
       message, an author and a time.

       The simulator has its own simplified git that stores everything in
       .git as text files. There is no network, but clone, fetch, pull and
       push work with repositories on the same computer.

COMMANDS
       init [DIR]               create a new repository (-b BRANCH, --bare)
       config                   settings, e.g.
                                git config --global user.name "Name"
                                (--list, --unset, --global, --local)
       status [-s] [-b]         show what changed (git status is your compass!)
       add FILE... | . | -A     add changes to the index (-u, -f, -n)
       commit -m MESSAGE        record a commit (-a, --amend, --allow-empty)
       log                      history (--oneline, -n N, --graph, --all,
                                --stat, -p, A..B, -- FILE)
       diff                     working tree vs index (--staged, --stat,
                                COMMIT, A B, -- FILE)
       show [COMMIT[:FILE]]     show a commit or a file in a commit
       restore FILE             discard changes in the working tree
                                (--staged to unstage, --source=COMMIT,
                                --ours, --theirs)
       rm [--cached] [-r] FILE  remove files (from the index)
       mv SOURCE DEST           move or rename
       branch [NAME]            list or create branches (-d, -D, -m, -v, -a)
       switch BRANCH            switch branches (-c NEW to create, -, --detach)
       checkout BRANCH | -- FILE
                                older command: switch branch or restore file
                                (-b NEW)
       merge BRANCH             join a branch (--no-ff, --ff-only, --abort, -m)
       reset [--soft|--hard] [COMMIT] | reset FILE
                                move the branch or unstage
       stash [list|pop|apply|drop]
                                put changes aside for a while
       tag [-a -m MSG] NAME     mark a commit (e.g. v1.0)
       clone SOURCE [DEST]      copy a repository (local only in the simulator)
       remote [-v] | remote add NAME URL
       fetch, pull, push [-u] REMOTE BRANCH
                                exchange commits with another repository
       reflog                   where HEAD has been (great for rescues)
       rev-parse, cat-file -p, hash-object, ls-files, ls-tree
                                look inside the machinery

FILES
       ~/.gitconfig             your global settings
       .git/                    the repository: objects/, refs/heads/, HEAD, index ...
       .gitignore               files git should ignore

EXAMPLES
       git config --global user.name "Ada Lovelace"
       git init
       git add .
       git commit -m "First version"
       git switch -c new-design
       git log --oneline --graph --all
""";

    private static int RunCommand(CmdCtx ctx)
    {
        var g = MakeG(ctx);
        try
        {
            return RunGit(g, ctx.Args);
        }
        catch (GitExit e)
        {
            if (e.Text != "") g.Err(e.Text);
            return e.Code;
        }
        catch (FsError e)
        {
            g.Err($"fatal: {e.Message}\n");
            return 128;
        }
    }

    public static List<CommandDef> All { get; } = new()
    {
        new CommandDef
        {
            Name = "git",
            Summary = "Versionshantering",
            SummaryEn = "Version control",
            Man = ManSv,
            ManEn = ManEn,
            Run = RunCommand,
        },
    };
}
