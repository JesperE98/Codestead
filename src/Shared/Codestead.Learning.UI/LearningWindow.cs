using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Documents;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Platform;
using Avalonia.Styling;
using Avalonia.Threading;
using Codestead.Common;
using Codestead.Learning.Game;
using Codestead.UI;
using Codestead.UI.App;
using Codestead.UI.Controls;
using Codestead.UI.Controls.Game;
using static Codestead.UI.App.UiParts;

namespace Codestead.Learning.UI;

/// <summary>
/// The learning window every tool shares: top bar, chapter list, lesson text with checkpoints, exams, tasks and the
/// tool's workbench (Codestead Linux: the terminal) – sidebar | lesson | workbench. Everything that depends on the
/// tool comes from its <see cref="LearningTool"/>.
/// </summary>
public partial class LearningWindow : Window
{
    private readonly LearningTool tool;
    private readonly Storage storage;
    private readonly LearningState state;
    private readonly bool smokeTest;

    private List<string> justCompleted = new();
    private IDisposable? freshTimer;

    private readonly OverlayHost overlay;
    private readonly StackPanel sidebarList = new() { Margin = new Thickness(10, 12, 10, 12) };
    private readonly Button sidebarSettings = new();
    private readonly ScrollViewer lessonScroll = new();
    private readonly StackPanel lessonPanel = new() { MaxWidth = 760, Margin = new Thickness(40, 28, 40, 48) };
    private readonly MarkdownView markdown = new();
    private readonly StackPanel taskPanel = new() { Margin = new Thickness(16, 14, 16, 14), Spacing = 0 };
    private readonly ProgressBar totalBar = new() { Width = 120, Height = 6, MinHeight = 6, Minimum = 0, VerticalAlignment = VerticalAlignment.Center };
    private readonly TextBlock totalText = new() { FontSize = 13, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(8, 0, 0, 0) };
    private readonly ComboBox variantPicker = new() { MinWidth = 190 };
    private readonly ComboBox langPicker = new() { MinWidth = 150 };
    private bool updatingPickers;

    private readonly Grid body = new() { ColumnDefinitions = new ColumnDefinitions("270,*,4,560") };
    private readonly GridSplitter splitter = new() { ResizeDirection = GridResizeDirection.Columns, Background = Brushes.Transparent };
    private readonly Border tasksCard = new();
    private Control workbenchFrame = new Border();
    private readonly Border gateCard = new() { Padding = new Thickness(24), VerticalAlignment = VerticalAlignment.Top };
    private readonly StackPanel gatePanel = new() { Spacing = 12 };
    private GridLength workbenchWidth = new(560);

    /// <summary>How many own attempts a task needs before its solution can be shown (unless the hint was opened).</summary>
    public const int AttemptsBeforeSolution = 3;
    /// <summary>Percentage needed to pass an exam.</summary>
    public const int ExamPassPercent = GameRules.ExamPassPercent;

    public LearningWindow(LearningTool tool, bool smokeTest)
    {
        this.tool = tool;
        tool.Window = this;
        this.smokeTest = smokeTest;
        storage = new Storage(tool.Product.Id);
        var saved = storage.Load<LearningState>("state");
        existingUser = saved is not null;
        state = saved ?? new LearningState();
        if (!Languages.IsOffered(state.Lang)) state.Lang = Languages.Default;
        state.Variant = tool.NormalizeVariant(state.Variant);
        if (state.Chapter is null || tool.Chapters.All(c => c.Id != state.Chapter)) state.Chapter = tool.Chapters[0].Id;
        tool.ChapterShown(Chapter.Id);

        Width = 1440;
        Height = 900;
        MinWidth = 900;
        MinHeight = 560;
        try
        {
            Icon = new WindowIcon(AssetLoader.Open(new Uri(tool.IconUri)));
        }
        catch (Exception)
        {
            // The icon is cosmetic.
        }

        overlay = new OverlayHost(BuildLayout());
        overlay.Children.Add(notices);
        Content = overlay;
        InitGame();

        tool.Ran += OnResult;
        markdown.CommandClicked += text => tool.Inject(text);
        markdown.LinkClicked += OpenLink;
        markdown.CustomBlockRenderer = RenderCheckpoint;

        ApplyTheme();
        ApplyLanguage();
        Opened += (_, _) =>
        {
            if (this.smokeTest) Dispatcher.UIThread.Post(RunSmokeTest, DispatcherPriority.Background);
            else
            {
                tool.FocusWorkbench();
                // After an update: what changed. The update offer waits until the news are closed.
                if (!ShowNewsAfterUpdate()) _ = OfferUpdate();
                GameOpened();
            }
        };
        Closing += (_, _) => SaveAll();
    }

