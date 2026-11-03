namespace Codestead.Shell;

// Port of src/shell/signals.ts – exceptions used to jump out of scripts, functions and loops.
// They are caught by the shell and must never be shown as "internal error".

public abstract class ControlSignal : Exception
{
    protected ControlSignal(string? message = null) : base(message) { }
}
