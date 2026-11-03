namespace Codestead.Content;

// What a task's check gets to look at after each command.

/// <summary>What a task may look at after each command. (TS: CheckCtx)</summary>
public partial class CheckContext
{
    public required Shell.Shell Sh { get; init; }
    public required Distro Distro { get; init; }
    /// <summary>The command line that was run (without leading/trailing spaces).</summary>
    public string Line { get; init; } = "";
    /// <summary>Output without colour codes.</summary>
    public string Output { get; init; } = "";
    public int ExitCode { get; init; }
}
