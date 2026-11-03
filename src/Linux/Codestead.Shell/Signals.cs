namespace Codestead.Shell;

// Port of src/shell/signals.ts – exceptions used to jump out of scripts, functions and loops.
// They are caught by the shell and must never be shown as "internal error".

public abstract class ControlSignal : Exception
{
    protected ControlSignal(string? message = null) : base(message) { }
}

/// <summary>`exit` in a script.</summary>
public sealed class ExitSignal(int code) : ControlSignal
{
    public int Code { get; } = code;
}

/// <summary>`return` in a function or a sourced script.</summary>
public sealed class ReturnSignal(int code) : ControlSignal
{
    public int Code { get; } = code;
}

/// <summary>`break` and `continue` (with number of levels).</summary>
public sealed class LoopSignal(string kind, int levels) : ControlSignal
{
    /// <summary>"break" or "continue".</summary>
    public string Kind { get; } = kind;
    public int Levels { get; set; } = levels;
}

/// <summary>The shell ran too many commands in a single run (e.g. an infinite loop).</summary>
public sealed class LimitError(string message) : ControlSignal(message);

public static partial class SignalsLib
{
    public static bool IsControlSignal(Exception e) => e is ControlSignal;
}
