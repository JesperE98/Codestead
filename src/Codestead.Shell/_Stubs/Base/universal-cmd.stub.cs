// TEMPORARY STUB – deleted when src/shell/commands/universal.ts has been ported (see docs/PORTING.md).
// Returns placeholders (not throwing) so Shell.Create works before the real module exists.
namespace Codestead.Shell.Commands;

public static partial class UniversalCmd
{
    public const string AppimageDir = "Nedladdningar";
    public const string AppimageName = "Kalkylator.AppImage";

    public static FsNode AppImageNode(string owner, string? group = null)
    {
        var node = VfsLib.MakeFile(
            $"{VfsLib.Elf}\u0002\u0001\u0001 (simulerad binärfil: appimage-runtime)\nAppImage: Kalkylator 2.3.1\nDesktop: kalkylator.desktop\nType 2 AppImage (squashfs)\n",
            owner, Js.Oct(644), group ?? owner);
        node.Size = 48_312_832;
        return node;
    }
}
