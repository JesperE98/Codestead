namespace Codestead.Shell;

// Virtual file system: the tree with lookups, reads, writes, umask and hard links.

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
