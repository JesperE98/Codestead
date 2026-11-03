namespace Codestead.UI.Controls;

/// <summary>
/// Where a lesson's "try it" questions run, separate from the learner's own work: a fresh environment for every
/// question. A tool supplies its own (Codestead Linux: a fresh simulated terminal; a C++ tool could compile and run).
/// </summary>
public interface ISandbox
{
    /// <summary>A new interactive terminal on a fresh environment.</summary>
    ISandboxTerminal NewTerminal();

    /// <summary>What <paramref name="command"/> prints (without colours) in a fresh environment.</summary>
    string OutputOf(string command);
}
