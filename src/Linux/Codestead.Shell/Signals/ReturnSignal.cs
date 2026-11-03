namespace Codestead.Shell;

// Control signal: `return` in a function or sourced script.

/// <summary>`return` in a function or a sourced script.</summary>
public sealed class ReturnSignal(int code) : ControlSignal
{
    public int Code { get; } = code;
}
