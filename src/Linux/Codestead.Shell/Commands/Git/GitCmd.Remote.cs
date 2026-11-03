namespace Codestead.Shell.Commands;

// Remote repositories: URLs, opening and copying a remote (shared by clone, fetch, pull and push), and git remote.

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
}
