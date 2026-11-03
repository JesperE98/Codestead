namespace Codestead.Shell;

// Disk model: the saved state of all disks and mounts.

public partial class DiskState
{
    public List<Disk> Disks { get; set; } = new();
    public List<Mount> Mounts { get; set; } = new();
}
