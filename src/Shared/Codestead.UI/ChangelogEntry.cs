namespace Codestead.UI;

// One version in a changelog.

/// <summary>One version in a changelog: what changed, per language.</summary>
public sealed class ChangelogEntry
{
    public string Version { get; set; } = "";
    /// <summary>The release date, yyyy-MM-dd.</summary>
    public string Date { get; set; } = "";
    /// <summary>The changes per language code ("en" is required), one short markdown line each.</summary>
    public Dictionary<string, List<string>> Changes { get; set; } = new();

    /// <summary>The changes in a language, or in English when the language has none.</summary>
    public List<string> ChangesFor(string lang) =>
        Changes.TryGetValue(lang, out var c) && c.Count > 0 ? c : Changes.TryGetValue("en", out var en) ? en : new List<string>();
}
