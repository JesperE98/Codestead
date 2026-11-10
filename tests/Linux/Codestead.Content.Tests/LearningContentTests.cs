using Codestead.Learning;
using Codestead.Shell.Commands;
using Codestead.UI.Learning;

namespace Codestead.Content.Tests;

/// <summary>
/// Rules for the interactive parts of the chapters: checkpoints in the text, summaries, exams and sources.
/// English is the source language; every translation must have the same checkpoints, so a student gets the
/// same questions in every language. Their commands and answers use the student's world (file names in the
/// student's language) and are checked in the simulator for every language.
/// </summary>
public class LearningContentTests
{
    /// <summary>
    /// The only sites a chapter may cite: the official documentation of the projects themselves.
    /// Keep this list in sync with the table in docs/verification/README.md.
    /// </summary>
    public static readonly string[] OfficialDomains =
    {
        "man7.org", "www.kernel.org", "docs.kernel.org", "www.gnu.org",
        "git-scm.com", "curl.se", "www.openssh.com", "man.openbsd.org",
        "wiki.archlinux.org", "man.archlinux.org", "archlinux.org", "aur.archlinux.org",
        "docs.fedoraproject.org", "fedoraproject.org", "docs.pagure.org",
        "help.ubuntu.com", "documentation.ubuntu.com", "ubuntu.com", "help.launchpad.net",
        "www.debian.org", "wiki.debian.org", "manpages.debian.org",
        "www.freedesktop.org", "systemd.io",
        "fishshell.com", "zsh.sourceforge.io",
        "docs.flatpak.org", "flatpak.org", "snapcraft.io", "docs.appimage.org",
    };

    public static TheoryData<string> ChapterIds() => new(ChaptersLib.Chapters.Select(c => c.Id));

    /// <summary>The checkpoints as the student sees them: placeholders filled in for the language's world.</summary>
    private static List<Checkpoint> Parse(Chapter chapter, string lang) =>
        Checkpoint.ParseAll(RenderLib.Preprocess(I18nLib.ChapterMarkdown(chapter, lang), DistroOf(chapter), lang));

    private static Codestead.Shell.Distro DistroOf(Chapter chapter) => Codestead.Shell.DistrosLib.GetDistro(ChaptersLib.DistroFor(chapter, ChaptersLib.DefaultDistro));

    /// <summary>Every language with a text for the chapter, with English first.</summary>
    private static IEnumerable<string> Langs(Chapter chapter) =>
        I18nLib.LanguagesWithMarkdown(chapter).OrderBy(l => l == "en" ? "" : l, StringComparer.Ordinal);

    [Theory(DisplayName = "kontrollpunkterna är likadana på alla språk")]
    [MemberData(nameof(ChapterIds))]
    public void CheckpointsMatchEnglish(string chapterId)
    {
        // The same questions in every language. Commands and answers may differ, because file names, the user
        // name and example words are in the student's language; each language is checked in the simulator below.
        var chapter = ChaptersLib.Chapters.First(c => c.Id == chapterId);
        var source = Parse(chapter, "en");
        foreach (var lang in I18nLib.LanguagesWithMarkdown(chapter))
        {
            var cps = Parse(chapter, lang);
            Assert.True(source.Count == cps.Count, $"{lang}/{chapterId}: {cps.Count} checkpoints, English has {source.Count}");
            for (int i = 0; i < cps.Count; i++)
            {
                var (en, tr) = (source[i], cps[i]);
                var where = $"{lang}/{chapterId} checkpoint {i}";
                Assert.True(en.Kind == tr.Kind, $"{where}: {tr.Kind}, English has {en.Kind}");
                Assert.True(en.Options.Select(o => o.Correct).SequenceEqual(tr.Options.Select(o => o.Correct)), $"{where}: the options or the right answers differ from English");
                Assert.True(en.Commands.Count == tr.Commands.Count, $"{where}: {tr.Commands.Count} commands, English has {en.Commands.Count}");
            }
        }
    }

    /// <summary>A fresh shell like the app's checkpoint sandbox, in the language's world.</summary>
    private static Codestead.Shell.Shell Sandbox(Chapter chapter, string lang)
    {
        var sh = Codestead.Shell.Shell.Create(DistroOf(chapter).Id, lang);
        sh.Lang = lang;
        return sh;
    }

    [Theory(DisplayName = "predict-svaren stämmer med simulatorn")]
    [MemberData(nameof(ChapterIds))]
    public void PredictionsMatchTheSimulator(string chapterId)
    {
        var chapter = ChaptersLib.Chapters.First(c => c.Id == chapterId);
        foreach (var lang in Langs(chapter))
            foreach (var cp in Parse(chapter, lang).Where(c => c.Kind == Checkpoint.Predict))
            {
                var sh = Sandbox(chapter, lang);
                var output = string.Join("\n", cp.Commands
                    .Select(c => UtilCmd.StripAnsi(sh.Execute(c).Output).TrimEnd('\n'))
                    .Where(o => o != ""));
                Assert.True(Checkpoint.Normalize(output) == Checkpoint.Normalize(cp.Expected),
                    $"{lang}/{chapterId} checkpoint {cp.Index}: the simulator prints\n{output}\nbut the answer is\n{cp.Expected}");
            }
    }

