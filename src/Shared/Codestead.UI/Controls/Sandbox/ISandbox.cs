namespace Codestead.UI.Controls;

/// <summary>
/// A fresh environment, separate from the learner's own work. A "try it" question uses it to find what its command
/// prints, so that another command with the same output also counts. A tool supplies its own (Codestead Linux:
/// a fresh simulated computer; a C++ tool could compile and run).
/// </summary>
public interface ISandbox
{
    /// <summary>What <paramref name="command"/> prints (without colours) in a fresh environment.</summary>
    string OutputOf(string command);
}
