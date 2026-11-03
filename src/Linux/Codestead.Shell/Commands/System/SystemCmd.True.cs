namespace Codestead.Shell.Commands;

// The true command: does nothing, always succeeds.

public static partial class SystemCmd
{
    private static readonly CommandDef TrueCmd = Simple("true", "Gör ingenting, lyckas alltid", _ => 0);
}
