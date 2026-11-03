namespace Codestead.Shell;

// What Shell.Execute returns for one typed line: output, exit code and terminal flags.

public partial class ExecResult
{
    /// <summary>The command line that ran (when answering a question: the original line).</summary>
    public string Line { get; set; } = "";
    public string Output { get; set; } = "";
    public int ExitCode { get; set; }
    public bool Clear { get; set; }
    /// <summary>True if a command waits for an answer (e.g. "Do you want to continue? [Y/n]").</summary>
    public bool Pending { get; set; }
    /// <summary>True if the line was not finished (e.g. a for loop without "done") – the shell waits for more lines.</summary>
    public bool Incomplete { get; set; }
}
