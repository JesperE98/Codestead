using Codestead.Shell.Commands;
using Codestead.UI.Learning;

namespace Codestead.Content.Tests;

/// <summary>
/// Rules for the interactive parts of the chapters: checkpoints in the text, summaries, exams and sources.
/// English is the source language; every translation must have the same checkpoints with the same commands
/// and answers, so a student gets the same questions in every language.
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

    private static List<Checkpoint> Parse(Chapter chapter, string lang) =>
        Checkpoint.ParseAll(I18nLib.ChapterMarkdown(chapter, lang));

    [Theory(DisplayName = "kontrollpunkterna är likadana på alla språk")]
    [MemberData(nameof(ChapterIds))]
    public void CheckpointsMatchEnglish(string chapterId)
    {
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
                Assert.True(en.Commands.SequenceEqual(tr.Commands), $"{where}: the commands differ from English");
                Assert.True(en.Expected == tr.Expected, $"{where}: the expected output differs from English");
            }
        }
    }

    private static Codestead.Shell.Shell Sandbox(Chapter chapter) =>
        Codestead.Shell.Shell.Create(ChaptersLib.DistroFor(chapter, ChaptersLib.DefaultDistro));

    [Theory(DisplayName = "predict-svaren stämmer med simulatorn")]
    [MemberData(nameof(ChapterIds))]
    public void PredictionsMatchTheSimulator(string chapterId)
    {
        var chapter = ChaptersLib.Chapters.First(c => c.Id == chapterId);
        foreach (var cp in Parse(chapter, "en").Where(c => c.Kind == Checkpoint.Predict))
        {
            var sh = Sandbox(chapter);
            var output = string.Join("\n", cp.Commands
                .Select(c => UtilCmd.StripAnsi(sh.Execute(c).Output).TrimEnd('\n'))
                .Where(o => o != ""));
            Assert.True(Checkpoint.Normalize(output) == Checkpoint.Normalize(cp.Expected),
                $"{chapterId} checkpoint {cp.Index}: the simulator prints\n{output}\nbut the answer is\n{cp.Expected}");
        }
    }

    [Theory(DisplayName = "try-kommandona fungerar i en ny sandlåda")]
    [MemberData(nameof(ChapterIds))]
    public void TryCommandsWork(string chapterId)
    {
        var chapter = ChaptersLib.Chapters.First(c => c.Id == chapterId);
        foreach (var cp in Parse(chapter, "en").Where(c => c.Kind == Checkpoint.Try))
        {
            var r = Sandbox(chapter).Execute(cp.Commands[0]);
            Assert.True(r.ExitCode == 0, $"{chapterId} checkpoint {cp.Index}: \"{cp.Commands[0]}\" exits with {r.ExitCode}: {UtilCmd.StripAnsi(r.Output)}");
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

    [Theory(DisplayName = "varje sub-kapitel har minst en källa", Skip = "Källorna läggs till när innehållet faktagranskas (fas 4).")]
    [MemberData(nameof(ChapterIds))]
    public void EveryLessonHasReferences(string chapterId)
    {
        var chapter = ChaptersLib.Chapters.First(c => c.Id == chapterId);
        if (chapter.Kind == ChapterKinds.Lesson) Assert.NotEmpty(I18nLib.References(chapter));
    }

    [Theory(DisplayName = "varje sub-kapitel har kontrollfrågor", Skip = "Kontrollfrågorna skrivs när innehållet struktureras om (fas 3).")]
    [MemberData(nameof(ChapterIds))]
    public void EveryLessonHasCheckpoints(string chapterId)
    {
        var chapter = ChaptersLib.Chapters.First(c => c.Id == chapterId);
        if (chapter.Kind == ChapterKinds.Lesson) Assert.NotEmpty(Parse(chapter, "en"));
    }
}
