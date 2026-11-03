namespace Codestead.Shell;

// Port of src/shell/vfs.ts – a small in-memory file system with owners and permissions (rwx).
// Everything is plain data so it can be saved as JSON.

public static partial class VfsLib
{
    /// <summary>The content of a simulated binary starts with this.</summary>
    public const string Elf = "\u007fELF";

    public static FsNode MakeDir(string owner = "root", int mode = -1, OrderedDictionary<string, FsNode>? children = null, string? group = null) => new()
    {
        Type = "dir",
        Mode = mode < 0 ? Js.Oct(755) : mode,
        Owner = owner,
        Group = group ?? owner,
        Mtime = Js.Now(),
        Children = children ?? Js.Obj<FsNode>(),
    };

    public static FsNode MakeFile(string content = "", string owner = "root", int mode = -1, string? group = null) => new()
    {
        Type = "file",
        Mode = mode < 0 ? Js.Oct(644) : mode,
        Owner = owner,
        Group = group ?? owner,
        Mtime = Js.Now(),
        Content = content,
    };

    public static string NormalizePath(string path)
    {
        var parts = new List<string>();
        foreach (var seg in path.Split('/'))
        {
            if (seg == "" || seg == ".") continue;
            if (seg == "..") { if (parts.Count > 0) parts.RemoveAt(parts.Count - 1); }
            else parts.Add(seg);
        }
        return "/" + string.Join("/", parts);
    }

    public static string ResolvePath(string cwd, string path) =>
        NormalizePath(path.StartsWith('/') ? path : $"{cwd}/{path}");

    public static string Dirname(string path)
    {
        var norm = NormalizePath(path);
        var idx = norm.LastIndexOf('/');
        return idx <= 0 ? "/" : norm[..idx];
    }

    public static string Basename(string path)
    {
        var trimmed = path.TrimEnd('/');
        if (trimmed == "") return "/";
        return trimmed[(trimmed.LastIndexOf('/') + 1)..];
    }

    /// <summary>
    /// Simulated archives (tar, gzip, zip – see Commands/Archive/) start with a marker followed
    /// by their pretend size: MARKER NUL size NUL content.
    /// </summary>
    private static readonly Regex SizedBlob = new("^(?:\u0000SIMTAR1|\u001f\u008b\u0008SIMGZ1|PK\u0003\u0004SIMZIP1)\u0000(\\d+)\u0000", RegexOptions.CultureInvariant);

    /// <summary>A symbolic link to <paramref name="target"/> (its permissions are always rwxrwxrwx).</summary>
    public static FsNode MakeLink(string target, string owner = "root", string? group = null) => new()
    {
        Type = "link",
        Mode = Js.Oct(777),
        Owner = owner,
        Group = group ?? owner,
        Mtime = Js.Now(),
        Content = target,
    };

    public static long NodeSize(FsNode node)
    {
        if (node.Type == "dir") return 4096;
        if (node.Size is long size) return size;
        var content = node.Content ?? "";
        var sized = SizedBlob.Match(content);
        if (sized.Success) return long.Parse(sized.Groups[1].Value, CultureInfo.InvariantCulture);
        return Js.Utf8Length(content);
    }

    /// <summary>perm is 'r', 'w' or 'x'.</summary>
    public static bool HasPerm(FsNode node, User user, char perm)
    {
        if (user.Uid == 0)
        {
            // root may do anything, except run files that have no x bit at all.
            if (perm != 'x' || node.Type == "dir") return true;
            return (node.Mode & Js.Oct(111)) != 0;
        }
        int bit = perm == 'r' ? 4 : perm == 'w' ? 2 : 1;
        int shift = 0;
        if (node.Owner == user.Name) shift = 6;
        else if (user.Groups.Contains(node.Group)) shift = 3;
        return ((node.Mode >> shift) & bit) != 0;
    }

    /// <summary>A copy of a node and everything in it. A copy is a new file: it has no inode number or hard links yet.</summary>
    public static FsNode CloneNode(FsNode node)
    {
        var copy = Js.Clone(node);
        static void Fresh(FsNode n)
        {
            n.Ino = null;
            n.Nlink = null;
            foreach (var c in n.Children?.Values ?? Enumerable.Empty<FsNode>()) Fresh(c);
        }
        Fresh(copy);
        return copy;
    }
}
