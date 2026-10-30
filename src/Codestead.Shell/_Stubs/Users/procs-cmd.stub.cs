// TEMPORARY STUB – deleted when commands/procs.ts has been ported (see docs/PORTING.md).
// Needed by `w` in Commands/UsersCmd.cs (currentProcs = the non-exported snapshot() in procs.ts).
namespace Codestead.Shell.Commands;

public static partial class ProcsCmd
{
    public static List<Proc> CurrentProcs(CmdCtx ctx, string? self = null) => throw new NotImplementedException();
}
