using System.Text.Json;

namespace Codestead.GP.Course;

/// <summary>
/// A chapter's title and task texts in one language (i18n/&lt;lang&gt;/&lt;id&gt;.json). The title, a task's text and its
/// hint are a string, or an object with one string per API: { "opengl": …, "vulkan": …, "d3d12": … }.
/// </summary>
public sealed class ChapterStrings
{
    public Dictionary<string, string>? Title { get; private set; }
    public Dictionary<string, (Dictionary<string, string>? Text, Dictionary<string, string>? Hint)> Tasks { get; } = new(StringComparer.Ordinal);

    public static ChapterStrings Parse(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var s = new ChapterStrings();
        if (doc.RootElement.TryGetProperty("title", out var title)) s.Title = PerApi(title);
        if (doc.RootElement.TryGetProperty("tasks", out var tasks) && tasks.ValueKind == JsonValueKind.Object)
            foreach (var t in tasks.EnumerateObject())
                s.Tasks[t.Name] = (t.Value.TryGetProperty("text", out var text) ? PerApi(text) : null, t.Value.TryGetProperty("hint", out var hint) ? PerApi(hint) : null);
        return s;
    }

    /// <summary>"*" is the text for every API.</summary>
    private static Dictionary<string, string>? PerApi(JsonElement e) => e.ValueKind switch
    {
        JsonValueKind.String => new Dictionary<string, string> { ["*"] = e.GetString()! },
        JsonValueKind.Object => e.EnumerateObject().Where(p => p.Value.ValueKind == JsonValueKind.String).ToDictionary(p => p.Name, p => p.Value.GetString()!),
        _ => null,
    };

    public static string? For(Dictionary<string, string>? texts, string api) =>
        texts is null ? null : texts.TryGetValue(api, out var t) ? t : texts.GetValueOrDefault("*");
}
