namespace Codestead.Shell.Commands;

// References: branches, HEAD and the reflog.

public static partial class GitCmd
{
    private static readonly Regex Hash40Re = new("^[0-9a-f]{40}\\z", RO);

    private static string? ReadRef(Repo r, string name, int depth = 0)
    {
        var text = ReadText(r.G, Gpath(r, name));
        if (text is null) return null;
        var t = text.Trim();
        if (t.StartsWith("ref: ", StringComparison.Ordinal)) return depth > 5 ? null : ReadRef(r, t.Slice(5), depth + 1);
        return Hash40Re.IsMatch(t) ? t : null;
    }

    private static void WriteRef(Repo r, string name, string h) => WriteText(r.G, Gpath(r, name), h + "\n");

    private static void DeleteRef(Repo r, string name)
    {
        RemoveFile(r.G, Gpath(r, name));
        PruneDirs(r.G, VfsLib.Dirname(Gpath(r, name)), Gpath(r, "refs"));
    }

    /// <summary>The names of all references under e.g. "refs/heads/" (without the prefix), sorted.</summary>
    private static List<string> ListRefs(Repo r, string prefix)
    {
        var names = new List<string>();
        void Walk(FsNode node, string rel)
        {
            if (node.Children is null) return;
            foreach (var name in JsKeyOrder(node.Children.Keys))
            {
                var child = node.Children[name];
                var p = rel != "" ? $"{rel}/{name}" : name;
                if (child.Type == "dir") Walk(child, p);
                else names.Add(p);
            }
        }
        var dir = r.G.Sh.Vfs.TryLookup(Gpath(r, prefix.EndsWith('/') ? prefix[..^1] : prefix), r.G.User);
        if (dir?.Type == "dir") Walk(dir, "");
        return SortedOrdinal(names);
    }

    private sealed class Head
    {
        /// <summary>The branch HEAD points at, or null if HEAD is detached.</summary>
        public string? Branch;
        /// <summary>The commit HEAD points at (missing in an empty repository).</summary>
        public string? Hash;
    }

    private static Head ReadHead(Repo r)
    {
        var text = (ReadText(r.G, Gpath(r, "HEAD")) ?? "").Trim();
        if (text.StartsWith("ref: refs/heads/", StringComparison.Ordinal))
        {
            var branch = text.Slice("ref: refs/heads/".Length);
            return new Head { Branch = branch, Hash = ReadRef(r, $"refs/heads/{branch}") };
        }
        return new Head { Branch = null, Hash = Hash40Re.IsMatch(text) ? text : null };
    }

    private static void SetHeadBranch(Repo r, string branch) => WriteText(r.G, Gpath(r, "HEAD"), $"ref: refs/heads/{branch}\n");

    private static void SetHeadDetached(Repo r, string h) => WriteText(r.G, Gpath(r, "HEAD"), h + "\n");

    /// <summary>Moves the branch HEAD points at (or HEAD itself if detached).</summary>
    private static void MoveHead(Repo r, string h, string reflogMsg)
    {
        var head = ReadHead(r);
        if (!string.IsNullOrEmpty(head.Branch)) WriteRef(r, $"refs/heads/{head.Branch}", h);
        else SetHeadDetached(r, h);
        Reflog(r, head.Hash, h, reflogMsg);
    }

    private static void Reflog(Repo r, string? from, string to, string msg)
    {
        var id = Identity(r.G, r, false) ?? new Ident { Name = r.G.User.Name, Email = $"{r.G.User.Name}@{r.G.Sh.Distro.Hostname}", Time = Now(), Tz = TzNow() };
        var path = Gpath(r, "logs/HEAD");
        var old = ReadText(r.G, path) ?? "";
        WriteText(r.G, path, old + $"{from ?? Zero} {to} {FmtIdent(id)}\t{msg}\n");
    }

    private sealed record ReflogEntry(string To, string Msg);

    private static List<ReflogEntry> ReadReflog(Repo r) =>
        (ReadText(r.G, Gpath(r, "logs/HEAD")) ?? "")
            .Split('\n')
            .Where(l => l != "")
            .Select(l =>
            {
                var parts = l.Split(' ');
                return new ReflogEntry(parts.Length > 1 ? parts[1] : "", l.Slice(l.IndexOf('\t') + 1));
            })
            .ToList();

    private static readonly Regex CheckoutMoveRe = new("^checkout: moving from (\\S+) to ", RO);

    /// <summary>The branch you were on before the latest switch (for `git switch -`).</summary>
    private static string? PreviousBranch(Repo r)
    {
        var log = ReadReflog(r);
        for (int i = log.Count - 1; i >= 0; i--)
        {
            var m = CheckoutMoveRe.Match(log[i].Msg);
            if (m.Success) return m.Groups[1].Value;
        }
        return null;
    }

    private static readonly Regex BadRefRe = new("\\.\\.|@\\{|//|/\\.|^\\.|[\\s~^:?*\\[\\\\\\x00-\\x1f\\x7f]", RO);

    private static bool ValidBranchName(string? name) =>
        !string.IsNullOrEmpty(name) &&
        !name.StartsWith('-') &&
        !name.StartsWith('/') &&
        !name.EndsWith('/') &&
        !name.EndsWith('.') &&
        !name.EndsWith(".lock", StringComparison.Ordinal) &&
        name != "HEAD" &&
        name != "@" &&
        !BadRefRe.IsMatch(name);

    private static void CheckBranchName(G g, string name)
    {
        if (ValidBranchName(name)) return;
        g.Err($"fatal: '{name}' is not a valid branch name\n");
        g.Hint("See `man git check-ref-format`\nDisable this message with \"git config set advice.refSyntax false\"");
        throw new GitExit("", 128);
    }

    private static bool BranchExists(Repo r, string b) => ReadRef(r, $"refs/heads/{b}") is not null;
}
