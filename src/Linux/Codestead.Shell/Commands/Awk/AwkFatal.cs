namespace Codestead.Shell.Commands;

// awk: a fatal error while the program runs.

public partial class AwkFatal : Exception
{
    public AwkFatal(string message) : base(message) { }
}
