// TEMPORARY STUB – needed by Commands/SystemCmd.cs (help) until commands/man-en.ts is ported
// (see docs/PORTING.md). Delete this file when ManEnCmd.SummaryFor exists.
namespace Codestead.Shell.Commands;

public static partial class ManEnCmd
{
    public static string SummaryFor(CommandDef def, Shell sh) => sh.Lang == "sv" ? def.Summary : def.SummaryEn ?? def.Summary;
}
