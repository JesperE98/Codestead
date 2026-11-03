namespace Codestead.Shell;

// The result of looking up a command name (see Shell.ResolveCommand).

/// <summary>Result of looking up a command name: "notfound", "error", "binary" or "script".</summary>
public sealed partial class ResolvedCommand
{
    public string Kind { get; init; } = "notfound";
    public string Message { get; init; } = "";
    public string Impl { get; init; } = "";
    public string Path { get; init; } = "";
    public string Content { get; init; } = "";
}
