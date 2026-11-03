using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Documents;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Platform;
using Avalonia.Styling;
using Avalonia.Threading;
using Codestead.Content;
using Codestead.Content.Game;
using Codestead.Learning;
using Codestead.Learning.Game;
using Codestead.Shell;
using Codestead.UI;
using Codestead.UI.Controls;
using Codestead.UI.Controls.Game;
using Codestead.Terminal;
using Codestead.UI.App;
using static Codestead.UI.App.UiParts;
using ShellType = Codestead.Shell.Shell;

namespace Codestead.Linux;

/// <summary>
/// The main window: top bar, chapter list, lesson text, tasks and the terminal.
/// The layout follows the old web version: sidebar | lesson | workbench (tasks + terminal).
/// </summary>
public sealed partial class MainWindow : Window
{
    private readonly Storage storage = new(ProductInfo.ToolId);
    private readonly AppState state;
    private readonly bool smokeTest;

    private ShellType shell;
    private List<string> justCompleted = new();
    private IDisposable? freshTimer;

    private readonly OverlayHost overlay;
    private readonly StackPanel sidebarList = new() { Margin = new Thickness(10, 12, 10, 12) };
    private readonly Button sidebarSettings = new();
    private readonly ScrollViewer lessonScroll = new();
    private readonly StackPanel lessonPanel = new() { MaxWidth = 760, Margin = new Thickness(40, 28, 40, 48) };
    private readonly MarkdownView markdown = new();
    private readonly StackPanel taskPanel = new() { Margin = new Thickness(16, 14, 16, 14), Spacing = 0 };
    private readonly TerminalView terminal = new();
    private readonly TextBlock terminalTitle = new() { Foreground = new SolidColorBrush(Color.Parse("#9aa3b0")), FontSize = 12.5, VerticalAlignment = VerticalAlignment.Center };
    private readonly Button terminalReset = new();
    private readonly ProgressBar totalBar = new() { Width = 120, Height = 6, MinHeight = 6, Minimum = 0, VerticalAlignment = VerticalAlignment.Center };
    private readonly TextBlock totalText = new() { FontSize = 13, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(8, 0, 0, 0) };
    private readonly ComboBox distroPicker = new() { MinWidth = 190 };
    private readonly ComboBox langPicker = new() { MinWidth = 150 };
    private bool updatingPickers;

    private readonly Grid body = new() { ColumnDefinitions = new ColumnDefinitions("270,*,4,560") };
    private readonly GridSplitter splitter = new() { ResizeDirection = GridResizeDirection.Columns, Background = Brushes.Transparent };
    private readonly Border tasksCard = new();
    private Border terminalFrame = new();
    private readonly Border gateCard = new() { Padding = new Thickness(24), VerticalAlignment = VerticalAlignment.Top };
    private readonly StackPanel gatePanel = new() { Spacing = 12 };
    private GridLength workbenchWidth = new(560);

    /// <summary>How many own attempts a task needs before its solution can be shown (unless the hint was opened).</summary>
    public const int AttemptsBeforeSolution = 3;
    /// <summary>Percentage needed to pass an exam.</summary>
    public const int ExamPassPercent = GameRules.ExamPassPercent;

    private static readonly string[] FamilyOrder = { "debian", "arch", "redhat" };

    public MainWindow() : this(false) { }

    public MainWindow(bool smokeTest)
    {
        this.smokeTest = smokeTest;
        var saved = storage.Load<AppState>("state");
        existingUser = saved is not null;
        state = saved ?? new AppState();
        if (!LanguagesLib.IsLang(state.Lang)) state.Lang = LanguagesLib.DetectLang();
        state.Distro = DistrosLib.GetDistro(state.Distro).Id;
        if (state.Chapter is null || ChaptersLib.Chapters.All(c => c.Id != state.Chapter)) state.Chapter = ChaptersLib.Chapters[0].Id;
        shell = LoadShell(ChaptersLib.DistroFor(Chapter, state.Distro));

        Width = 1440;
        Height = 900;
        MinWidth = 900;
        MinHeight = 560;
        try
        {
            Icon = new WindowIcon(AssetLoader.Open(new Uri("avares://Codestead.Linux/Assets/icon.png")));
        }
        catch (Exception)
        {
            // The icon is cosmetic.
        }

        overlay = new OverlayHost(BuildLayout());
        overlay.Children.Add(notices);
        Content = overlay;
        InitGame();

        terminal.Shell = shell;
        terminal.CommandExecuted += OnResult;
        markdown.CommandClicked += text => terminal.Inject(text);
        markdown.LinkClicked += OpenLink;
        markdown.CustomBlockRenderer = RenderCheckpoint;

        ApplyTheme();
        ApplyLanguage();
        Opened += (_, _) =>
        {
            if (this.smokeTest) Dispatcher.UIThread.Post(RunSmokeTest, DispatcherPriority.Background);
            else
            {
                terminal.FocusInput();
                // After an update: what changed. The update offer waits until the news are closed.
                if (!ShowNewsAfterUpdate()) _ = OfferUpdate();
                GameOpened();
            }
        };
        Closing += (_, _) => SaveAll();
    }

