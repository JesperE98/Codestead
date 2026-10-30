// TEMPORARY STUB – deleted by the agent that ports the real module (see docs/PORTING.md).
// It only exists so the core compiles before that module has been ported.
namespace Codestead.Shell.Commands;

public static partial class ManEnCmd
{
    public static string ManFor(CommandDef def, Shell sh) => def.Man ?? "";
}
