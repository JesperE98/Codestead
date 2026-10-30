using System.Collections.Concurrent;
using System.Text.Json;

namespace Codestead.Content;

// Port of src/content/i18n.ts – looks up chapter texts, titles and task texts in the chosen language,
// with English and finally Swedish as fallback.
// The texts are embedded resources: chapters/<lang>/<id>.md and i18n/<lang>/<id>.json (TS: import.meta.glob).

public static partial class I18nLib
{
    private static readonly ConcurrentDictionary<string, string?> markdownCache = new(StringComparer.Ordinal);
    private static readonly ConcurrentDictionary<string, ChapterStrings?> stringsCache = new(StringComparer.Ordinal);

    private static string? Md(string lang, string id) =>
        markdownCache.GetOrAdd($"chapters/{lang}/{id}.md", Resources.Read);

    private static ChapterStrings? Strings(string lang, string id) =>
        stringsCache.GetOrAdd($"i18n/{lang}/{id}.json", name => Resources.Read(name) is { } json ? ParseStrings(json) : null);

    /// <summary>Parses a translation file; texts and hints may be a string or { debian, arch, redhat }.</summary>
    internal static ChapterStrings ParseStrings(string json)
    {
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;
        var result = new ChapterStrings();
        if (root.TryGetProperty("title", out var title) && title.ValueKind == JsonValueKind.String) result.Title = title.GetString();
        if (root.TryGetProperty("tasks", out var tasks) && tasks.ValueKind == JsonValueKind.Object)
        {
            result.Tasks = Js.Obj<ChapterTaskStrings>();
            foreach (var t in tasks.EnumerateObject())
            {
                if (t.Value.ValueKind != JsonValueKind.Object) continue;
                result.Tasks[t.Name] = new ChapterTaskStrings
                {
                    Text = t.Value.TryGetProperty("text", out var text) ? Text(text) : null,
                    Hint = t.Value.TryGetProperty("hint", out var hint) ? Text(hint) : null,
                };
            }
        }
        return result;
    }

    private static PerDistro<string>? Text(JsonElement e) => e.ValueKind switch
    {
        JsonValueKind.String => new PerDistro<string>(e.GetString()!),
        JsonValueKind.Object => TypesLib.FromFamilyText(new FamilyText
        {
            Debian = e.TryGetProperty("debian", out var d) ? d.GetString() : null,
            Arch = e.TryGetProperty("arch", out var a) ? a.GetString() : null,
            Redhat = e.TryGetProperty("redhat", out var r) ? r.GetString() : null,
        }),
        _ => null,
    };

    /// <summary>The chapter's markdown in the chosen language (or the closest fallback).</summary>
    public static string ChapterMarkdown(Chapter chapter, Lang lang)
    {
        foreach (var l in LanguagesLib.FallbackChain(lang))
        {
            var text = Md(l, chapter.Id);
            if (!string.IsNullOrEmpty(text)) return text;
        }
        return $"# {chapter.Title}\n";
    }

    private static readonly ConcurrentDictionary<string, List<Reference>> referencesCache = new(StringComparer.Ordinal);

    /// <summary>Official sources for a chapter (content/linux/references/&lt;id&gt;.json). Empty if there are none.</summary>
    public static List<Reference> References(Chapter chapter) =>
        referencesCache.GetOrAdd(chapter.Id, id => Resources.Read($"references/{id}.json") is { } json
            ? JsonSerializer.Deserialize<List<Reference>>(json, Js.JsonOptions) ?? new()
            : new());

    /// <summary>Is the chapter translated into the language (both text and tasks)?</summary>
    public static bool IsTranslated(Chapter chapter, Lang lang)
    {
        if (lang == "sv") return !string.IsNullOrEmpty(Md("sv", chapter.Id));
        var s = Strings(lang, chapter.Id);
        return !string.IsNullOrEmpty(Md(lang, chapter.Id)) && s is not null &&
            chapter.Tasks.All(t => s.Tasks?.Get(t.Id)?.Text?.Truthy == true);
    }

    public static string ChapterTitle(Chapter chapter, Lang lang)
    {
        foreach (var l in LanguagesLib.FallbackChain(lang))
        {
            if (l == "sv" && chapter.Title != "") return chapter.Title;
            var title = Strings(l, chapter.Id)?.Title;
            if (!string.IsNullOrEmpty(title)) return title;
        }
        return chapter.Title;
    }

    private static string? TaskString(Chapter chapter, ChapterTask task, Lang lang, bool hint, Distro distro)
    {
        foreach (var l in LanguagesLib.FallbackChain(lang))
        {
            PerDistro<string>? value;
            if (l == "sv") value = hint ? task.Hint : task.Text;
            else
            {
                var t = Strings(l, chapter.Id)?.Tasks?.Get(task.Id);
                value = hint ? t?.Hint : t?.Text;
            }
            if (value is not null) return TypesLib.Resolve(value, distro);
        }
        return null;
    }

    public static string TaskText(Chapter chapter, ChapterTask task, Lang lang, Distro distro) =>
        TaskString(chapter, task, lang, false, distro) ?? task.Id;

    public static string? TaskHint(Chapter chapter, ChapterTask task, Lang lang, Distro distro) =>
        TaskString(chapter, task, lang, true, distro);

    /// <summary>All languages that have a markdown file for the chapter.</summary>
    public static List<string> LanguagesWithMarkdown(Chapter chapter) =>
        Resources.List("chapters/")
            .Where(k => k.EndsWith($"/{chapter.Id}.md", StringComparison.Ordinal))
            .Select(k => k.Split('/')[1])
            .ToList();
}
