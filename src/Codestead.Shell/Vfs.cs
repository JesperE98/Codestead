using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Port of src/shell/vfs.ts – a small in-memory file system with owners and permissions (rwx).
// Everything is plain data so it can be saved as JSON.

public partial class FsNode
{
    /// <summary>"file" or "dir".</summary>
    public string Type { get; set; } = "file";
    /// <summary>Permission bits, e.g. 0o755. Includes setuid (0o4000) and the sticky bit (0o1000).</summary>
    public int Mode { get; set; }
    public string Owner { get; set; } = "root";
    public string Group { get; set; } = "root";
    public long Mtime { get; set; }
    public string? Content { get; set; }
    public OrderedDictionary<string, FsNode>? Children { get; set; }
    /// <summary>Pretend size of "binaries" in /usr/bin.</summary>
    public long? Size { get; set; }

    [JsonIgnore] public bool IsDir => Type == "dir";
    [JsonIgnore] public bool IsFile => Type == "file";
}

public partial class User
{
    public string Name { get; set; } = "";
    public int Uid { get; set; }
    public List<string> Groups { get; set; } = new();
    public string Home { get; set; } = "";
}

public partial class FsError : Exception
{
    private static readonly Dictionary<string, string> Messages = new()
    {
        ["ENOENT"] = "No such file or directory",
        ["EACCES"] = "Permission denied",
        ["ENOTDIR"] = "Not a directory",
        ["EISDIR"] = "Is a directory",
        ["EEXIST"] = "File exists",
        ["ENOTEMPTY"] = "Directory not empty",
        ["EPERM"] = "Operation not permitted",
        ["EINVAL"] = "Invalid argument",
    };

    /// <summary>ENOENT, EACCES, ENOTDIR, EISDIR, EEXIST, ENOTEMPTY, EPERM or EINVAL.</summary>
    public string Code { get; }

    public FsError(string code) : base(Messages[code]) => Code = code;
}

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
    /// Simulated archives (tar, gzip, zip – see Commands/ArchiveCmd.cs) start with a marker followed
    /// by their pretend size: MARKER NUL size NUL content.
    /// </summary>
    private static readonly Regex SizedBlob = new("^(?:\u0000SIMTAR1|\u001f\u008b\u0008SIMGZ1|PK\u0003\u0004SIMZIP1)\u0000(\\d+)\u0000", RegexOptions.CultureInvariant);

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

    public static FsNode CloneNode(FsNode node) => Js.Clone(node);
}

public partial class VFS
{
    public FsNode Root { get; set; }

    public VFS(FsNode root) => Root = root;

    private static IEnumerable<string> Segments(string path) =>
        VfsLib.NormalizePath(path).Split('/').Where(s => s != "");

    /// <summary>Walks to a node and checks search permission (x) on every directory on the way.</summary>
    public FsNode Lookup(string path, User user)
    {
        var node = Root;
        foreach (var seg in Segments(path))
        {
            if (node.Type != "dir" || node.Children is null) throw new FsError("ENOTDIR");
            if (!VfsLib.HasPerm(node, user, 'x')) throw new FsError("EACCES");
            if (!node.Children.TryGetValue(seg, out var next)) throw new FsError("ENOENT");
            node = next;
        }
        return node;
    }

    public FsNode? TryLookup(string path, User user)
    {
        try
        {
            return Lookup(path, user);
        }
        catch (FsError)
        {
            return null;
        }
    }

    /// <summary>The parent directory and the file name for a path.</summary>
    public (FsNode Dir, string Name) Parent(string path, User user)
    {
        var norm = VfsLib.NormalizePath(path);
        if (norm == "/") throw new FsError("EEXIST");
        var dir = Lookup(VfsLib.Dirname(norm), user);
        if (dir.Type != "dir" || dir.Children is null) throw new FsError("ENOTDIR");
        return (dir, VfsLib.Basename(norm));
    }

    public string ReadFile(string path, User user)
    {
        var norm = VfsLib.NormalizePath(path);
        if (norm == "/dev/null") return "";
        var node = Lookup(norm, user);
        if (node.Type == "dir") throw new FsError("EISDIR");
        if (!VfsLib.HasPerm(node, user, 'r')) throw new FsError("EACCES");
        return node.Content ?? "";
    }

    public void WriteFile(string path, string content, User user, bool append = false)
    {
        var norm = VfsLib.NormalizePath(path);
        if (norm == "/dev/null") return;
        var (dir, name) = Parent(norm, user);
        if (dir.Children!.TryGetValue(name, out var existing))
        {
            if (existing.Type == "dir") throw new FsError("EISDIR");
            if (!VfsLib.HasPerm(existing, user, 'w')) throw new FsError("EACCES");
            existing.Content = append ? (existing.Content ?? "") + content : content;
            existing.Size = null;
            existing.Mtime = Js.Now();
            return;
        }
        if (!VfsLib.HasPerm(dir, user, 'w')) throw new FsError("EACCES");
        dir.Children[name] = VfsLib.MakeFile(content, user.Name, Js.Oct(644), user.Groups.FirstOrDefault());
        dir.Mtime = Js.Now();
    }

    public void Mkdir(string path, User user)
    {
        var (dir, name) = Parent(path, user);
        if (dir.Children!.ContainsKey(name)) throw new FsError("EEXIST");
        if (!VfsLib.HasPerm(dir, user, 'w')) throw new FsError("EACCES");
        dir.Children[name] = VfsLib.MakeDir(user.Name, Js.Oct(755), null, user.Groups.FirstOrDefault());
        dir.Mtime = Js.Now();
    }

    /// <summary>Inserts a ready node (used by cp and mv). Overwrites files.</summary>
    public void Insert(string path, FsNode node, User user)
    {
        var (dir, name) = Parent(path, user);
        if (!VfsLib.HasPerm(dir, user, 'w')) throw new FsError("EACCES");
        if (dir.Children!.TryGetValue(name, out var existing) && existing.Type == "dir" && node.Type != "dir")
            throw new FsError("EISDIR");
        dir.Children[name] = node;
        dir.Mtime = Js.Now();
    }

    /// <summary>Removes a node. Checking whether directories are empty is up to the caller.</summary>
    public void Remove(string path, User user)
    {
        var (dir, name) = Parent(path, user);
        if (!dir.Children!.ContainsKey(name)) throw new FsError("ENOENT");
        if (!VfsLib.HasPerm(dir, user, 'w')) throw new FsError("EACCES");
        dir.Children.Remove(name);
        dir.Mtime = Js.Now();
    }

    public List<string> ListDir(string path, User user)
    {
        var node = Lookup(path, user);
        if (node.Type != "dir" || node.Children is null) throw new FsError("ENOTDIR");
        if (!VfsLib.HasPerm(node, user, 'r')) throw new FsError("EACCES");
        return node.Children.Keys.ToList().SortJs();
    }
}
