using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.RegularExpressions;
using Codestead.Common;
using Codestead.GP.Gpu;
using Codestead.Learning;

namespace Codestead.GP.Course;

/// <summary>
/// The course's texts in the learner's language, API and IDE: chapter markdown with :::opengl / :::vulkan / :::d3d12
/// blocks (several APIs: ":::vulkan d3d12") and :::ide blocks (":::ide vs rider"), {{placeholders}}, titles and task
/// texts. English is the source; a text missing in a language falls back to English.
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

    private static readonly Regex Opener = new(@"^:::[ \t]*(\S.*?)[ \t]*$", RegexOptions.CultureInvariant);
    private static readonly Regex Closer = new(@"^:::[ \t]*$", RegexOptions.CultureInvariant);
    private static readonly Regex PlaceholderRe = new(@"\{\{([A-Za-z0-9_]+)\}\}", RegexOptions.CultureInvariant);

    /// <summary>The ids of a block's opening line (":::vulkan d3d12" → vulkan, d3d12; ":::ide vs rider" → ide, vs, rider).</summary>
    public static string[] BlockIds(string opener) => opener.Split([' ', ',', '\t'], StringSplitOptions.RemoveEmptyEntries);

    /// <summary>
    /// Keeps the blocks for <paramref name="api"/> and <paramref name="ide"/> and fills in the placeholders. API blocks
    /// (":::opengl", ":::vulkan d3d12") and IDE blocks (":::ide vs rider") end with a line ":::"; IDE blocks may sit
    /// inside API blocks. Without an IDE every IDE block is kept (the tests, counting the questions).
    /// </summary>
    public static string Preprocess(string markdown, string api, string? ide = null)
    {
        var lines = markdown.Replace("\r\n", "\n").Split('\n');
        var output = new List<string>(lines.Length);
        var open = new List<bool>();
        foreach (var line in lines)
        {
            var opener = Opener.Match(line);
            if (opener.Success && !Closer.IsMatch(line))
            {
                var ids = BlockIds(opener.Groups[1].Value);
                open.Add(ids[0] == "ide" ? ide is null || ids.Skip(1).Contains(ide) : ids.Contains(api));
                continue;
            }
            if (Closer.IsMatch(line) && open.Count > 0)
            {
                bool shown = open[^1];
                open.RemoveAt(open.Count - 1);
                // A left-out block leaves an empty line, so the paragraphs around it stay apart.
                if (!shown && open.All(v => v)) output.Add("");
                continue;
            }
            if (open.All(v => v)) output.Add(line);
        }
        return Fill(string.Join("\n", output), api);
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

    /// <summary>The chapter's text ready to show for an API (and an IDE: null keeps every IDE's steps).</summary>
    public static string Lesson(string chapterId, string lang, string api, string? ide = null) => Preprocess(Raw(chapterId, lang), api, ide);

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
