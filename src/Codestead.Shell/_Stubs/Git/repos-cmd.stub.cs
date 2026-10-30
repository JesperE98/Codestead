// TEMPORARY STUB (added by the Git port) – delete when commands/repos.ts has been ported (see docs/PORTING.md).
// git clone calls ReposCmd.AurClone first; until the real one exists, no URL is treated as an AUR clone.
namespace Codestead.Shell.Commands;

public static partial class ReposCmd
{
    /// <summary>`git clone https://aur.archlinux.org/PACKAGE.git [DIR]` – null when the URL is not an AUR URL.</summary>
    public static int? AurClone(CmdCtx ctx, List<string> args) => null;
}
