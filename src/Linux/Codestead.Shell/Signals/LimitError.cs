namespace Codestead.Shell;

// Control signal: too many commands in one run (e.g. an infinite loop).

/// <summary>The shell ran too many commands in a single run (e.g. an infinite loop).</summary>
public sealed class LimitError(string message) : ControlSignal(message);