    // ---------- Helpers ----------

    private string Lang => state.Lang ?? "en";

    private string T(string key, params (string Name, object Value)[] args) =>
        UiStrings.Translate(Lang, key, args.Length == 0 ? null : args.ToDictionary(a => a.Name, a => a.Value));

    private Distro Distro => shell.Distro;

    /// <summary>The distribution a chapter runs on: the student's choice in the distro main chapter, Ubuntu elsewhere.</summary>
    private Distro DistroOf(Chapter chapter) => DistrosLib.GetDistro(ChaptersLib.DistroFor(chapter, state.Distro));

    private string TaskKeyOf(Chapter chapter, ChapterTask task) =>
        ChaptersLib.TaskKey(chapter.Id, task.Id, task.PerFamily, DistroOf(chapter).Family);

    private static string CheckpointKey(Chapter chapter, int index) => $"{chapter.Id}#{index}";

    private readonly Dictionary<string, int> checkpointCounts = new();

    /// <summary>Number of checkpoints in a chapter text (the same in every language; the English text is the source).</summary>
    private int CheckpointCount(Chapter chapter)
    {
        if (!checkpointCounts.TryGetValue(chapter.Id, out var n))
            checkpointCounts[chapter.Id] = n = Codestead.UI.Learning.Checkpoint.ParseAll(I18nLib.ChapterMarkdown(chapter, "en")).Count;
        return n;
    }

    private int SolvedCheckpoints(Chapter chapter) =>
        Enumerable.Range(0, CheckpointCount(chapter)).Count(i => state.Checkpoints.ContainsKey(CheckpointKey(chapter, i)));

    /// <summary>
    /// Are the terminal and the tasks unlocked? Only after the student has worked through the text:
    /// all checkpoints answered, or (in a text without checkpoints) marked as read.
    /// Chapters where a task is already done stay unlocked.
    /// </summary>
    private bool IsUnlocked(Chapter chapter)
    {
        if (chapter.Tasks.Any(t => state.Progress.ContainsKey(TaskKeyOf(chapter, t)))) return true;
        int total = CheckpointCount(chapter);
        return total > 0 ? SolvedCheckpoints(chapter) == total : state.Read.Contains(chapter.Id);
    }

    /// <summary>A lesson is complete when it is unlocked and all of its tasks are done.</summary>
    private bool IsLessonComplete(Chapter chapter)
    {
        var (done, total) = ProgressLib.ChapterProgress(chapter, state.Progress, DistroOf(chapter));
        return done == total && IsUnlocked(chapter);
    }

    private CheckpointTexts CheckpointTexts() => new(
        T("checkpoint.check"), T("checkpoint.correct"), T("checkpoint.wrong"), T("checkpoint.predict"),
        T("checkpoint.try"), T("checkpoint.done"), T("checkpoint.answer"), T("checkpoint.question"),
        T("checkpoint.showAnswer"), T("checkpoint.almostPath"), T("checkpoint.tryPredict"));

    private int ChapterIndex => Math.Max(0, ChaptersLib.Chapters.FindIndex(c => c.Id == state.Chapter));
    private Chapter Chapter => ChaptersLib.Chapters[ChapterIndex];

    private static readonly List<Chapter> Lessons = ChaptersLib.Chapters.Where(c => c.Kind == ChapterKinds.Lesson).ToList();

    private ShellType LoadShell(string distroId)
    {
        var sh = ShellType.RestoreJson(storage.LoadText($"shell.{distroId}")) ?? ShellType.Create(distroId, Lang);
        sh.Lang = Lang;
        // A terminal saved in another language: its exercise files and user follow the current language.
        WorldMigration.Translate(sh, Lang);
        return sh;
    }

    private void SaveState() => storage.Save("state", state);

    private void SaveShell() => storage.SaveText($"shell.{shell.Distro.Id}", shell.SnapshotJson());

    private void SaveAll()
    {
        SaveShell();
        SaveState();
    }

    private async void OpenLink(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || (uri.Scheme != "https" && uri.Scheme != "http")) return;
        await Launcher.LaunchUriAsync(uri);
    }

    private static Border Divider() => new() { Height = 1, Margin = new Thickness(0, 10) };
}
