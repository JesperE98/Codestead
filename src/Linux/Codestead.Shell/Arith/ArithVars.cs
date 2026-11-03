namespace Codestead.Shell;

// How arithmetic reads and writes shell variables.

public partial class ArithVars
{
    public required Func<string, string?> Get { get; init; }
    public required Action<string, string> Set { get; init; }
}
