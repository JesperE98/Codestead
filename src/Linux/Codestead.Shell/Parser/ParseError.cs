namespace Codestead.Shell;

// Syntax error from the parser (or a note that the code is only incomplete).

public partial class ParseError : Exception
{
    /// <summary>True when the code is only incomplete (e.g. missing "done") – the shell then shows "> " and waits for more.</summary>
    public bool Incomplete { get; }

    public ParseError(string message, bool incomplete = false) : base(message) => Incomplete = incomplete;
}
