namespace Codestead.Shell.Commands;

// awk: a syntax error found by the tokenizer or parser.

public partial class AwkSyntaxError : Exception
{
    public int Pos { get; }
    /// <summary>Set when the construct exists in real awk but not in the simulator.</summary>
    public AwkUnsupported? Unsupported { get; }

    public AwkSyntaxError(string message, int pos, AwkUnsupported? unsupported = null) : base(message)
    {
        Pos = pos;
        Unsupported = unsupported;
    }
}
