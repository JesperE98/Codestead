// TEMPORARY STUB – deleted by the agent that ports the real module (see docs/PORTING.md).
// It only exists so the core compiles before that module has been ported.
namespace Codestead.Shell;

public partial class DiskState { }

public static partial class DisksLib
{
    public static DiskState SetupDisks(Distro distro, VFS vfs) => new();
}
