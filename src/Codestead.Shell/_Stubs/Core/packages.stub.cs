// TEMPORARY STUB – deleted by the agent that ports the real module (see docs/PORTING.md).
// It only exists so the core compiles before that module has been ported.
namespace Codestead.Shell;

public static partial class PackagesLib
{
    public static List<PackageDef> Packages { get; } = new();
    public static void InstallPackage(Shell sh, PackageDef pkg) { }
    public static void InstallCommand(Shell sh, string cmd) { }
    public static PackageDef? PackageProviding(Family family, string command) => null;
}
