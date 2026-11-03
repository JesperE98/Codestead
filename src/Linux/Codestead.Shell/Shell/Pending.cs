namespace Codestead.Shell;

// A question the shell is waiting for the user to answer (yes/no or a line of text).

public partial class Pending
{
    public string Question { get; set; } = "";
    public bool DefaultYes { get; set; }
    public string User { get; set; } = "";
    public string Line { get; set; } = "";
    public required Func<bool, Sink, string, int> OnAnswer { get; set; }
    /// <summary>The rest of the command line, run when the question has been answered.</summary>
    internal Func<XIO, int>? Resume { get; set; }
    /// <summary>The answer is secret (a password): the terminal does not show what is typed.</summary>
    public bool Secret { get; set; }
}
