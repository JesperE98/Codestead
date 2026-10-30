// TEMPORARY STUB – needed by Commands/ExtrasCmd.cs (htop) until commands/procs.ts is ported
// (see docs/PORTING.md). Delete this file when ProcsCmd.CurrentProcs exists.
namespace Codestead.Shell.Commands;

public static partial class ProcsCmd
{
    /// <summary>export { snapshot as currentProcs } in commands/procs.ts.</summary>
    public static List<Proc> CurrentProcs(CmdCtx ctx, string? self = null) => throw new NotImplementedException();
}
