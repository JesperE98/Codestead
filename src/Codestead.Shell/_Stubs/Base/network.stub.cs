// TEMPORARY STUB – deleted when src/shell/network.ts has been ported (see docs/PORTING.md).
// Returns placeholders (not throwing) so Shell.Create works before the real module exists.
namespace Codestead.Shell;

public static partial class NetworkLib
{
    public static string ResolvConf(Distro distro) => "";

    public static FsNode MinserverBinary()
    {
        var node = VfsLib.MakeFile($"{VfsLib.Elf}\u0002\u0001\u0001 (simulerad binärfil: minserver)", "root", Js.Oct(755));
        node.Size = 48_312;
        return node;
    }
}
