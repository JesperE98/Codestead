using Avalonia.Controls;
using Codestead.Common;
using Codestead.Learning.Game;
using Codestead.UI;
using Codestead.UI.Controls;

namespace Codestead.Learning.UI;

/// <summary>
/// What a tool gives the shared <see cref="LearningWindow"/>: its course, its texts, its variants (Codestead Linux:
/// the distributions) and its workbench (Codestead Linux: the terminal). Everything the window shows comes from
/// here, already in the learner's language, so the window itself knows nothing about Linux.
/// </summary>
public abstract class LearningTool
{
    /// <summary>The window, set when it is created (to show dialogs, re-render, …).</summary>
    public LearningWindow Window { get; internal set; } = null!;

    /// <summary>The learner's language (the window's).</summary>
    protected string Lang => Window.Lang;

    // ---------- The product ----------

    public abstract ProductMeta Product { get; }

    /// <summary>The window and top bar icon (an avares:// URI).</summary>
    public abstract string IconUri { get; }

    /// <summary>The tool's "What's new" (embedded changelog), newest first.</summary>
    public abstract IReadOnlyList<ChangelogEntry> Changelog { get; }

    /// <summary>A user-interface text in a language, with its {placeholders} filled in.</summary>
    public abstract string Translate(string lang, string key, IReadOnlyDictionary<string, object>? args = null);

    // ---------- The course ----------

    /// <summary>The main chapters, in order (titles are the texts "part.&lt;id&gt;").</summary>
    public abstract IReadOnlyList<string> Parts { get; }

    /// <summary>Every chapter (lessons, summaries, exams) in course order.</summary>
    public abstract IReadOnlyList<CourseChapter> Chapters { get; }

    public abstract string ChapterTitle(string chapterId, string lang);

    /// <summary>The languages the chapter's text exists in.</summary>
    public abstract IReadOnlyCollection<string> LanguagesWithText(string chapterId);

    /// <summary>The chapter's text as written, in a language (the checkpoints are counted in the English one).</summary>
    public abstract string RawText(string chapterId, string lang);

    /// <summary>The chapter's text ready to show: in the language, for the chapter's variant, placeholders filled in.</summary>
    public abstract string LessonText(string chapterId, string lang);

    public abstract IReadOnlyList<Reference> References(string chapterId);

    /// <summary>The progress keys of the chapter's tasks for its current variant (cheap: no texts).</summary>
    public abstract IReadOnlyList<string> TaskKeys(string chapterId);

    /// <summary>The chapter's tasks for its current variant.</summary>
    public abstract IReadOnlyList<TaskInfo> Tasks(string chapterId, string lang);

    /// <summary>The game rules (course outline and achievements).</summary>
    public abstract GameRules Rules { get; }

    /// <summary>The commands practised in a chapter (shown when it is done).</summary>
    public abstract IReadOnlyList<string> ChapterCommands(string chapterId);

    /// <summary>The tooltip of the total progress, e.g. "12 of 191 tasks done in the Debian family".</summary>
    public abstract string ProgressTitle(int done, int total);

    // ---------- Variants ----------

    /// <summary>The variants a chapter can run on, grouped. One option (or none) hides the picker.</summary>
    public abstract IReadOnlyList<VariantGroup> Variants(string chapterId);

    /// <summary>The variant a chapter runs on now.</summary>
    public abstract string CurrentVariant(string chapterId);

    /// <summary>The learner chose another variant (saved in <see cref="LearningState.Variant"/> by the window).</summary>
    public abstract void VariantChosen(string variantId);

    /// <summary>The variant to use for what the learner chose (null: nothing yet) – e.g. a default or a known id.</summary>
    public virtual string? NormalizeVariant(string? chosen) => chosen;

    /// <summary>Tasks that moved to another chapter: old progress key → new key (saved progress follows them).</summary>
    public virtual IReadOnlyDictionary<string, string> MovedTasks => new Dictionary<string, string>();

    /// <summary>Every variant there is, for the settings (null: no variant section).</summary>
    public virtual IReadOnlyList<VariantOption>? AllVariants => null;

    // ---------- The workbench ----------

    /// <summary>The workbench under the tasks (Codestead Linux: the terminal with its title bar).</summary>
    public abstract Control Workbench { get; }

    /// <summary>Raised after every command line run in the workbench.</summary>
    public event Action<SandboxRun>? Ran;

    protected void OnRan(SandboxRun run) => Ran?.Invoke(run);

    /// <summary>Puts a command into the workbench's input (a clicked command or solution).</summary>
    public abstract void Inject(string command);

    public abstract void FocusWorkbench();

    /// <summary>Runs a command in the workbench as if typed (the smoke test).</summary>
    public abstract void Run(string command);

    /// <summary>The tasks of the chapter that <paramref name="run"/> completed (keys).</summary>
    public abstract IReadOnlyList<string> Evaluate(string chapterId, SandboxRun run, OrderedDictionary<string, bool> completed);

    /// <summary>What the command contained, for the statistics and achievements.</summary>
    public abstract CommandFacts? Analyze(SandboxRun run);

    /// <summary>Where the chapter's "try it" questions run.</summary>
    public abstract ISandbox Sandbox(string chapterId);

    // ---------- Events from the window ----------

    /// <summary>A chapter is shown (Codestead Linux: switches the terminal to the chapter's distribution).</summary>
    public virtual void ChapterShown(string chapterId) { }

    /// <summary>The language changed (Codestead Linux: translates the learner's files and user).</summary>
    public virtual void LanguageChanged(string lang) { }

    /// <summary>The texts were (re)applied in the current language.</summary>
    public virtual void TextsApplied() { }

    /// <summary>Everything was re-rendered (e.g. update the workbench title).</summary>
    public virtual void Rendered() { }

    /// <summary>Save the workbench (the window saves its own state).</summary>
    public virtual void Save() { }

    /// <summary>Extra resets in the settings' danger zone.</summary>
    public virtual IEnumerable<ResetAction> Resets() => [];

    /// <summary>Extra checks of the smoke test, after the generic ones. Returns details for "SMOKE OK (…)".</summary>
    public virtual string SmokeTest() => "";
}
