using Codestead.Common;
using Codestead.Content;
using Codestead.Content.Game;
using Codestead.Learning;
using Codestead.Learning.Game;
using Codestead.Learning.UI;
using Codestead.Shell;
using Codestead.UI;

namespace Codestead.Linux;

/// <summary>
/// Codestead Linux in the shared learning window: the Linux course, its texts, the distributions as variants and
/// the simulated terminal as the workbench (in LinuxTool.Terminal.cs).
/// </summary>
public sealed partial class LinuxTool : LearningTool
{
    private static readonly string[] FamilyOrder = { "debian", "arch", "redhat" };

    private static readonly IReadOnlyList<CourseChapter> CourseChapters =
        ChaptersLib.Chapters.Select(c => new CourseChapter(c.Id, c.Part, c.Kind)).ToList();

    private static readonly Lazy<List<ChangelogEntry>> ChangelogEntries = new(() => Codestead.UI.Changelog.Embedded(typeof(LinuxTool).Assembly));

    public override ProductMeta Product => ProductInfo.Meta;

    public override string IconUri => "avares://Codestead.Linux/Assets/icon.png";

    public override IReadOnlyList<ChangelogEntry> Changelog => ChangelogEntries.Value;

    public override string Translate(string lang, string key, IReadOnlyDictionary<string, object>? args = null) =>
        UiStrings.Translate(lang, key, args);

    // ---------- The course ----------

    private static Chapter ChapterOf(string id) => ChaptersLib.Chapters.First(c => c.Id == id);

    /// <summary>The distribution a chapter runs on: the learner's choice in the distro main chapter, Ubuntu elsewhere.</summary>
    private Distro DistroOf(Chapter chapter) => DistrosLib.GetDistro(ChaptersLib.DistroFor(chapter, Window.ChosenVariant ?? ChaptersLib.DefaultDistro));

    public override IReadOnlyList<string> Parts { get; } = ChaptersLib.Parts.Select(p => p.Id).ToList();

    public override IReadOnlyList<CourseChapter> Chapters => CourseChapters;

    public override string ChapterTitle(string chapterId, string lang) => I18nLib.ChapterTitle(ChapterOf(chapterId), lang);

    public override IReadOnlyCollection<string> LanguagesWithText(string chapterId) => I18nLib.LanguagesWithMarkdown(ChapterOf(chapterId));

    public override string RawText(string chapterId, string lang) => I18nLib.ChapterMarkdown(ChapterOf(chapterId), lang);

    public override string LessonText(string chapterId, string lang)
    {
        var chapter = ChapterOf(chapterId);
        return RenderLib.Preprocess(I18nLib.ChapterMarkdown(chapter, lang), DistroOf(chapter), lang);
    }

    public override IReadOnlyList<Reference> References(string chapterId) => I18nLib.References(ChapterOf(chapterId));

    public override IReadOnlyList<string> TaskKeys(string chapterId)
    {
        var chapter = ChapterOf(chapterId);
        var family = DistroOf(chapter).Family;
        return chapter.Tasks.Select(t => ChaptersLib.TaskKey(chapter.Id, t.Id, t.PerFamily, family)).ToList();
    }

    public override IReadOnlyList<TaskInfo> Tasks(string chapterId, string lang)
    {
        var chapter = ChapterOf(chapterId);
        var d = DistroOf(chapter);
        var world = shell?.World ?? World.Get(lang);
        return chapter.Tasks.Select(task =>
        {
            var hint = I18nLib.TaskHint(chapter, task, lang, d);
            var chips = task.PerFamily == true
                ? FamilyOrder.Select(f => new TaskChip(FamilyShort(f), ChaptersLib.TaskKey(chapter.Id, task.Id, true, f), f == d.Family)).ToList()
                : new List<TaskChip>();
            return new TaskInfo(
                ChaptersLib.TaskKey(chapter.Id, task.Id, task.PerFamily, d.Family),
                RenderLib.Preprocess(I18nLib.TaskText(chapter, task, lang, d), d, lang),
                hint is null ? null : RenderLib.Preprocess(hint, d, lang),
                task.SolutionFor(d, world),
                chips);
        }).ToList();
    }

    private static string FamilyShort(string f) => f switch { "debian" => "Debian", "arch" => "Arch", _ => "Red Hat" };

    public override GameRules Rules => LinuxGame.Rules;

    public override IReadOnlyList<string> ChapterCommands(string chapterId)
    {
        var chapter = ChapterOf(chapterId);
        var d = DistroOf(chapter);
        return LinuxGame.ChapterCommands(chapter, d, shell?.World ?? World.Get(Lang));
    }

    public override string ProgressTitle(int done, int total) =>
        Window.T("progress.title", ("done", done), ("total", total), ("family", Window.T($"family.{(shell?.Distro ?? DistrosLib.GetDistro(ChaptersLib.DefaultDistro)).Family}")));

    // ---------- Distributions as variants ----------

    public override IReadOnlyList<VariantGroup> Variants(string chapterId)
    {
        // Only the distributions this chapter can run on (a family chapter: that family's).
        var choices = ChaptersLib.DistrosFor(ChapterOf(chapterId));
        return FamilyOrder.Where(f => choices.Any(d => d.Family == f))
            .Select(f => new VariantGroup(Window.T($"family.{f}"), choices.Where(d => d.Family == f).Select(d => new VariantOption(d.Id, d.Name)).ToList()))
            .ToList();
    }

    public override string CurrentVariant(string chapterId) => DistroOf(ChapterOf(chapterId)).Id;

    public override string? NormalizeVariant(string? chosen) => DistrosLib.GetDistro(chosen ?? ChaptersLib.DefaultDistro).Id;

    public override void VariantChosen(string variantId)
    {
        // The window saves the choice; ChapterShown then switches the terminal.
    }

    public override IReadOnlyList<VariantOption>? AllVariants => DistrosLib.Distros.Select(d => new VariantOption(d.Id, d.Name)).ToList();
}
