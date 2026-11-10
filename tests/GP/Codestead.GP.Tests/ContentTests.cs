using System.Text.Json;
using System.Text.RegularExpressions;
using Codestead.Common;
using Codestead.GP.Course;
using Codestead.GP.Gpu;
using Codestead.UI.Learning;

namespace Codestead.GP.Tests;

/// <summary>The texts: every lesson in English and Swedish, the same questions for every API and language, every task with a text.</summary>
public class ContentTests
{
    /// <summary>The languages whose chapter texts are required (the others fall back to English for now).</summary>
    private static readonly string[] ChapterLanguages = ["en", "sv"];

    public static TheoryData<string> Lessons()
    {
        var d = new TheoryData<string>();
        foreach (var c in GpCourse.Chapters) d.Add(c.Id);
        return d;
    }

    [Theory(DisplayName = "kapitlet finns på engelska och svenska, med titel")]
    [MemberData(nameof(Lessons))]
    public void ChapterExists(string chapter)
    {
        foreach (var lang in ChapterLanguages)
        {
            Assert.True(File.Exists(Path.Combine(Repo.Content, "chapters", lang, chapter + ".md")), $"chapters/{lang}/{chapter}.md is missing");
            Assert.True(File.Exists(Path.Combine(Repo.Content, "i18n", lang, chapter + ".json")), $"i18n/{lang}/{chapter}.json is missing");
            foreach (var api in Apis.All)
                Assert.NotEqual(chapter, CourseText.Title(chapter, lang, api.Id));
        }
    }

    [Theory(DisplayName = "samma kontrollfrågor för alla API:er och språk")]
    [MemberData(nameof(Lessons))]
    public void SameCheckpointsEverywhere(string chapter)
    {
        // The window counts the questions in the English text for the chosen API: every API's text must have as many,
        // and every language the same kinds in the same order.
        var shape = new Dictionary<string, string>();
        foreach (var lang in Languages.Offered.Select(l => l.Code).Where(l => File.Exists(Path.Combine(Repo.Content, "chapters", l, chapter + ".md"))))
            foreach (var api in Apis.All)
            {
                var cps = Checkpoint.ParseAll(CourseText.Preprocess(File.ReadAllText(Path.Combine(Repo.Content, "chapters", lang, chapter + ".md")), api.Id));
                shape[$"{lang}/{api.Id}"] = string.Join(",", cps.Select(c => $"{c.Kind}:{c.Options.Count}:{string.Join("", c.Options.Select(o => o.Correct ? "x" : "-"))}"));
            }
        var counts = shape.Values.Select(v => v.Split(',', StringSplitOptions.RemoveEmptyEntries).Length).Distinct().ToList();
        Assert.True(counts.Count == 1, "different numbers of questions:\n" + string.Join("\n", shape.Select(kv => $"{kv.Key}: {kv.Value}")));
        foreach (var api in Apis.All)
        {
            var forApi = shape.Where(kv => kv.Key.EndsWith("/" + api.Id)).Select(kv => kv.Value).Distinct().ToList();
            Assert.True(forApi.Count == 1, $"{chapter} ({api.Id}): the questions differ between languages:\n" + string.Join("\n", shape.Where(kv => kv.Key.EndsWith("/" + api.Id)).Select(kv => $"{kv.Key}: {kv.Value}")));
        }
        if (GpCourse.Chapter(chapter).Kind == Learning.ChapterKinds.Exam) Assert.True(counts[0] >= 10, "an exam needs at least 10 questions");
    }

