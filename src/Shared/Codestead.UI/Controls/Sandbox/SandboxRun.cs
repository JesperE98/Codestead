namespace Codestead.UI.Controls;

/// <summary>One command line run in a sandbox terminal.</summary>
/// <param name="Output">The output without colours.</param>
/// <param name="Finished">False while the command waits for more input (a password, an unfinished line).</param>
public sealed record SandboxRun(string Line, string Output, int ExitCode, bool Finished);
