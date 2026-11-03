using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Port of src/shell/vfs.ts – a small in-memory file system with owners and permissions (rwx).
// Everything is plain data so it can be saved as JSON.

public partial class FsNode
{
    /// <summary>"file", "dir" or "link" (a symbolic link: <see cref="Content"/> is the path it points to).</summary>
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
    /// <summary>
    /// The inode number, given the first time something shows it (ls -i, stat) or when the file gets a
    /// hard link. Hard links are the same node in several directories; they share the inode number, which
    /// is how they are joined again when a saved terminal is loaded (see <see cref="VFS.JoinHardLinks"/>).
    /// </summary>
    public long? Ino { get; set; }
    /// <summary>The number of hard links (names) when there are more than one.</summary>
    public int? Nlink { get; set; }

    [JsonIgnore] public bool IsDir => Type == "dir";
    [JsonIgnore] public bool IsFile => Type == "file";
    [JsonIgnore] public bool IsLink => Type == "link";
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
        ["ELOOP"] = "Too many levels of symbolic links",
    };

    /// <summary>ENOENT, EACCES, ENOTDIR, EISDIR, EEXIST, ENOTEMPTY, EPERM, EINVAL or ELOOP.</summary>
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

public partial class VFS
{
    public FsNode Root { get; set; }

    public VFS(FsNode root) => Root = root;

    private static IEnumerable<string> Segments(string path) =>
        VfsLib.NormalizePath(path).Split('/').Where(s => s != "");

    /// <summary>How many symbolic links a lookup follows before it gives up (ELOOP), as in Linux.</summary>
    public const int MaxSymlinks = 40;

    /// <summary>
    /// Walks to a node and checks search permission (x) on every directory on the way. Symbolic links on
    /// the way are followed; the last one too, unless <paramref name="follow"/> is false (like lstat).
    /// </summary>
    public FsNode Lookup(string path, User user, bool follow = true) => Walk(VfsLib.NormalizePath(path), user, follow, 0).Node;

    /// <summary>The path without symbolic links (what `realpath` and `pwd -P` print).</summary>
    public string RealPath(string path, User user) => Walk(VfsLib.NormalizePath(path), user, true, 0).Path;

    private (FsNode Node, string Path) Walk(string norm, User user, bool follow, int hops)
    {
        var segs = norm.Split('/').Where(s => s != "").ToList();
        var node = Root;
        var cur = "/";
        for (int i = 0; i < segs.Count; i++)
        {
            if (node.Type != "dir" || node.Children is null) throw new FsError("ENOTDIR");
            if (!VfsLib.HasPerm(node, user, 'x')) throw new FsError("EACCES");
            if (!node.Children.TryGetValue(segs[i], out var next)) throw new FsError("ENOENT");
            if (next.Type == "link" && (follow || i < segs.Count - 1))
            {
                if (hops >= MaxSymlinks) throw new FsError("ELOOP");
                var target = VfsLib.ResolvePath(cur, next.Content ?? "");
                var rest = string.Join("/", segs.Skip(i + 1));
                return Walk(VfsLib.NormalizePath(rest == "" ? target : $"{target}/{rest}"), user, follow, hops + 1);
            }
            node = next;
            cur = cur == "/" ? $"/{segs[i]}" : $"{cur}/{segs[i]}";
        }
        return (node, cur);
    }

