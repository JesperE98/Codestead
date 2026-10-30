// TEMPORARY STUB – deleted when src/shell/packages.ts has been ported (see docs/PORTING.md).
// Functions from PackagesLib that Commands/PkgCmd.cs, ReposCmd.cs and UniversalCmd.cs use.
// (Packages, InstallPackage, InstallCommand and PackageProviding are in _Stubs/Core/packages.stub.cs.)
namespace Codestead.Shell;

public static partial class PackagesLib
{
    public static bool IsKnown(Shell? sh, PackageDef pkg) => throw new NotImplementedException();
    public static PackageDef? FindPackage(Family family, string name, Shell? sh = null) => throw new NotImplementedException();
    public static bool IsForeign(Family family, PackageDef pkg) => throw new NotImplementedException();
    public static string AvailableVersion(Shell sh, PackageDef pkg) => throw new NotImplementedException();
    public static bool IsInstalled(Shell sh, PackageDef pkg) => throw new NotImplementedException();
    public static List<PackageDef> Upgradable(Shell sh) => throw new NotImplementedException();
    public static List<PackageDef> SearchPackages(Family family, string query, Shell? sh = null) => throw new NotImplementedException();
    public static void RemovePackage(Shell sh, PackageDef pkg) => throw new NotImplementedException();
    public static string FormatKb(long kb) => throw new NotImplementedException();
    public static string FormatMiB(long kb) => throw new NotImplementedException();
}
