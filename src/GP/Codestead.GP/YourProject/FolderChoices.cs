namespace Codestead.GP.YourProject;

/// <summary>What folders.json holds: the folder per "api/chapter", and the base folder for suggestions.</summary>
public sealed class FolderChoices
{
    public Dictionary<string, string> Folders { get; set; } = new(StringComparer.Ordinal);

    public string? Base { get; set; }
}
