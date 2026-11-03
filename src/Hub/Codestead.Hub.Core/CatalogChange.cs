namespace Codestead.Hub.Core;

// One version's changes in the catalog.

/// <summary>One version of a tool in the catalog's "changes": the changes per language code ("en" is always there).</summary>
public sealed class CatalogChange
{
    public string Version { get; set; } = "";
    public string Date { get; set; } = "";
    public Dictionary<string, List<string>> Changes { get; set; } = new();
}