    /// <summary>The node itself, also when it is a symbolic link (like lstat).</summary>
    public FsNode? TryLookupLink(string path, User user)
    {
        try
        {
            return Lookup(path, user, follow: false);
        }
        catch (FsError)
        {
            return null;
        }
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

    [ThreadStatic] private static int writeHops;

    public void WriteFile(string path, string content, User user, bool append = false)
    {
        var norm = VfsLib.NormalizePath(path);
        if (norm == "/dev/null") return;
        var (dir, name) = Parent(norm, user);
        if (dir.Children!.TryGetValue(name, out var existing) && existing.Type == "link")
        {
            // Writing to a symbolic link writes to the file it points to (and creates it if it is missing).
            if (++writeHops > MaxSymlinks) throw new FsError("ELOOP");
            try
            {
                WriteFile(VfsLib.ResolvePath(RealPath(VfsLib.Dirname(norm), user), existing.Content ?? ""), content, user, append);
            }
            finally
            {
                writeHops--;
            }
            return;
        }
        if (existing is not null)
        {
            if (existing.Type == "dir") throw new FsError("EISDIR");
            if (!VfsLib.HasPerm(existing, user, 'w')) throw new FsError("EACCES");
            existing.Content = append ? (existing.Content ?? "") + content : content;
            existing.Size = null;
            existing.Mtime = Js.Now();
            return;
        }
        if (!VfsLib.HasPerm(dir, user, 'w')) throw new FsError("EACCES");
        dir.Children[name] = VfsLib.MakeFile(content, user.Name, NewFileMode, user.Groups.FirstOrDefault());
        dir.Mtime = Js.Now();
    }

    public void Mkdir(string path, User user)
    {
        var (dir, name) = Parent(path, user);
        if (dir.Children!.ContainsKey(name)) throw new FsError("EEXIST");
        if (!VfsLib.HasPerm(dir, user, 'w')) throw new FsError("EACCES");
        dir.Children[name] = VfsLib.MakeDir(user.Name, NewDirMode, null, user.Groups.FirstOrDefault());
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

    /// <summary>
    /// Removes a name (a symbolic link itself, not what it points to). A file with other hard links lives on
    /// under its other names. Checking whether directories are empty is up to the caller.
    /// </summary>
    public void Remove(string path, User user)
    {
        var (dir, name) = Parent(path, user);
        if (!dir.Children!.TryGetValue(name, out var node)) throw new FsError("ENOENT");
        if (!VfsLib.HasPerm(dir, user, 'w')) throw new FsError("EACCES");
        dir.Children.Remove(name);
        Unlinked(node);
        dir.Mtime = Js.Now();
    }

    /// <summary>A name of the node (and of everything in it) has gone: count down its hard links.</summary>
    private static void Unlinked(FsNode node)
    {
        if (node.Nlink is int n) node.Nlink = n > 2 ? n - 1 : null;
        foreach (var c in node.Children?.Values ?? Enumerable.Empty<FsNode>()) Unlinked(c);
    }

    // ---------- Permissions for new files (umask) ----------

    /// <summary>The umask of the shell: permissions taken away from new files and directories.</summary>
    public int Umask { get; set; } = Js.Oct(22);

    /// <summary>The mode of a new file: rw-rw-rw- without the umask (644 with the usual 022).</summary>
    public int NewFileMode => Js.Oct(666) & ~Umask;

    /// <summary>The mode of a new directory: rwxrwxrwx without the umask (755 with the usual 022).</summary>
    public int NewDirMode => Js.Oct(777) & ~Umask;

    // ---------- Hard links and inode numbers ----------

    private long nextIno;

    /// <summary>The inode number of a node (given the first time it is asked for).</summary>
    public long InoOf(FsNode node)
    {
        if (node.Ino is long ino) return ino;
        if (nextIno == 0)
        {
            long max = 0;
            void Scan(FsNode n)
            {
                if (n.Ino is long i && i > max) max = i;
                foreach (var c in n.Children?.Values ?? Enumerable.Empty<FsNode>()) Scan(c);
            }
            Scan(Root);
            nextIno = Math.Max(max + 1, 1_310_721);
        }
        node.Ino = nextIno++;
        return node.Ino.Value;
    }

    /// <summary>The number of hard links, as `ls -l` and `stat` show it.</summary>
    public static int LinkCount(FsNode n) =>
        n.Type == "dir" ? 2 + (n.Children?.Values.Count(c => c.Type == "dir") ?? 0) : n.Nlink ?? 1;

    /// <summary>Adds a hard link: the same file under one more name.</summary>
    public void HardLink(FsNode node, string path, User user)
    {
        if (node.Type == "dir") throw new FsError("EPERM");
        InoOf(node);
        Insert(path, node, user);
        node.Nlink = (node.Nlink ?? 1) + 1;
    }

    /// <summary>
    /// A saved terminal has each hard link as a separate copy with the same inode number: make them the same
    /// node again, so that a change through one name shows through the others.
    /// </summary>
    public void JoinHardLinks()
    {
        var first = new Dictionary<long, FsNode>();
        void Join(FsNode dir)
        {
            if (dir.Children is null) return;
            foreach (var (name, child) in dir.Children.ToList())
            {
                if (child.Nlink is > 1 && child.Ino is long ino)
                {
                    if (first.TryGetValue(ino, out var same)) dir.Children[name] = same;
                    else first[ino] = child;
                }
                Join(child);
            }
        }
        Join(Root);
    }

    public List<string> ListDir(string path, User user)
    {
        var node = Lookup(path, user);
        if (node.Type != "dir" || node.Children is null) throw new FsError("ENOTDIR");
        if (!VfsLib.HasPerm(node, user, 'r')) throw new FsError("EACCES");
        return node.Children.Keys.ToList().SortJs();
    }
}
