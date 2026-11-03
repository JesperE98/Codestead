namespace Codestead.Shell;

// Control signal: `break` and `continue`.

/// <summary>`break` and `continue` (with number of levels).</summary>
public sealed class LoopSignal(string kind, int levels) : ControlSignal
{
    /// <summary>"break" or "continue".</summary>
    public string Kind { get; } = kind;
    public int Levels { get; set; } = levels;
}
