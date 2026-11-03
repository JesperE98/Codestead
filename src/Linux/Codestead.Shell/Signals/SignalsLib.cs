namespace Codestead.Shell;

// Helpers for the control signals.

public static partial class SignalsLib
{
    public static bool IsControlSignal(Exception e) => e is ControlSignal;
}
