namespace Codestead.Shell;

// Disk model: a whole disk (the system disk, the USB stick, zram).

public partial class Disk : FsInfo
{
    public string Name { get; set; } = "";
    public long Sectors { get; set; }
    public string Model { get; set; } = "";
    public bool Removable { get; set; }
    /// <summary>Connection: sata, usb or empty (zram).</summary>
    public string Tran { get; set; } = "";
    public int Major { get; set; }
    public int Minor { get; set; }
    /// <summary>"gpt" or "dos".</summary>
    public string? Pttype { get; set; }
    public string? DiskId { get; set; }
    public List<Partition> Partitions { get; set; } = new();
}
