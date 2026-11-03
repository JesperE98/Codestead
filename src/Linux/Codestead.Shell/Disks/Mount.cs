using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Disk model: a mounted file system.

public partial class Mount
{
    /// <summary>What `mount` shows as the source: /dev/sdb1, tmpfs, proc ...</summary>
    public string Source { get; set; } = "";
    public string Target { get; set; } = "";
    public string Fstype { get; set; } = "";
    public string Options { get; set; } = "";
    /// <summary>The device (e.g. "sdb1") when the source is a disk or partition.</summary>
    public string? Dev { get; set; }
    /// <summary>btrfs subvolume, shown as /dev/sda3[/root] by findmnt.</summary>
    public string? Subvol { get; set; }
    /// <summary>Size in bytes for file systems not on a disk (tmpfs).</summary>
    public long? Size { get; set; }
    /// <summary>Bytes used in addition to the files in the VFS.</summary>
    public double? Base { get; set; }
    /// <summary>The directory that was at the mount point before (put back on umount).</summary>
    public FsNode? Under { get; set; }
    /// <summary>The system's own mounts – cannot be unmounted.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public bool System { get; set; }
}
