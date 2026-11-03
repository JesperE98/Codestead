namespace Codestead.Hub.Core;

// A tool installed by the hub.

/// <summary>A tool installed by the hub.</summary>
public sealed record InstalledTool(string Id, string Version, string Executable, string? Previous)
{
    /// <summary>Set by <see cref="ToolStore"/>: the folder of the installed version.</summary>
    public string Directory { get; init; } = "";
    public string ExecutablePath => Path.Combine(Directory, Executable);
}
