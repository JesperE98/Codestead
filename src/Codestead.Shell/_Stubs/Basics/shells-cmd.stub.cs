// TEMPORARY STUB – needed by Commands/SystemCmd.cs (bash) until commands/shells.ts is ported
// (see docs/PORTING.md). Delete this file when ShellsCmd.StartBash exists.
namespace Codestead.Shell.Commands;

public static partial class ShellsCmd
{
    /// <summary>In zsh and fish `bash` starts a new bash shell. null means "not started".</summary>
    public static int? StartBash(CmdCtx ctx) => null;
}