    // ---------- What the tool can use ----------

    /// <summary>The learner's language.</summary>
    public string Lang => state.Lang ?? Languages.Default;

    /// <summary>The variant the learner chose (null: the tool's default).</summary>
    public string? ChosenVariant => state.Variant;

    /// <summary>The overlay for the tool's dialogs and notices.</summary>
    public OverlayHost Overlay => overlay;

    /// <summary>The tool's data folder (the window saves state.json there).</summary>
    public Storage Storage => storage;

    /// <summary>A user-interface text in the learner's language.</summary>
    public string T(string key, params (string Name, object Value)[] args) =>
        tool.Translate(Lang, key, args.Length == 0 ? null : args.ToDictionary(a => a.Name, a => a.Value));

    /// <summary>Re-renders everything (e.g. after the workbench was reset).</summary>
    public void Refresh() => RenderAll();

    /// <summary>Shows a short notice at the bottom of the window.</summary>
    public void Toast(string text) => overlay.Toast(text);

    // ---------- Helpers ----------

    private IReadOnlyList<CourseChapter> Chapters => tool.Chapters;

    private IReadOnlyList<CourseChapter> LessonsIn(string part) => Chapters.Where(c => c.Part == part && c.IsLesson).ToList();

    private static string CheckpointKey(CourseChapter chapter, int index) => $"{chapter.Id}#{index}";

    private readonly Dictionary<string, int> checkpointCounts = new();

    /// <summary>Number of checkpoints in a chapter text (the same in every language; the English text is the source).</summary>
    private int CheckpointCount(CourseChapter chapter)
    {
        if (!checkpointCounts.TryGetValue(chapter.Id, out var n))
            checkpointCounts[chapter.Id] = n = Codestead.UI.Learning.Checkpoint.ParseAll(tool.RawText(chapter.Id, "en")).Count;
        return n;
    }

    private int SolvedCheckpoints(CourseChapter chapter) =>
        Enumerable.Range(0, CheckpointCount(chapter)).Count(i => state.Checkpoints.ContainsKey(CheckpointKey(chapter, i)));

    /// <summary>The keys of a chapter's tasks for its current variant.</summary>
    private IReadOnlyList<string> TaskKeys(CourseChapter chapter) => tool.TaskKeys(chapter.Id);

    private (int Done, int Total) ChapterProgress(CourseChapter chapter)
    {
        var keys = TaskKeys(chapter);
        return (keys.Count(k => state.Progress.TryGetValue(k, out var v) && v), keys.Count);
    }

    /// <summary>
    /// Are the tasks unlocked? Only after the learner has worked through the text:
    /// all checkpoints answered, or (in a text without checkpoints) marked as read.
    /// Chapters where a task is already done stay unlocked.
    /// </summary>
    private bool IsUnlocked(CourseChapter chapter)
    {
        if (TaskKeys(chapter).Any(state.Progress.ContainsKey)) return true;
        int total = CheckpointCount(chapter);
        return total > 0 ? SolvedCheckpoints(chapter) == total : state.Read.Contains(chapter.Id);
    }

    /// <summary>A lesson is complete when it is unlocked and all of its tasks are done.</summary>
    private bool IsLessonComplete(CourseChapter chapter)
    {
        var (done, total) = ChapterProgress(chapter);
        return done == total && IsUnlocked(chapter);
    }

    private CheckpointTexts CheckpointTexts() => new(
        T("checkpoint.check"), T("checkpoint.correct"), T("checkpoint.wrong"), T("checkpoint.predict"),
        T("checkpoint.try"), T("checkpoint.done"), T("checkpoint.answer"), T("checkpoint.question"),
        T("checkpoint.showAnswer"), T("checkpoint.almostPath"));

    private int ChapterIndex => Math.Max(0, Chapters.ToList().FindIndex(c => c.Id == state.Chapter));
    private CourseChapter Chapter => Chapters[ChapterIndex];

    private IReadOnlyList<CourseChapter> Lessons => Chapters.Where(c => c.IsLesson).ToList();

    private void SaveState() => storage.Save("state", state);

    private void SaveAll()
    {
        tool.Save();
        SaveState();
    }

    private async void OpenLink(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || (uri.Scheme != "https" && uri.Scheme != "http")) return;
        await Launcher.LaunchUriAsync(uri);
    }

    private static Border Divider() => new() { Height = 1, Margin = new Thickness(0, 10) };
}
