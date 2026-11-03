namespace Codestead.Shell;

// Disk model: the result of looking up a block device.

/// <summary>A block device lookup: a whole disk or a partition.</summary>
public partial class Block
{
    public string Path { get; set; } = "";
    public string Name { get; set; } = "";
    public Disk Disk { get; set; } = null!;
    public Partition? Part { get; set; }
    /// <summary>The partition, or the disk if it is a whole disk.</summary>
    public FsInfo Dev { get; set; } = null!;
}