    [Fact(DisplayName = "Grunderna använder inte sed eller awk – de kommer i kapitlet om textbearbetning")]
    public void TheBasicsUseNoSedOrAwk()
    {
        var command = new System.Text.RegularExpressions.Regex(@"(^|[|;&]\s*|\$ )(sed|awk)\s");
        foreach (var chapter in ChaptersLib.Chapters.Where(c => c.Part is "start" or "grunder"))
            foreach (var lang in Langs(chapter))
            {
                var text = I18nLib.ChapterMarkdown(chapter, lang);
                var code = System.Text.RegularExpressions.Regex.Matches(text, @"^```(sh|text|predict|try)\n(.*?)^```", System.Text.RegularExpressions.RegexOptions.Multiline | System.Text.RegularExpressions.RegexOptions.Singleline)
                    .SelectMany(m => m.Groups[2].Value.Split('\n'));
                foreach (var line in code)
                    Assert.False(command.IsMatch(line), $"{lang}/{chapter.Id}: \"{line}\" – sed and awk are taught in \"textbearbetning\"");
            }
    }

    [Theory(DisplayName = "try-kommandona fungerar i en ny sandlåda")]
    [MemberData(nameof(ChapterIds))]
    public void TryCommandsWork(string chapterId)
    {
        var chapter = ChaptersLib.Chapters.First(c => c.Id == chapterId);
        foreach (var lang in Langs(chapter))
            foreach (var cp in Parse(chapter, lang).Where(c => c.Kind == Checkpoint.Try))
            {
                var r = Sandbox(chapter, lang).Execute(cp.Commands[0]);
                Assert.True(r.ExitCode == 0, $"{lang}/{chapterId} checkpoint {cp.Index}: \"{cp.Commands[0]}\" exits with {r.ExitCode}: {UtilCmd.StripAnsi(r.Output)}");
            }
    }

    [Fact(DisplayName = "varje prov har minst 10 frågor och föregås av en sammanfattning")]
    public void ExamsAreComplete()
    {
        foreach (var exam in ChaptersLib.Chapters.Where(c => c.Kind == ChapterKinds.Exam))
        {
            Assert.True(Parse(exam, "en").Count >= 10, $"{exam.Id}: an exam needs at least 10 questions");
            Assert.Contains(ChaptersLib.Chapters, c => c.Part == exam.Part && c.Kind == ChapterKinds.Summary);
            Assert.True(ChaptersLib.Chapters.FindIndex(c => c.Id == exam.Id) ==
                ChaptersLib.Chapters.FindLastIndex(c => c.Part == exam.Part), $"{exam.Id}: the exam must come last in its main chapter");
        }
    }

    [Theory(DisplayName = "källorna är officiella webbplatser")]
    [MemberData(nameof(ChapterIds))]
    public void ReferencesAreOfficial(string chapterId)
    {
        var chapter = ChaptersLib.Chapters.First(c => c.Id == chapterId);
        foreach (var r in I18nLib.References(chapter))
        {
            Assert.False(string.IsNullOrWhiteSpace(r.Title), $"{chapterId}: a source without a title");
            Assert.False(string.IsNullOrWhiteSpace(r.Publisher), $"{chapterId}: {r.Url} has no publisher");
            Assert.True(Uri.TryCreate(r.Url, UriKind.Absolute, out var uri) && uri.Scheme == "https", $"{chapterId}: {r.Url} is not an https address");
            Assert.True(OfficialDomains.Contains(uri!.Host), $"{chapterId}: {uri.Host} is not on the list of official sites");
        }
    }

    [Fact(DisplayName = "varje huvudkapitel utom Kom igång har sammanfattning och prov")]
    public void EveryPartHasSummaryAndExam()
    {
        foreach (var part in ChaptersLib.Parts.Where(p => p.Id != "start"))
        {
            Assert.True(ChaptersLib.Chapters.Any(c => c.Part == part.Id && c.Kind == ChapterKinds.Summary), $"{part.Id}: no summary");
            Assert.True(ChaptersLib.Chapters.Any(c => c.Part == part.Id && c.Kind == ChapterKinds.Exam), $"{part.Id}: no exam");
        }
    }

    /// <summary>The repository root (the folder with Codestead.sln), found from the test's output folder.</summary>
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Codestead.sln"))) dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("Codestead.sln not found");
    }

    [Theory(DisplayName = "varje kapitel har en granskningslogg")]
    [MemberData(nameof(ChapterIds))]
    public void EveryChapterHasVerificationLog(string chapterId)
    {
        var log = Path.Combine(RepoRoot(), "docs", "verification", chapterId + ".md");
        Assert.True(File.Exists(log), $"docs/verification/{chapterId}.md is missing (see docs/verification/README.md)");
    }

    [Theory(DisplayName = "varje sub-kapitel har minst en källa", Skip = "Källorna läggs till när innehållet faktagranskas (fas 4).")]
    [MemberData(nameof(ChapterIds))]
    public void EveryLessonHasReferences(string chapterId)
    {
        var chapter = ChaptersLib.Chapters.First(c => c.Id == chapterId);
        if (chapter.Kind == ChapterKinds.Lesson) Assert.NotEmpty(I18nLib.References(chapter));
    }

    [Theory(DisplayName = "varje sub-kapitel har kontrollfrågor")]
    [MemberData(nameof(ChapterIds))]
    public void EveryLessonHasCheckpoints(string chapterId)
    {
        var chapter = ChaptersLib.Chapters.First(c => c.Id == chapterId);
        if (chapter.Kind == ChapterKinds.Lesson) Assert.NotEmpty(Parse(chapter, "en"));
    }
}
