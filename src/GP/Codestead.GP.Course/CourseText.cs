using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.RegularExpressions;
using Codestead.Common;
using Codestead.GP.Gpu;
using Codestead.Learning;

namespace Codestead.GP.Course;

/// <summary>
/// The course's texts in the learner's language and API: chapter markdown with :::opengl / :::vulkan / :::d3d12
/// blocks (several APIs: ":::vulkan d3d12"), {{placeholders}}, titles and task texts. English is the source; a text
/// missing in a language falls back to English.
/// </summary>
public static class CourseText
{
    private static readonly ConcurrentDictionary<string, string?> Markdown = new(StringComparer.Ordinal);
    private static readonly ConcurrentDictionary<string, ChapterStrings?> Strings = new(StringComparer.Ordinal);

    private static string? Md(string lang, string id) => Markdown.GetOrAdd($"chapters/{lang}/{id}.md", Resources.Read);

    private static ChapterStrings? StringsFor(string lang, string id) =>
        Strings.GetOrAdd($"i18n/{lang}/{id}.json", name => Resources.Read(name) is { } json ? ChapterStrings.Parse(json) : null);

    /// <summary>The chapter's markdown as written (all APIs), in the language or the closest fallback.</summary>
    public static string Raw(string chapterId, string lang)
    {
        foreach (var l in Languages.FallbackChain(lang))
            if (Md(l, chapterId) is { Length: > 0 } text) return text;
        return $"# {chapterId}\n";
    }

    public static IReadOnlyCollection<string> LanguagesWithText(string chapterId) =>
        Resources.List("chapters/").Where(k => k.EndsWith($"/{chapterId}.md", StringComparison.Ordinal)).Select(k => k.Split('/')[1]).ToList();

    private static readonly Regex ApiBlock = new(@"^:::[ \t]*([a-z0-9][a-z0-9 ,]*?)[ \t]*\n([\s\S]*?)\n:::[ \t]*$", RegexOptions.Multiline | RegexOptions.CultureInvariant);
    private static readonly Regex PlaceholderRe = new(@"\{\{([A-Za-z0-9_]+)\}\}", RegexOptions.CultureInvariant);

    /// <summary>Keeps the blocks for <paramref name="api"/> and fills in the placeholders.</summary>
    public static string Preprocess(string markdown, string api)
    {
        var text = markdown.Replace("\r\n", "\n");
        text = ApiBlock.Replace(text, m =>
        {
            var apis = m.Groups[1].Value.Split([' ', ','], StringSplitOptions.RemoveEmptyEntries);
            return apis.Contains(api) ? m.Groups[2].Value : "";
        });
        return Fill(text, api);
    }

    public static string Fill(string text, string api)
    {
        var info = Apis.Get(api);
        var values = new Dictionary<string, string>
        {
            ["api"] = info.Name,
            ["apiFull"] = info.FullName,
            ["shaderLanguage"] = info.ShadingLanguage,
        };
        return PlaceholderRe.Replace(text, m => values.TryGetValue(m.Groups[1].Value, out var v) ? v : m.Value);
    }

    /// <summary>The chapter's text ready to show for an API.</summary>
    public static string Lesson(string chapterId, string lang, string api) => Preprocess(Raw(chapterId, lang), api);

    public static string Title(string chapterId, string lang, string api)
    {
        foreach (var l in Languages.FallbackChain(lang))
            if (ChapterStrings.For(StringsFor(l, chapterId)?.Title, api) is { Length: > 0 } t) return Fill(t, api);
        return chapterId;
    }

    public static string TaskText(string chapterId, string taskId, string lang, string api)
    {
        foreach (var l in Languages.FallbackChain(lang))
            if (StringsFor(l, chapterId)?.Tasks.GetValueOrDefault(taskId).Text is { } t && ChapterStrings.For(t, api) is { } s) return Fill(s, api);
        return taskId;
    }

    public static string? TaskHint(string chapterId, string taskId, string lang, string api)
    {
        foreach (var l in Languages.FallbackChain(lang))
            if (StringsFor(l, chapterId)?.Tasks.GetValueOrDefault(taskId).Hint is { } t && ChapterStrings.For(t, api) is { } s) return Fill(s, api);
        return null;
    }

    private static readonly ConcurrentDictionary<string, List<ApiReference>> ReferenceCache = new(StringComparer.Ordinal);

    /// <summary>Official sources for a chapter (references/&lt;id&gt;.json); a source may be for one API only ("api").</summary>
    public static IReadOnlyList<Reference> References(string chapterId, string api) =>
        ReferenceCache.GetOrAdd(chapterId, id => Resources.Read($"references/{id}.json") is { } json
                ? JsonSerializer.Deserialize<List<ApiReference>>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new()
                : new())
            .Where(r => r.Api is null || r.Api == api)
            .Select(r => new Reference { Title = r.Title, Url = r.Url, Publisher = r.Publisher })
            .ToList();
}
