using System.Text.Json.Serialization;

namespace Codestead.Shell;

// Disk model: a file system (or swap) on a partition or a whole device.

/// <summary>A file system (or swap) on a partition or a whole device.</summary>
public partial class FsInfo
{
    public string? Fstype { get; set; }
    public string? Fsver { get; set; }
    public string? Label { get; set; }
    public string? Uuid { get; set; }
    /// <summary>Bytes used by things that are not in the VFS (the system's own files).</summary>
    public double? Base { get; set; }
    /// <summary>The file system's content when it is not mounted (e.g. the USB stick).</summary>
    public FsNode? Root { get; set; }
    /// <summary>In use as swap right now – cannot be mounted or formatted.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public bool SwapActive { get; set; }

    /// <summary>Copies the file system fields from another FsInfo ({ ...fs }).</summary>
    internal void CopyFsFrom(FsInfo fs)
    {
        Fstype = fs.Fstype;
        Fsver = fs.Fsver;
        Label = fs.Label;
        Uuid = fs.Uuid;
        Base = fs.Base;
        Root = fs.Root;
        SwapActive = fs.SwapActive;
    }
}