    [Theory(DisplayName = "rätt svar står inte nästan alltid på samma plats")]
    [MemberData(nameof(Lessons))]
    public void AnswersAreSpreadOut(string chapter)
    {
        // The app shows the options in the file's order: a quiz whose right answer is always first (or second) can
        // be answered without reading. Single-choice quizzes in English, all APIs' blocks together.
        var text = File.ReadAllText(Path.Combine(Repo.Content, "chapters", "en", chapter + ".md"));
        var positions = Checkpoint.ParseAll(text.Replace(":::", "\n"))
            .Where(c => c.Kind == Checkpoint.Quiz && !c.MultipleAnswers)
            .Select(c => c.Options.FindIndex(o => o.Correct)).ToList();
        if (positions.Count < 5) return;
        var most = positions.GroupBy(p => p).Max(g => g.Count());
        Assert.True(most <= positions.Count * 0.75, $"{chapter}: {most} of {positions.Count} right answers are in the same place – vary the order");
    }

    [Theory(DisplayName = "varje uppgift har en text på engelska och svenska")]
    [MemberData(nameof(Lessons))]
    public void TasksHaveTexts(string chapter)
    {
        foreach (var api in Apis.All)
            foreach (var task in GpCourse.Tasks(chapter, api.Id))
                foreach (var lang in ChapterLanguages)
                {
                    var file = Path.Combine(Repo.Content, "i18n", lang, chapter + ".json");
                    using var doc = JsonDocument.Parse(File.ReadAllText(file));
                    Assert.True(doc.RootElement.TryGetProperty("tasks", out var tasks) && tasks.TryGetProperty(task.Id, out var t) && t.TryGetProperty("text", out var text)
                        && (text.ValueKind == JsonValueKind.String || text.TryGetProperty(api.Id, out _)), $"{lang}/{chapter}.json: no text for task '{task.Id}' ({api.Id})");
                }
    }

    [Theory(DisplayName = "bara kända API-block och platshållare i texterna")]
    [MemberData(nameof(Lessons))]
    public void BlocksAndPlaceholders(string chapter)
    {
        foreach (var lang in ChapterLanguages)
        {
            var text = File.ReadAllText(Path.Combine(Repo.Content, "chapters", lang, chapter + ".md"));
            foreach (Match m in Regex.Matches(text, @"^:::[ \t]*(\S.*)$", RegexOptions.Multiline))
                foreach (var api in m.Groups[1].Value.Split([' ', ','], StringSplitOptions.RemoveEmptyEntries))
                    Assert.True(Apis.IsKnown(api), $"{lang}/{chapter}.md: unknown block :::{api}");
            Assert.Equal(Regex.Matches(text, @"^:::[ \t]*\S", RegexOptions.Multiline).Count, Regex.Matches(text, @"^:::[ \t]*$", RegexOptions.Multiline).Count);
            foreach (var api in Apis.All)
            {
                var shown = CourseText.Preprocess(text, api.Id);
                Assert.DoesNotMatch(@"\{\{\w+\}\}", shown);
                Assert.DoesNotMatch(@"(?m)^:::", shown);
            }
        }
    }

    [Fact(DisplayName = "källor bara från officiella webbplatser")]
    public void ReferencesAreOfficial()
    {
        var allowed = new[] { "learnopengl.com", "vulkan-tutorial.com", "docs.vulkan.org", "registry.khronos.org", "www.khronos.org", "www.glfw.org", "glad.dav1d.de", "learn.microsoft.com", "github.com/microsoft", "github.com/KhronosGroup", "github.com/JoeyDeVries", "github.com/Overv", "vulkan.lunarg.com", "www.opengl.org", "en.cppreference.com" };
        var dir = Path.Combine(Repo.Content, "references");
        if (!Directory.Exists(dir)) return;
        foreach (var file in Directory.GetFiles(dir, "*.json"))
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(file));
            foreach (var r in doc.RootElement.EnumerateArray())
            {
                var url = r.GetProperty("url").GetString()!;
                Assert.True(allowed.Any(a => url.StartsWith("https://" + a, StringComparison.Ordinal)), $"{Path.GetFileName(file)}: {url} is not an official source");
                if (r.TryGetProperty("api", out var api)) Assert.True(Apis.IsKnown(api.GetString()), $"{Path.GetFileName(file)}: unknown api");
            }
        }
    }
}
