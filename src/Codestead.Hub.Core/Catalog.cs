using System.Text.Json;
using System.Text.Json.Serialization;

namespace Codestead.Hub.Core;

/// <summary>
/// The list of tools the hub can install, published as catalog.json (plus catalog.json.sig) in the
/// public releases repository. Written by the release workflow (packaging/catalog.py).
/// </summary>
public sealed class Catalog
{
    public const int CurrentSchema = 1;

    public int Schema { get; set; }
    /// <summary>When the catalog was written (UTC, ISO 8601).</summary>
    public string Generated { get; set; } = "";
    public List<CatalogTool> Tools { get; set; } = new();

    public static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true,
    };

    /// <summary>Parses a catalog. Throws <see cref="CatalogException"/> if it is not a valid catalog.</summary>
    public static Catalog Parse(byte[] utf8)
    {
        Catalog? c;
        try
        {
            c = JsonSerializer.Deserialize<Catalog>(utf8, Json);
        }
        catch (JsonException e)
        {
            throw new CatalogException("The catalog is not valid JSON.", e);
        }
        if (c is null) throw new CatalogException("The catalog is empty.");
        if (c.Schema != CurrentSchema) throw new CatalogException($"Unsupported catalog schema {c.Schema} (this hub understands {CurrentSchema}). Update the hub.");
        foreach (var t in c.Tools) t.Validate();
        return c;
    }

    public CatalogTool? Find(string id) => Tools.FirstOrDefault(t => t.Id == id);
}

public sealed class CatalogTool
{
    /// <summary>Package id, e.g. "codestead-linux". Also the folder name of the installation.</summary>
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    /// <summary>Short description per language code; "en" is required.</summary>
    public Dictionary<string, string> Description { get; set; } = new();
    public string Version { get; set; } = "";
    public string? ReleaseNotesUrl { get; set; }
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

public sealed class CatalogAsset
{
    /// <summary>Portable archive: .zip on Windows, .tar.gz on Linux.</summary>
    public string Url { get; set; } = "";
    public string Sha256 { get; set; } = "";
    public long Size { get; set; }
    /// <summary>The program to start, relative to the archive root (e.g. "Codestead.Linux.exe").</summary>
    public string Executable { get; set; } = "";
}

public sealed class CatalogException : Exception
{
    public CatalogException(string message, Exception? inner = null) : base(message, inner) { }
}

/// <summary>Versions "major.minor.patch" (as in build/Codestead.props).</summary>
public static class SemVer
{
    public static Version? Parse(string? s) =>
        s is not null && System.Text.RegularExpressions.Regex.IsMatch(s, @"\A\d+\.\d+\.\d+\z") && System.Version.TryParse(s, out var v) ? v : null;

    /// <summary>Is <paramref name="candidate"/> newer than <paramref name="installed"/>?</summary>
    public static bool IsNewer(string candidate, string installed) =>
        Parse(candidate) is { } c && Parse(installed) is { } i && c > i;
}
