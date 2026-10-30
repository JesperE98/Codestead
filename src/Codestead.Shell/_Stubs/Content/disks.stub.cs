// TEMPORARY STUB (Content) – what src/content/chapters.ts needs from src/shell/disks.ts.
// Delete when the real DisksLib has been ported (see docs/PORTING.md).
namespace Codestead.Shell;

public partial class Mount
{
    public string Source { get; set; } = "";
    public string Target { get; set; } = "";
    public string Fstype { get; set; } = "";
    public string Options { get; set; } = "";
    public string? Dev { get; set; }
    public string? Subvol { get; set; }
    public long? Size { get; set; }
    public long? Base { get; set; }
    public FsNode? Under { get; set; }
    public bool? System { get; set; }
}

public partial class DiskState
{
    public List<Mount> Mounts { get; set; } = new();
}

public static partial class DisksLib
{
    public const string UsbPart = "sdb1";
    public static string RootUuid(Distro distro) => throw new NotImplementedException();
    public static FsNode? PartitionRoot(VFS vfs, DiskState state, string devName, User root) => throw new NotImplementedException();
}
