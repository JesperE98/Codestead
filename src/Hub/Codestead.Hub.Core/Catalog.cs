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
