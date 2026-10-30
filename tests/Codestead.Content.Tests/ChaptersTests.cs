using System.Collections.Concurrent;
using System.Text.RegularExpressions;
using Codestead.Shell;

namespace Codestead.Content.Tests;

// Port of src/content/chapters.test.ts.
// The HTML rendering is not ported, so the "renders" checks look at the preprocessed markdown instead:
// it must have a level-1 heading and no leftover {{placeholders}} or ::: lines.
public class ChaptersTests
{
    /// <summary>Languages that must be fully translated.</summary>
    private static readonly List<string> RequiredLangs = LanguagesLib.Languages.Select(l => l.Code).ToList();

    // ---------- alla uppgifter går att lösa i <distro> ----------

    // Runs every solution in order – exactly like a student would – and checks that each task is
    // actually ticked off in each distribution. As in the TypeScript, one shell and one set of completed
    // tasks are shared by all chapters of a distro; a failing chapter stops at its first unfinished task,
    // and the next chapter continues with the same shell. The run happens once per distro; each
    // (distro, chapter) pair is reported as its own test.
    private static readonly ConcurrentDictionary<string, Lazy<Dictionary<string, string?>>> runs = new();

    private static Dictionary<string, string?> SolveAll(string distroId) =>
        runs.GetOrAdd(distroId, id => new Lazy<Dictionary<string, string?>>(() => RunSolutions(id))).Value;

    /// <summary>Chapter id → null when every task got done, otherwise the failure message.</summary>
    private static Dictionary<string, string?> RunSolutions(string distroId)
    {
        // Like the app: one shell per distribution, and each chapter runs on ChaptersLib.DistroFor
        // (Ubuntu outside the distro main chapter, the student's choice – within the family – inside it).
        var shells = new Dictionary<string, Shell.Shell>();
        var completed = new OrderedDictionary<string, bool>(StringComparer.Ordinal);
        var results = new Dictionary<string, string?>();
        foreach (var chapter in ChaptersLib.Chapters)
        {
            var distro = DistrosLib.GetDistro(ChaptersLib.DistroFor(chapter, distroId));
            if (!shells.TryGetValue(distro.Id, out var sh)) shells[distro.Id] = sh = Shell.Shell.Create(distro.Id);
            string? failure = null;
            try
            {
                foreach (var task in chapter.Tasks)
                {
                    foreach (var line in TypesLib.Resolve(task.Solution, distro))
                    {
                        var result = sh.Execute(line);
                        foreach (var key in ProgressLib.EvaluateTasks(chapter, sh, result, completed)) completed[key] = true;
                    }
                    var k = ChaptersLib.TaskKey(chapter.Id, task.Id, task.PerFamily, distro.Family);
                    if (!(completed.TryGetValue(k, out var done) && done))
                    {
                        failure = $"{k} blev inte klar";
                        break;
                    }
                }
            }
            catch (Exception e)
            {
                failure = $"{e.GetType().Name}: {e.Message}";
            }
            results[chapter.Id] = failure;
        }
        return results;
    }

    public static TheoryData<string, string> DistroChapters()
    {
        var data = new TheoryData<string, string>();
        foreach (var d in DistrosLib.Distros)
            foreach (var c in ChaptersLib.Chapters)
                data.Add(d.Id, c.Id);
        return data;
    }

    [Theory(DisplayName = "alla uppgifter går att lösa i")]
    [MemberData(nameof(DistroChapters))]
    public void AllTasksCanBeSolved(string distroId, string chapterId)
    {
        var failure = SolveAll(distroId)[chapterId];
        Assert.True(failure is null, failure);
    }

    // ---------- kapitelinnehåll ----------

    public static TheoryData<string> ChapterIds() => new(ChaptersLib.Chapters.Select(c => c.Id));

    public static TheoryData<string> RequiredLanguages() =>
        new(LanguagesLib.Languages.Where(l => RequiredLangs.Contains(l.Code)).Select(l => l.Code));

    private static readonly Regex H1 = new(@"^#[ \t]", RegexOptions.Multiline | RegexOptions.CultureInvariant);
    private static readonly Regex LeftoverPlaceholder = new(@"\{\{[A-Za-z0-9_]+\}\}", RegexOptions.CultureInvariant);
    private static readonly Regex LeftoverBlock = new(@"^:::", RegexOptions.Multiline | RegexOptions.CultureInvariant);

    [Theory(DisplayName = "renderas på alla språk och för alla familjer")]
    [MemberData(nameof(ChapterIds))]
    public void RendersInAllLanguagesAndFamilies(string chapterId)
    {
        var chapter = ChaptersLib.Chapters.First(c => c.Id == chapterId);
        var langs = I18nLib.LanguagesWithMarkdown(chapter);
        Assert.Contains("sv", langs);
        foreach (var lang in langs)
        {
            foreach (var d in DistrosLib.Distros)
            {
                var md = RenderLib.Preprocess(I18nLib.ChapterMarkdown(chapter, lang), d);
                Assert.True(H1.IsMatch(md), $"{lang}/{chapter.Id}: no level-1 heading");
                Assert.False(LeftoverPlaceholder.IsMatch(md), $"{lang}/{chapter.Id}: leftover {{{{placeholder}}}}");
                Assert.False(LeftoverBlock.IsMatch(md), $"{lang}/{chapter.Id}: leftover :::");
            }
        }
    }

    [Theory(DisplayName = "alla kapitel och uppgifter finns på")]
    [MemberData(nameof(RequiredLanguages))]
    public void AllChaptersAndTasksTranslated(string lang)
    {
        foreach (var chapter in ChaptersLib.Chapters)
        {
            Assert.True(I18nLib.IsTranslated(chapter, lang), $"{lang}/{chapter.Id}");
        }
    }

    [Fact(DisplayName = "distro-block fungerar även med Windows-radslut")]
    public void DistroBlocksWithWindowsLineEndings()
    {
        var md = "# Titel\r\n\r\n:::arch\r\nBara Arch\r\n:::\r\n\r\n:::debian\r\nBara Debian\r\n:::\r\n";
        var html = RenderLib.Preprocess(md, DistrosLib.Distros.First(d => d.Id == "arch"));
        Assert.Contains("Bara Arch", html);
        Assert.DoesNotContain("Bara Debian", html);
        Assert.DoesNotContain(":::", html);
    }

    [Fact(DisplayName = "inga uppgifter klaras av utan att eleven gjort något")]
    public void NoTasksCompletedWithoutDoingAnything()
    {
        foreach (var d in DistrosLib.Distros)
        {
            var sh = Shell.Shell.Create(d.Id);
            var result = sh.Execute("true");
            foreach (var chapter in ChaptersLib.Chapters)
            {
                var done = ProgressLib.EvaluateTasks(chapter, sh, result, new OrderedDictionary<string, bool>());
                Assert.True(done.Count == 0, $"{d.Id}/{chapter.Id}: {string.Join(", ", done)}");
            }
        }
    }

    [Fact(DisplayName = "uppgifts-id är unika inom varje kapitel")]
    public void TaskIdsAreUnique()
    {
        foreach (var c in ChaptersLib.Chapters)
        {
            var ids = c.Tasks.Select(t => t.Id).ToList();
            Assert.Equal(ids.Count, new HashSet<string>(ids).Count);
        }
    }
}
