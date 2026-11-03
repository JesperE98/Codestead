namespace Codestead.Shell.Commands;

// awk: where the interpreter writes output and reads input.

public partial class AwkIO
{
    public required Action<string> Out { get; init; }
    /// <summary>Reads a file; returns null (and prints the error itself) if that failed.</summary>
    public required Func<string, AwkInput?> ReadInput { get; init; }
    /// <summary>Like mawk: toupper/tolower only change a-z (not å, ä, ö).</summary>
    public bool AsciiCase { get; init; }
}
