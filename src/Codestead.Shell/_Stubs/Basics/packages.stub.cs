// TEMPORARY STUB – needed by Commands/ExtrasCmd.cs (fastfetch) until packages.ts is ported
// (see docs/PORTING.md). Delete this file when PackagesLib.IsInstalled exists.
namespace Codestead.Shell;

public static partial class PackagesLib
{
    public static bool IsInstalled(Shell sh, PackageDef pkg) => sh.Installed.ContainsKey(pkg.Id);
}
