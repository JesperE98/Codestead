namespace Codestead.Shell;

// Disk model: a partition.

public partial class Partition : FsInfo
{
    public string Name { get; set; } = "";
    /// <summary>The first sector.</summary>
    public long Start { get; set; }
    public long Sectors { get; set; }
    /// <summary>Partition type shown by fdisk, e.g. "EFI System".</summary>
    public string Ptype { get; set; } = "";
    /// <summary>MBR type (only for dos partition tables), e.g. "c".</summary>
    public string? PtypeId { get; set; }
    public string Partuuid { get; set; } = "";
}
