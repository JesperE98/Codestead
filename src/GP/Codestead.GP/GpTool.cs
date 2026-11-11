using Codestead.Common;
using Codestead.GP.Course;
using Codestead.GP.Course.Game;
using Codestead.GP.Gpu;
using Codestead.Learning;
using Codestead.Learning.Game;
using Codestead.Learning.UI;
using Codestead.UI;

namespace Codestead.GP;

/// <summary>
/// Codestead GP in the shared learning window: the course, its texts, the graphics APIs (OpenGL, Vulkan,
/// DirectX 12) as variants, and "Your project" as the workbench: the learner's own project folder, built and run in
/// their IDE and checked in the background (GpTool.Project.cs, GpTool.Folder.cs).
/// </summary>
public sealed partial class GpTool : LearningTool
{
    private static readonly Lazy<List<ChangelogEntry>> ChangelogEntries = new(() => Codestead.UI.Changelog.Embedded(typeof(GpTool).Assembly));

    public override ProductMeta Product => ProductInfo.Meta;

    public override string IconUri => "avares://Codestead.GP/Assets/icon.png";

    public override IReadOnlyList<ChangelogEntry> Changelog => ChangelogEntries.Value;

    public override string Translate(string lang, string key, IReadOnlyDictionary<string, object>? args = null) =>
        UiStrings.Translate(lang, key, args);

    /// <summary>The API the learner chose.</summary>
    private string Api => Apis.Get(Window.ChosenVariant).Id;

    // ---------- The course ----------

    public override IReadOnlyList<string> Parts => GpCourse.Parts;

    public override IReadOnlyList<CourseChapter> Chapters => GpCourse.Chapters;

    public override string ChapterTitle(string chapterId, string lang) => CourseText.Title(chapterId, lang, Api);

    public override IReadOnlyCollection<string> LanguagesWithText(string chapterId) => CourseText.LanguagesWithText(chapterId);

    /// <summary>
    /// The text for the chosen API: its checkpoints are what the window counts, so every API's version of a chapter
    /// has the same number of questions (the tests check it).
    /// </summary>
    public override string RawText(string chapterId, string lang) => CourseText.Preprocess(CourseText.Raw(chapterId, lang), Api, Ide);

    /// <summary>The text for the chosen API and IDE.</summary>
    public override string LessonText(string chapterId, string lang) => WithIdeHint(chapterId, CourseText.Lesson(chapterId, lang, Api, Ide));

    public override IReadOnlyList<Reference> References(string chapterId) => CourseText.References(chapterId, Api);

    public override IReadOnlyList<string> TaskKeys(string chapterId) =>
        GpCourse.Tasks(chapterId, Api).Select(t => GpCourse.TaskKey(chapterId, t.Id, Api)).ToList();

    public override IReadOnlyList<TaskInfo> Tasks(string chapterId, string lang)
    {
        var api = Api;
        return GpCourse.Tasks(chapterId, api).Select(task =>
        {
            // The same task in the other APIs, as chips (done in OpenGL ✓, Vulkan, DirectX 12).
            var chips = Apis.All.Where(a => GpCourse.Tasks(chapterId, a.Id).Any(t => t.Id == task.Id))
                .Select(a => new TaskChip(a.Name, GpCourse.TaskKey(chapterId, task.Id, a.Id), a.Id == api)).ToList();
            // The solution's code is copied to the clipboard when clicked; a task without code is solved in the IDE.
            var solution = task.Edits.Count > 0 ? task.Edits.Select(e => e.Replace).ToList() : new List<string> { BuildRunSolution };
            return new TaskInfo(
                GpCourse.TaskKey(chapterId, task.Id, api),
                CourseText.TaskText(chapterId, task.Id, lang, api),
                CourseText.TaskHint(chapterId, task.Id, lang, api),
                solution,
                chips.Count > 1 ? chips : []);
        }).ToList();
    }

    public override GameRules Rules => GpGame.Rules;

    public override IReadOnlyList<string> ChapterCommands(string chapterId) => GpCourse.Functions(chapterId, Api);

    public override string ProgressTitle(int done, int total) =>
        Window.T("progress.title", ("done", done), ("total", total), ("api", Apis.Get(Api).Name));

    // ---------- The APIs as variants ----------

    public override IReadOnlyList<VariantGroup> Variants(string chapterId) =>
        [new VariantGroup(Window.T("api.group"), Apis.All.Select(a => new VariantOption(a.Id, a.Name)).ToList())];

    public override string CurrentVariant(string chapterId) => Api;

    public override string? NormalizeVariant(string? chosen) => Apis.Get(chosen).Id;

    public override void VariantChosen(string variantId)
    {
        // The window saves the choice and calls ChapterShown, which watches the chapter's folder for the new API.
    }

    public override IReadOnlyList<VariantOption>? AllVariants => Apis.All.Select(a => new VariantOption(a.Id, a.Name)).ToList();
}
