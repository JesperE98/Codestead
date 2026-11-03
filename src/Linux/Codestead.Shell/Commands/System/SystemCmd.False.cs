namespace Codestead.Shell.Commands;

// The false command: does nothing, always fails.

public static partial class SystemCmd
{
    private static readonly CommandDef FalseCmd = Simple("false", "Gör ingenting, misslyckas alltid", _ => 1);
}
