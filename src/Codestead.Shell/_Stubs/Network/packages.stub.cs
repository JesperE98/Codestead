// TEMPORARY STUB (added by the Network port) – delete when packages.ts has been ported (see docs/PORTING.md).
// NetworkTests uses findPackage().
namespace Codestead.Shell;

public static partial class PackagesLib
{
    public static PackageDef? FindPackage(Family family, string name, Shell? sh = null) => throw new NotImplementedException();
}
