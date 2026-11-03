using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Codestead.UI;

/// <summary>
/// What changed in each version of a product (changelog/&lt;product-id&gt;.json, newest first). Each app
/// embeds its own changelog and shows the news after an update; the hub's catalog carries the tools' news.
/// </summary>
public static class Changelog
{
    public static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true,
    };

    /// <summary>Parses a changelog; an unreadable one is empty (the news are a nicety, never an error).</summary>
    public static List<ChangelogEntry> Parse(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new();
        try
        {
            return (JsonSerializer.Deserialize<List<ChangelogEntry>>(json, Json) ?? new())
                .Where(e => ParseVersion(e.Version) is not null)
                .OrderByDescending(e => ParseVersion(e.Version))
                .ToList();
        }
        catch (JsonException)
        {
            return new();
        }
    }

    /// <summary>Reads a changelog embedded in an assembly under <paramref name="resourceName"/>.</summary>
    public static List<ChangelogEntry> Embedded(System.Reflection.Assembly assembly, string resourceName = "changelog.json")
    {
        using var stream = assembly.GetManifestResourceStream(resourceName);
        if (stream is null) return new();
        using var reader = new StreamReader(stream);
        return Parse(reader.ReadToEnd());
    }

    /// <summary>"0.5.4" → (0, 5, 4); null if it is not major.minor.patch.</summary>
    public static Version? ParseVersion(string? v)
    {
        var parts = (v ?? "").Split('-', '+')[0].Split('.');
        if (parts.Length != 3) return null;
        var n = new int[3];
        for (int i = 0; i < 3; i++)
            if (!int.TryParse(parts[i], NumberStyles.None, CultureInfo.InvariantCulture, out n[i])) return null;
        return new Version(n[0], n[1], n[2]);
    }

    /// <summary>The entries after <paramref name="fromExclusive"/> up to and including <paramref name="toInclusive"/>, newest first.</summary>
    public static List<ChangelogEntry> Between(IEnumerable<ChangelogEntry> entries, string? fromExclusive, string toInclusive)
    {
        var from = ParseVersion(fromExclusive);
        var to = ParseVersion(toInclusive);
        if (to is null) return new();
        return entries.Where(e => ParseVersion(e.Version) is { } v && v <= to && (from is null || v > from)).ToList();
    }

    // ---------- "Seen" version per product ----------

    private sealed class SeenState
    {
        public string? Seen { get; set; }
    }

    private const string SeenFile = "whatsnew";

    /// <summary>The newest version whose news the user has seen (in that product's own storage).</summary>
    public static string? Seen(Storage storage) => storage.Load<SeenState>(SeenFile)?.Seen;

    public static void MarkSeen(Storage storage, string version) => storage.Save(SeenFile, new SeenState { Seen = version });

    /// <summary>
    /// What to show at start: the news since the version the user saw last, when the app has been updated.
    /// <paramref name="existingUser"/> tells a first installation (nothing to show) from an update from a version
    /// older than this feature (show the current version's news). Marks the current version as seen.
    /// </summary>
    public static List<ChangelogEntry> NewsAtStart(Storage storage, IEnumerable<ChangelogEntry> entries, string currentVersion, bool existingUser)
    {
        var seen = Seen(storage);
        var news = new List<ChangelogEntry>();
        var current = ParseVersion(currentVersion);
        if (current is null || current == new Version(0, 0, 0)) return news; // a development build
        if (seen is null)
        {
            if (existingUser) news = Between(entries, null, currentVersion).Take(1).ToList();
        }
        else if (ParseVersion(seen) is { } s && s < current)
        {
            news = Between(entries, seen, currentVersion);
        }
        if (seen != currentVersion) MarkSeen(storage, currentVersion);
        return news;
    }
}
