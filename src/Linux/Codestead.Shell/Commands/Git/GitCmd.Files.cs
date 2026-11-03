namespace Codestead.Shell.Commands;

// The file system under the repository and finding/opening the repository itself.

public static partial class GitCmd
{
    private static string Join(string a, string b) => b == "" ? a : a == "/" ? $"/{b}" : $"{a}/{b}";

    private static string? ReadText(G g, string path)
    {
        try
        {
            var node = g.Sh.Vfs.Lookup(path, g.User);
            if (node.Type != "file") return null;
            return g.Sh.Vfs.ReadFile(path, g.User);
        }
        catch (FsError e) when (e.Code is "ENOENT" or "ENOTDIR")
        {
            return null;
        }
    }

    private static void Mkdirp(G g, string path)
    {
        var cur = "";
        foreach (var seg in VfsLib.NormalizePath(path).Split('/').Where(s => s != ""))
        {
            cur += "/" + seg;
            var node = g.Sh.Vfs.TryLookup(cur, g.User);
            if (node is null) g.Sh.Vfs.Mkdir(cur, g.User);
            else if (node.Type != "dir") throw new FsError("ENOTDIR");
        }
    }

    private static void WriteText(G g, string path, string content)
    {
        Mkdirp(g, VfsLib.Dirname(path));
        g.Sh.Vfs.WriteFile(path, content, g.User);
    }

    private static void RemoveFile(G g, string path)
    {
        if (g.Sh.Vfs.TryLookup(path, g.User) is not null) g.Sh.Vfs.Remove(path, g.User);
    }

    /// <summary>Removes empty directories upwards from `dir` (but never `stop`).</summary>
    private static void PruneDirs(G g, string dir, string stop)
    {
        while (dir != stop && dir.StartsWith(stop + "/", StringComparison.Ordinal))
        {
            var node = g.Sh.Vfs.TryLookup(dir, g.User);
            if (node is null || node.Type != "dir" || (node.Children?.Count ?? 0) > 0) return;
            g.Sh.Vfs.Remove(dir, g.User);
            dir = VfsLib.Dirname(dir);
        }
    }

    private static bool IsDirAt(G g, string p) => g.Sh.Vfs.TryLookup(p, g.User)?.Type == "dir";
    private static bool ExistsAt(G g, string p) => g.Sh.Vfs.TryLookup(p, g.User) is not null;

    /// <summary>Path from the directory `from` to `to` (both absolute).</summary>
    private static string RelPath(string from, string to)
    {
        var a = from.Split('/').Where(s => s != "").ToList();
        var b = to.Split('/').Where(s => s != "").ToList();
        int i = 0;
        while (i < a.Count && i < b.Count && a[i] == b[i]) i++;
        var parts = a.Skip(i).Select(_ => "..").Concat(b.Skip(i)).ToList();
        var s = string.Join("/", parts);
        return s != "" ? s : ".";
    }

    private sealed class Repo
    {
        public required G G;
        public required string GitDir;
        /// <summary>The work tree, or null for a "bare" repository (only the history, as on a server).</summary>
        public required string? Root;
        /// <summary>Content of blobs that only exist in the work tree (not saved as objects).</summary>
        public Dictionary<string, string> Blobs { get; } = new(StringComparer.Ordinal);
        public Dictionary<string, Commit> CommitCache { get; } = new(StringComparer.Ordinal);
    }

    private static bool LooksLikeGitDir(G g, string dir) =>
        ReadText(g, $"{dir}/HEAD") is not null && IsDirAt(g, $"{dir}/objects") && IsDirAt(g, $"{dir}/refs");

    private static Repo OpenRepo(G g, string gitDir, string? root) => new() { G = g, GitDir = gitDir, Root = root };

    private static Repo? Discover(G g, string start)
    {
        var dir = VfsLib.NormalizePath(start);
        for (;;)
        {
            if (IsDirAt(g, Join(dir, ".git")) && LooksLikeGitDir(g, Join(dir, ".git"))) return OpenRepo(g, Join(dir, ".git"), dir);
            if (LooksLikeGitDir(g, dir)) return OpenRepo(g, dir, null);
            if (dir == "/") return null;
            dir = VfsLib.Dirname(dir);
        }
    }

    private static Repo NeedRepo(G g) => Discover(g, g.Cwd) ?? throw Fatal("not a git repository (or any of the parent directories): .git");

    private static string NeedWork(Repo r) => r.Root ?? throw Fatal("this operation must be run in a work tree");

    private static string Gpath(Repo r, string rel) => $"{r.GitDir}/{rel}";
}
