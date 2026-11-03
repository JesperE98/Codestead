namespace Codestead.Hub.Core;

// One tool in the catalog.

public sealed class CatalogTool
{
    /// <summary>Package id, e.g. "codestead-linux". Also the folder name of the installation.</summary>
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    /// <summary>Short description per language code; "en" is required.</summary>
    public Dictionary<string, string> Description { get; set; } = new();
    public string Version { get; set; } = "";
    public string? ReleaseNotesUrl { get; set; }
    /// <summary>What changed in the latest versions, newest first (changelog/&lt;id&gt;.json). Older catalogs have none.</summary>
    public List<CatalogChange>? Changes { get; set; }
    /// <summary>Downloads per platform, keyed by runtime id ("win-x64", "linux-x64").</summary>
    public Dictionary<string, CatalogAsset> Assets { get; set; } = new();

    public string DescriptionFor(string lang) =>
        Description.TryGetValue(lang, out var d) ? d : Description.TryGetValue("en", out var en) ? en : "";

    public CatalogAsset? AssetFor(string rid) => Assets.TryGetValue(rid, out var a) ? a : null;

    internal void Validate()
    {
        if (!ToolStore.IsSafeId(Id)) throw new CatalogException($"Invalid tool id \"{Id}\".");
        if (SemVer.Parse(Version) is null) throw new CatalogException($"{Id}: invalid version \"{Version}\".");
        foreach (var (rid, a) in Assets)
        {
            if (!Uri.TryCreate(a.Url, UriKind.Absolute, out var uri) || (uri.Scheme != "https" && uri.Scheme != "file"))
                throw new CatalogException($"{Id}/{rid}: the download must be an https address.");
            if (a.Sha256.Length != 64 || !a.Sha256.All(Uri.IsHexDigit)) throw new CatalogException($"{Id}/{rid}: invalid SHA-256.");
            if (a.Size <= 0) throw new CatalogException($"{Id}/{rid}: invalid size.");
            if (string.IsNullOrWhiteSpace(a.Executable) || a.Executable.Contains("..") || Path.IsPathRooted(a.Executable))
                throw new CatalogException($"{Id}/{rid}: invalid executable \"{a.Executable}\".");
        }
    }
}
