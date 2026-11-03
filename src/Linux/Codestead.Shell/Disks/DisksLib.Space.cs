namespace Codestead.Shell;

// DisksLib: how much space files and file systems use (for df and du).

public static partial class DisksLib
{
    // ---------- Space ----------

    private const long BlockBytes = 4096;
    private static readonly HashSet<string> Pseudo = new() { "proc", "sysfs" };

    private static long CeilBlocks(FsNode node) => (long)Math.Ceiling(VfsLib.NodeSize(node) / (double)BlockBytes) * BlockBytes;

    private static long TreeUsage(FsNode node)
    {
        if (node.Type == "file") return CeilBlocks(node);
        long sum = BlockBytes;
        if (node.Children is not null) foreach (var child in node.Children.Values) sum += TreeUsage(child);
        return sum;
    }

    /// <summary>How much the files under a mount point take, without other mounts below it.</summary>
    private static long MountTreeUsage(VFS vfs, DiskState state, Mount m, User root)
    {
        if (Pseudo.Contains(m.Fstype)) return 0;
        var start = vfs.TryLookup(m.Target, root);
        if (start is null) return 0;
        var others = new HashSet<string>(state.Mounts.Where(o => o != m).Select(o => o.Target));
        long Walk(FsNode node, string path)
        {
            if (node.Type == "file") return CeilBlocks(node);
            long sum = BlockBytes;
            if (node.Children is not null)
            {
                foreach (var (name, child) in node.Children)
                {
                    var p = path == "/" ? $"/{name}" : $"{path}/{name}";
                    if (others.Contains(p)) continue;
                    sum += Walk(child, p);
                }
            }
            return sum;
        }
        return Walk(start, m.Target);
    }

    private static double FsOverhead(string? fstype) =>
        fstype == "ext4" || fstype == "ext2" ? 0.983 : fstype == "vfat" ? 0.999 : 1;

    /// <summary>How much a file system on a partition uses, mounted or not.</summary>
    public static Usage PartitionUsage(VFS vfs, DiskState state, FsInfo dev, string devName, User root)
    {
        double size = Math.Floor(BlockSize(dev) * FsOverhead(dev.Fstype));
        double used = dev.Base ?? 0;
        var mounts = MountsOf(state, devName);
        if (mounts.Count > 0) foreach (var m in mounts) used += MountTreeUsage(vfs, state, m, root);
        else if (dev.Root is not null) used += TreeUsage(dev.Root);
        used = Math.Min(used, size);
        double reserved = dev.Fstype == "ext4" || dev.Fstype == "ext2" ? Math.Floor(size * 0.05) : 0;
        return new Usage { Size = size, Used = used, Avail = Math.Max(0, size - used - reserved) };
    }

    /// <summary>The space for a mount (what df shows).</summary>
    public static Usage MountUsage(VFS vfs, DiskState state, Mount m, User root)
    {
        if (m.Dev is not null)
        {
            var b = FindBlock(state, m.Dev);
            if (b is not null) return PartitionUsage(vfs, state, b.Dev, b.Name, root);
        }
        double size = m.Size ?? 0;
        double used = Math.Min(size, (m.Base ?? 0) + (m.Fstype == "devtmpfs" ? 0 : MountTreeUsage(vfs, state, m, root)));
        return new Usage { Size = size, Used = used, Avail = Math.Max(0, size - used) };
    }
}
