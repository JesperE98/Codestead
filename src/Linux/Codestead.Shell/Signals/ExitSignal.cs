namespace Codestead.Shell;

// Control signal: `exit` in a script.

/// <summary>`exit` in a script.</summary>
public sealed class ExitSignal(int code) : ControlSignal
{
    public int Code { get; } = code;
}
