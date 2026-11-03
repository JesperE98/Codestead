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
using Codestead.Shell;
using Codestead.UI;
using Codestead.UI.Controls;
using Codestead.UI.Controls.Game;
using ShellType = Codestead.Shell.Shell;

namespace Codestead.Linux;

/// <summary>Settings saved between runs.</summary>
public sealed class AppState
{
    public string? Lang { get; set; }
    /// <summary>null = follow the system, "light" or "dark".</summary>
    public string? Theme { get; set; }
    public string Distro { get; set; } = "ubuntu";
    public string? Chapter { get; set; }
    public OrderedDictionary<string, bool> Progress { get; set; } = Js.Obj<bool>();
    /// <summary>Solved checkpoints in the lesson texts ("chapter#index").</summary>
    public OrderedDictionary<string, bool> Checkpoints { get; set; } = Js.Obj<bool>();
    /// <summary>Chapters without checkpoints that the student has marked as read.</summary>
    public List<string> Read { get; set; } = new();
    /// <summary>Commands run while a task was unfinished, per task key (unlocks the solution).</summary>
    public OrderedDictionary<string, int> Attempts { get; set; } = Js.Obj<int>();
    /// <summary>Task keys whose hint has been opened (also unlocks the solution).</summary>
    public List<string> HintSeen { get; set; } = new();
    /// <summary>Best exam result in percent, per main chapter.</summary>
    public OrderedDictionary<string, int> Exams { get; set; } = Js.Obj<int>();
    /// <summary>XP, achievements, streak and counters (see Codestead.Content.Game).</summary>
    public GameState Game { get; set; } = new();
}

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
    public const int ExamPassPercent = GameEngine.ExamPassPercent;

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

    private static TextBlock Text(string text, double size = 14, FontWeight? weight = null, string? cls = null)
    {
        var tb = new TextBlock { Text = text, FontSize = size, TextWrapping = TextWrapping.Wrap };
        if (weight is not null) tb.FontWeight = weight.Value;
        if (cls is not null) tb.Classes.Add(cls);
        return tb;
    }

    private static Border Divider() => new() { Height = 1, Margin = new Thickness(0, 10) };

    // ---------- Layout ----------

    private Control BuildLayout()
    {
        // Top bar
        // The Codestead Linux icon (build/icons/codestead-linux.svg): a terminal.
        var brandMark = new Image
        {
            Source = new Bitmap(AssetLoader.Open(new Uri("avares://Codestead.Linux/Assets/icon.png"))),
            Width = 30,
            Height = 30,
        };
        RenderOptions.SetBitmapInterpolationMode(brandMark, Avalonia.Media.Imaging.BitmapInterpolationMode.HighQuality);
        var brand = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 10, VerticalAlignment = VerticalAlignment.Center };
        brand.Children.Add(brandMark);
        brand.Children.Add(new TextBlock { Text = ProductInfo.Name, FontSize = 17, FontWeight = FontWeight.Bold, VerticalAlignment = VerticalAlignment.Center });

        var progress = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };
        totalBar.Bind(ProgressBar.ForegroundProperty, this.GetResourceObservable("CsSuccess"));
        progress.Children.Add(totalBar);
        progress.Children.Add(totalText);

        // Changing distribution or language rebuilds both pickers (FillPickers). That must wait until the
        // picker has finished its own selection change: clearing a ComboBox's items from inside its
        // SelectionChanged event crashes Avalonia, which closed the whole app.
        distroPicker.SelectionChanged += (_, _) =>
        {
            if (updatingPickers || distroPicker.SelectedItem is not ComboBoxItem { Tag: string id }) return;
            Dispatcher.UIThread.Post(() => ChangeDistro(id));
        };
        langPicker.SelectionChanged += (_, _) =>
        {
            if (updatingPickers || langPicker.SelectedItem is not ComboBoxItem { Tag: string code }) return;
            Dispatcher.UIThread.Post(() => ChangeLanguage(code));
        };

        var right = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12, VerticalAlignment = VerticalAlignment.Center };
        right.Children.Add(gameBar);
        right.Children.Add(progress);
        right.Children.Add(distroPicker);
        right.Children.Add(langPicker);

        var topGrid = new Grid { ColumnDefinitions = new ColumnDefinitions("Auto,*,Auto") };
        topGrid.Children.Add(brand);
        Grid.SetColumn(right, 2);
        topGrid.Children.Add(right);
        var topBar = new Border { Padding = new Thickness(18, 10), BorderThickness = new Thickness(0, 0, 0, 1), Child = topGrid };
        topBar.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsSurface"));
        topBar.Bind(Border.BorderBrushProperty, this.GetResourceObservable("CsBorder"));

        // Sidebar
        sidebarSettings.Classes.Add("nav-item");
        sidebarSettings.Click += (_, _) => OpenSettings();
        var sidebarDock = new DockPanel();
        var bottomMenu = new StackPanel { Spacing = 2 };
        bottomMenu.Children.Add(sidebarAchievements);
        bottomMenu.Children.Add(sidebarSettings);
        var settingsBox = new Border { Padding = new Thickness(10, 8), BorderThickness = new Thickness(0, 1, 0, 0), Child = bottomMenu };
        settingsBox.Bind(Border.BorderBrushProperty, this.GetResourceObservable("CsBorder"));
        DockPanel.SetDock(settingsBox, Dock.Bottom);
        sidebarDock.Children.Add(settingsBox);
        sidebarDock.Children.Add(new ScrollViewer { Content = sidebarList });
        var sidebar = new Border { BorderThickness = new Thickness(0, 0, 1, 0), Child = sidebarDock };
        sidebar.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsSurface"));
        sidebar.Bind(Border.BorderBrushProperty, this.GetResourceObservable("CsBorder"));

        // Lesson
        lessonPanel.Children.Add(markdown);
        lessonScroll.Content = lessonPanel;

        // Workbench: tasks above, terminal below
        tasksCard.Child = new ScrollViewer { Content = taskPanel };
        tasksCard.Classes.Add("card");
        gateCard.Classes.Add("card");
        gateCard.Child = gatePanel;
        terminalReset.Classes.Add("flat");
        terminalReset.Foreground = new SolidColorBrush(Color.Parse("#c9d1d9"));
        terminalReset.FontSize = 12.5;
        terminalReset.Padding = new Thickness(8, 2);
        terminalReset.Click += (_, _) => ConfirmResetTerminal();
        var dots = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 6, VerticalAlignment = VerticalAlignment.Center };
        foreach (var c in new[] { "#3d444d", "#3d444d", "#3d444d" }) dots.Children.Add(new Border { Width = 11, Height = 11, CornerRadius = new CornerRadius(6), Background = new SolidColorBrush(Color.Parse(c)) });
        var titleBar = new Grid { ColumnDefinitions = new ColumnDefinitions("Auto,*,Auto"), Height = 34 };
        titleBar.Children.Add(dots);
        Grid.SetColumn(terminalTitle, 1);
        terminalTitle.HorizontalAlignment = HorizontalAlignment.Center;
        titleBar.Children.Add(terminalTitle);
        Grid.SetColumn(terminalReset, 2);
        titleBar.Children.Add(terminalReset);
        var terminalDock = new DockPanel();
        var bar = new Border { Background = new SolidColorBrush(Color.Parse("#1b2129")), Padding = new Thickness(12, 0), Child = titleBar };
        DockPanel.SetDock(bar, Dock.Top);
        terminalDock.Children.Add(bar);
        terminalDock.Children.Add(terminal);
        terminalFrame = new Border { CornerRadius = new CornerRadius(10), ClipToBounds = true, Child = terminalDock, FlowDirection = FlowDirection.LeftToRight };
        var workbench = new Grid { RowDefinitions = new RowDefinitions("2*,12,3*"), Margin = new Thickness(0, 14, 14, 14) };
        workbench.Children.Add(tasksCard);
        Grid.SetRow(terminalFrame, 2);
        workbench.Children.Add(terminalFrame);
        Grid.SetRowSpan(gateCard, 3);
        workbench.Children.Add(gateCard);

        body.Children.Add(sidebar);
        Grid.SetColumn(lessonScroll, 1);
        body.Children.Add(lessonScroll);
        Grid.SetColumn(splitter, 2);
        body.Children.Add(splitter);
        Grid.SetColumn(workbench, 3);
        body.Children.Add(workbench);

        var root = new DockPanel();
        DockPanel.SetDock(topBar, Dock.Top);
        root.Children.Add(topBar);
        root.Children.Add(body);
        return root;
    }

    // ---------- Rendering ----------

    private void ApplyLanguage()
    {
        var info = LanguagesLib.Languages.FirstOrDefault(l => l.Code == Lang);
        FlowDirection = info?.Dir == "rtl" ? FlowDirection.RightToLeft : FlowDirection.LeftToRight;
        shell.Lang = Lang;
        markdown.CommandHint = T("lesson.cmdTitle");
        terminal.InputLabel = T("terminal.input");
        sidebarSettings.Content = Icons.Label(Icons.Gear(), T("settings.open"));
        UpdateGameViews();
        terminalReset.Content = "↺  " + T("terminal.reset");
        ToolTip.SetTip(terminalReset, T("terminal.resetTitle"));
        FillPickers();
        RenderAll();
    }

    private void FillPickers()
    {
        updatingPickers = true;
        distroPicker.Items.Clear();
        // Only the distributions this chapter can run on (a family chapter: that family's).
        var choices = ChaptersLib.DistrosFor(Chapter);
        var current = DistroOf(Chapter).Id;
        foreach (var family in FamilyOrder.Where(f => choices.Any(d => d.Family == f)))
        {
            distroPicker.Items.Add(new ComboBoxItem { Content = T($"family.{family}"), IsEnabled = false, FontWeight = FontWeight.SemiBold, FontSize = 12 });
            foreach (var d in choices.Where(d => d.Family == family))
            {
                var item = new ComboBoxItem { Content = "   " + d.Name, Tag = d.Id };
                distroPicker.Items.Add(item);
                if (d.Id == current) distroPicker.SelectedItem = item;
            }
        }
        ToolTip.SetTip(distroPicker, T("distro.label"));
        langPicker.Items.Clear();
        foreach (var l in LanguagesLib.Languages)
        {
            var item = new ComboBoxItem { Content = l.Name, Tag = l.Code };
            langPicker.Items.Add(item);
            if (l.Code == Lang) langPicker.SelectedItem = item;
        }
        ToolTip.SetTip(langPicker, T("lang.label"));
        updatingPickers = false;
    }

    private void RenderAll()
    {
        Title = $"{I18nLib.ChapterTitle(Chapter, Lang)} – {ProductInfo.Name}";
        RenderProgress();
        RenderSidebar();
        RenderLesson();
        RenderTasks();
        RenderWorkbench();
        // The distro choice only matters in the main chapter about distributions.
        distroPicker.IsVisible = ChaptersLib.DistrosFor(Chapter).Count > 1;
        terminalTitle.Text = $"{shell.CurrentUser().Name}@{Distro.Hostname} — {Distro.Name}";
    }

    /// <summary>
    /// Shows the tasks and the terminal for an unlocked lesson, a "read first" card for a locked one,
    /// and nothing for summaries and exams (they use the whole width).
    /// </summary>
    private void RenderWorkbench()
    {
        var chapter = Chapter;
        bool lesson = chapter.Kind == ChapterKinds.Lesson;
        if (body.ColumnDefinitions[3].Width.Value > 0) workbenchWidth = body.ColumnDefinitions[3].Width;
        body.ColumnDefinitions[3].Width = lesson ? workbenchWidth : new GridLength(0);
        splitter.IsVisible = lesson;
        bool unlocked = lesson && IsUnlocked(chapter);
        tasksCard.IsVisible = terminalFrame.IsVisible = unlocked;
        gateCard.IsVisible = lesson && !unlocked;
        if (!gateCard.IsVisible) return;

        gatePanel.Children.Clear();
        gatePanel.Children.Add(Text("🔒  " + T("gate.title"), 18, FontWeight.Bold));
        int total = CheckpointCount(chapter);
        if (total > 0)
        {
            int done = SolvedCheckpoints(chapter);
            gatePanel.Children.Add(Text(T("gate.checkpoints", ("done", done), ("total", total)), 14.5));
            var bar = new ProgressBar { Minimum = 0, Maximum = total, Value = done, Height = 6, MinHeight = 6 };
            bar.Bind(ProgressBar.ForegroundProperty, this.GetResourceObservable("CsAccent"));
            gatePanel.Children.Add(bar);
        }
        else
        {
            gatePanel.Children.Add(Text(T("gate.read"), 14.5));
        }
    }

    private void Unlocked()
    {
        RenderWorkbench();
        RenderSidebar();
        if (!smokeTest) terminal.FocusInput();
    }

    /// <summary>Turns ```quiz / ```predict / ```try blocks in a lesson or exam into interactive checkpoints.</summary>
    private int nextCheckpoint;
    private readonly List<CheckpointView> examViews = new();
    private bool renderingExam;

    private Control? RenderCheckpoint(Markdig.Syntax.FencedCodeBlock fenced)
    {
        var kind = (fenced.Info ?? "").Trim();
        if (!Codestead.UI.Learning.Checkpoint.Kinds.Contains(kind)) return null;
        var chapter = Chapter;
        int index = nextCheckpoint++;
        var cp = Codestead.UI.Learning.Checkpoint.Parse(kind, fenced.Lines.ToString().TrimEnd('\n', '\r'), index);
        var key = CheckpointKey(chapter, index);
        var distroId = DistroOf(chapter).Id;
        ShellType Sandbox()
        {
            var sh = ShellType.Create(distroId, Lang);
            sh.Lang = Lang;
            return sh;
        }
        var view = new CheckpointView(cp, CheckpointTexts(), state.Checkpoints.ContainsKey(key), Sandbox, renderingExam, cmd => terminal.Inject(cmd));
        if (renderingExam)
        {
            examViews.Add(view);
        }
        else
        {
            view.Solved += _ =>
            {
                bool wasUnlocked = IsUnlocked(chapter);
                state.Checkpoints[key] = true;
                SaveState();
                var ev = GameEngine.OnCheckpoint(state.Game, Snapshot(), DateTime.Now);
                if (chapter.Id == Chapter.Id && ev.Celebrate) RenderSidebar();
                Present(ev);
                if (chapter.Id != Chapter.Id) return;
                if (!wasUnlocked && IsUnlocked(chapter))
                {
                    overlay.Toast(T("gate.unlocked"));
                    Unlocked();
                }
                else
                {
                    RenderWorkbench();
                }
            };
        }
        return view;
    }

    private void RenderProgress()
    {
        int done = 0, total = 0;
        foreach (var ch in ChaptersLib.Chapters)
        {
            var p = ProgressLib.ChapterProgress(ch, state.Progress, DistroOf(ch));
            done += p.Done;
            total += p.Total;
        }
        totalBar.Maximum = Math.Max(1, total);
        totalBar.Value = done;
        totalText.Text = T("progress.short", ("done", done), ("total", total));
        ToolTip.SetTip(totalBar.Parent as Control ?? totalBar, T("progress.title", ("done", done), ("total", total), ("family", T($"family.{Distro.Family}"))));
    }

    private void RenderSidebar()
    {
        sidebarList.Children.Clear();
        int number = 0;
        foreach (var part in ChaptersLib.Parts)
        {
            var chapters = ChaptersLib.Chapters.Where(c => c.Part == part.Id).ToList();
            if (chapters.Count == 0) continue;
            var header = Text(T($"part.{part.Id}").ToUpperInvariant(), 11.5, FontWeight.Bold, "muted");
            header.Margin = new Thickness(10, sidebarList.Children.Count == 0 ? 0 : 16, 10, 6);
            header.LetterSpacing = 0.6;
            sidebarList.Children.Add(header);
            foreach (var ch in chapters)
            {
                var (done, total) = ProgressLib.ChapterProgress(ch, state.Progress, DistroOf(ch));
                var row = new Grid { ColumnDefinitions = new ColumnDefinitions("26,*,Auto") };
                var no = Text(ch.Kind switch
                {
                    ChapterKinds.Summary => "∑",
                    ChapterKinds.Exam => "★",
                    _ => (++number).ToString(),
                }, 13, null, "muted");
                var title = Text(I18nLib.ChapterTitle(ch, Lang), 14);
                Grid.SetColumn(title, 1);
                bool complete;
                string mark;
                if (ch.Kind == ChapterKinds.Exam)
                {
                    complete = state.Exams.TryGetValue(ch.Part, out var best) && best >= ExamPassPercent;
                    mark = state.Exams.TryGetValue(ch.Part, out best) ? $"{best} %" : "";
                }
                else if (ch.Kind == ChapterKinds.Summary)
                {
                    complete = false;
                    mark = "";
                }
                else
                {
                    complete = IsLessonComplete(ch);
                    mark = complete ? "✓" : $"{done}/{total}";
                }
                if (complete && ch.Kind == ChapterKinds.Lesson) mark = "✓";
                var count = Text(mark, 12.5, complete ? FontWeight.Bold : null, complete ? null : "muted");
                if (complete) count.Bind(TextBlock.ForegroundProperty, this.GetResourceObservable("CsSuccess"));
                count.Margin = new Thickness(8, 0, 0, 0);
                Grid.SetColumn(count, 2);
                row.Children.Add(no);
                row.Children.Add(title);
                row.Children.Add(count);
                var button = new Button { Content = row };
                button.Classes.Add("nav-item");
                if (ch.Id == Chapter.Id) button.Classes.Add("current");
                var id = ch.Id;
                button.Click += (_, _) => Navigate(id);
                sidebarList.Children.Add(button);
            }
        }
    }

    private void RenderLesson()
    {
        var chapter = Chapter;
        var available = I18nLib.LanguagesWithMarkdown(chapter);
        var shownLang = LanguagesLib.FallbackChain(Lang).FirstOrDefault(l => available.Contains(l)) ?? "sv";
        var shownDir = LanguagesLib.Languages.FirstOrDefault(l => l.Code == shownLang)?.Dir ?? "ltr";

        lessonPanel.Children.Clear();
        var eyebrowText = chapter.Kind switch
        {
            ChapterKinds.Summary => T($"part.{chapter.Part}") + " · " + T("summary.label"),
            ChapterKinds.Exam => T($"part.{chapter.Part}") + " · " + T("exam.label"),
            // Numbered like the sidebar: lessons only (summaries and exams are not counted).
            _ => T("lesson.chapter", ("n", Lessons.IndexOf(chapter) + 1), ("total", Lessons.Count)),
        };
        var eyebrow = Text(eyebrowText.ToUpperInvariant(), 12.5, null, "eyebrow");
        lessonPanel.Children.Add(eyebrow);
        if (!available.Contains(Lang))
        {
            var note = new Border { Padding = new Thickness(12, 8), CornerRadius = new CornerRadius(6), Margin = new Thickness(0, 10, 0, 0), Child = Text(T("lesson.fallback"), 13.5) };
            note.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsWarningSoft"));
            lessonPanel.Children.Add(note);
        }
        markdown.FlowDirection = shownDir == "rtl" ? FlowDirection.RightToLeft : FlowDirection.LeftToRight;
        var text = RenderLib.Preprocess(I18nLib.ChapterMarkdown(chapter, Lang), Distro, Lang);
        nextCheckpoint = 0;
        examViews.Clear();
        if (chapter.Kind == ChapterKinds.Exam) RenderExam(chapter, text);
        else
        {
            renderingExam = false;
            markdown.SetMarkdown(text);
            lessonPanel.Children.Add(markdown);
        }

        // A lesson without checkpoints: the student confirms having read it.
        if (chapter.Kind == ChapterKinds.Lesson && !IsUnlocked(chapter) && CheckpointCount(chapter) == 0)
        {
            var read = new Button { Content = "✓  " + T("gate.readButton"), Margin = new Thickness(0, 18, 0, 0) };
            read.Classes.Add("primary");
            read.Click += (_, _) =>
            {
                if (!state.Read.Contains(chapter.Id)) state.Read.Add(chapter.Id);
                SaveState();
                read.IsVisible = false;
                overlay.Toast(T("gate.unlocked"));
                Unlocked();
                Present(GameEngine.Sync(state.Game, Snapshot(), DateTime.Now));
            };
            lessonPanel.Children.Add(read);
        }

        // Official sources for the chapter.
        var references = I18nLib.References(chapter);
        if (references.Count > 0)
        {
            var refs = new StackPanel { Spacing = 2, Margin = new Thickness(0, 30, 0, 0) };
            refs.Children.Add(Text(T("references.title"), 17, FontWeight.Bold));
            foreach (var r in references)
            {
                var content = new StackPanel { Spacing = 0 };
                var title = Text("↗  " + r.Title, 14.5, FontWeight.SemiBold);
                title.Bind(TextBlock.ForegroundProperty, this.GetResourceObservable("CsLink"));
                content.Children.Add(title);
                content.Children.Add(Text($"{r.Publisher} · {r.Url}", 12, null, "muted"));
                var link = new Button { Content = content, HorizontalAlignment = HorizontalAlignment.Stretch, HorizontalContentAlignment = HorizontalAlignment.Left, Padding = new Thickness(8, 6) };
                link.Classes.Add("flat");
                ToolTip.SetTip(link, r.Url);
                var url = r.Url;
                link.Click += (_, _) => OpenLink(url);
                refs.Children.Add(link);
            }
            lessonPanel.Children.Add(refs);
        }

        // Previous / next
        var nav = new Grid { ColumnDefinitions = new ColumnDefinitions("*,16,*"), Margin = new Thickness(0, 36, 0, 0) };
        int i = ChapterIndex;
        if (i > 0) nav.Children.Add(NavButton(ChaptersLib.Chapters[i - 1], "← " + T("lesson.prev"), HorizontalAlignment.Left));
        if (i < ChaptersLib.Chapters.Count - 1)
        {
            var next = NavButton(ChaptersLib.Chapters[i + 1], T("lesson.next") + " →", HorizontalAlignment.Right);
            Grid.SetColumn(next, 2);
            nav.Children.Add(next);
        }
        lessonPanel.Children.Add(nav);
        lessonScroll.Offset = new Vector(0, 0);
    }

    /// <summary>
    /// The exam of a main chapter: locked until every sub-chapter is complete, then all questions at once.
    /// Answers are graded on "Submit"; 80 % passes and the exam can be retaken.
    /// </summary>
    private void RenderExam(Chapter chapter, string text)
    {
        var remaining = ChaptersLib.LessonsIn(chapter.Part).Where(l => !IsLessonComplete(l)).ToList();
        if (remaining.Count > 0)
        {
            var box = new StackPanel { Spacing = 8 };
            box.Children.Add(Text(I18nLib.ChapterTitle(chapter, Lang), 30, FontWeight.Bold));
            box.Children.Add(Text("🔒  " + T("exam.locked"), 15));
            box.Children.Add(Text(T("exam.remaining"), 14, FontWeight.SemiBold));
            foreach (var l in remaining)
            {
                var b = new Button { Content = "→  " + I18nLib.ChapterTitle(l, Lang), HorizontalAlignment = HorizontalAlignment.Left };
                b.Classes.Add("flat");
                var id = l.Id;
                b.Click += (_, _) => Navigate(id);
                box.Children.Add(b);
            }
            lessonPanel.Children.Add(new Border { Margin = new Thickness(0, 10, 0, 0), Child = box });
            return;
        }

        renderingExam = true;
        markdown.SetMarkdown(text);
        renderingExam = false;
        lessonPanel.Children.Add(markdown);
        var views = examViews.ToList();

        var result = new StackPanel { Spacing = 8, Margin = new Thickness(0, 18, 0, 0) };
        if (state.Exams.TryGetValue(chapter.Part, out var best)) result.Children.Add(Text(T("exam.best", ("percent", best)), 13.5, null, "muted"));
        var submit = new Button { Content = T("exam.submit"), Margin = new Thickness(0, 12, 0, 0) };
        submit.Classes.Add("primary");
        submit.Click += (_, _) =>
        {
            int score = views.Count(v => v.Grade());
            int percent = views.Count == 0 ? 100 : (int)Math.Floor(100.0 * score / views.Count);
            if (!state.Exams.TryGetValue(chapter.Part, out var old) || percent > old) state.Exams[chapter.Part] = percent;
            SaveState();
            submit.IsVisible = false;
            result.Children.Clear();
            bool passed = percent >= ExamPassPercent;
            var headline = Text(T("exam.result", ("score", score), ("total", views.Count), ("percent", percent)), 17, FontWeight.Bold);
            result.Children.Add(headline);
            var verdict = Text(passed ? "✓ " + T("exam.passed") : T("exam.failed", ("need", ExamPassPercent)), 15, FontWeight.SemiBold);
            verdict.Bind(TextBlock.ForegroundProperty, this.GetResourceObservable(passed ? "CsSuccess" : "CsDanger"));
            result.Children.Add(verdict);
            var retake = new Button { Content = "↺  " + T("exam.retake") };
            retake.Classes.Add("secondary");
            retake.Click += (_, _) => RenderLesson();
            result.Children.Add(retake);
            RenderSidebar();
            Present(GameEngine.OnExam(state.Game, Snapshot(), chapter.Part, percent, DateTime.Now));
        };
        lessonPanel.Children.Add(submit);
        lessonPanel.Children.Add(result);
    }

    private Button NavButton(Chapter target, string direction, HorizontalAlignment align)
    {
        var content = new StackPanel { Spacing = 2 };
        content.Children.Add(Text(direction, 12.5, null, "muted"));
        content.Children.Add(Text(I18nLib.ChapterTitle(target, Lang), 15, FontWeight.SemiBold));
        var b = new Button { Content = content, HorizontalAlignment = HorizontalAlignment.Stretch, HorizontalContentAlignment = align, Padding = new Thickness(14, 10) };
        b.Classes.Add("secondary");
        var id = target.Id;
        b.Click += (_, _) => Navigate(id);
        return b;
    }

    private void RenderTasks()
    {
        var chapter = Chapter;
        taskPanel.Children.Clear();
        int done = chapter.Tasks.Count(t => state.Progress.ContainsKey(ChaptersLib.TaskKey(chapter.Id, t.Id, t.PerFamily, Distro.Family)));
        var header = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto") };
        header.Children.Add(Text(T("tasks.title"), 16, FontWeight.Bold));
        var count = Text(T("tasks.count", ("done", done), ("total", chapter.Tasks.Count)), 13, null, "muted");
        Grid.SetColumn(count, 1);
        header.Children.Add(count);
        taskPanel.Children.Add(header);
        var bar = new ProgressBar { Minimum = 0, Maximum = Math.Max(1, chapter.Tasks.Count), Value = done, Height = 4, MinHeight = 4, Margin = new Thickness(0, 10, 0, 6) };
        bar.Bind(ProgressBar.ForegroundProperty, this.GetResourceObservable("CsSuccess"));
        taskPanel.Children.Add(bar);

        foreach (var task in chapter.Tasks) taskPanel.Children.Add(TaskItem(chapter, task));

        if (done == chapter.Tasks.Count)
        {
            var box = new StackPanel { Spacing = 10, Margin = new Thickness(0, 14, 0, 0) };
            box.Children.Add(Text(T("tasks.chapterDone"), 15, FontWeight.Bold));
            if (ChapterIndex < ChaptersLib.Chapters.Count - 1)
            {
                var next = ChaptersLib.Chapters[ChapterIndex + 1];
                var b = new Button { Content = T("tasks.next", ("title", I18nLib.ChapterTitle(next, Lang))) + " →" };
                b.Classes.Add("primary");
                b.Click += (_, _) => Navigate(next.Id);
                box.Children.Add(b);
            }
            else
            {
                box.Children.Add(Text(T("tasks.allDone")));
            }
            var card = new Border { Padding = new Thickness(14), CornerRadius = new CornerRadius(8), Child = box };
            card.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsSuccessSoft"));
            taskPanel.Children.Add(card);
        }
    }

    private Control TaskItem(Chapter chapter, ChapterTask task)
    {
        var key = ChaptersLib.TaskKey(chapter.Id, task.Id, task.PerFamily, Distro.Family);
        bool done = state.Progress.ContainsKey(key);
        bool fresh = justCompleted.Contains(key);

        var check = new Border
        {
            Width = 22,
            Height = 22,
            CornerRadius = new CornerRadius(11),
            BorderThickness = new Thickness(2),
            VerticalAlignment = VerticalAlignment.Top,
            Margin = new Thickness(0, 2, 12, 0),
            Child = done ? new TextBlock { Text = "✓", Foreground = Brushes.White, FontWeight = FontWeight.Bold, FontSize = 13, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center } : null,
        };
        check.Bind(Border.BorderBrushProperty, this.GetResourceObservable(done ? "CsSuccess" : "CsBorder"));
        if (done) check.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsSuccess"));
        if (done && fresh) Motion.Pop(check);
        AutomationPropertiesHelper.SetName(check, done ? T("tasks.done") : T("tasks.notDone"));

        var main = new StackPanel { Spacing = 6 };
        var text = new MarkdownView { BaseFontSize = 14.5 };
        text.CommandClicked += cmd => terminal.Inject(cmd);
        text.SetMarkdown(RenderLib.Preprocess(I18nLib.TaskText(chapter, task, Lang, Distro), Distro, Lang));
        main.Children.Add(text);

        if (task.PerFamily == true)
        {
            var chips = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 6 };
            foreach (var f in FamilyOrder)
            {
                bool fDone = state.Progress.ContainsKey(ChaptersLib.TaskKey(chapter.Id, task.Id, true, f));
                var chip = new Border { CornerRadius = new CornerRadius(10), Padding = new Thickness(8, 1), BorderThickness = new Thickness(1), Child = Text((fDone ? "✓ " : "") + FamilyShort(f), 11.5) };
                chip.Bind(Border.BorderBrushProperty, this.GetResourceObservable(fDone ? "CsSuccess" : "CsBorder"));
                if (fDone) chip.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsSuccessSoft"));
                if (f == Distro.Family) ((TextBlock)chip.Child!).FontWeight = FontWeight.Bold;
                chips.Children.Add(chip);
            }
            ToolTip.SetTip(chips, T("tasks.perFamily"));
            main.Children.Add(chips);
        }

        var hint = I18nLib.TaskHint(chapter, task, Lang, Distro);
        var solution = task.SolutionFor(Distro, shell.World);
        int attempts = state.Attempts.TryGetValue(key, out var a) ? a : 0;
        bool SolutionUnlocked() => done || attempts >= AttemptsBeforeSolution || state.HintSeen.Contains(key);
        var actions = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        var details = new StackPanel { Spacing = 6 };
        Button? hintButton = null;
        Button solutionButton = new();
        void Show(string? which)
        {
            details.Children.Clear();
            if (hintButton is not null)
            {
                hintButton.Content = "💡 " + (which == "hint" ? T("tasks.hideHint") : T("tasks.hint"));
                hintButton.Classes.Set("active", which == "hint");
            }
            if (which == "hint" && !state.HintSeen.Contains(key))
            {
                state.HintSeen.Add(key);
                SaveState();
            }
            if (which == "solution" && !done && !state.Game.SolutionSeen.Contains(key))
            {
                GameEngine.OnSolutionShown(state.Game, key);
                SaveState();
            }
            bool unlocked = SolutionUnlocked();
            solutionButton.IsEnabled = unlocked;
            solutionButton.Content = unlocked
                ? "👁 " + (which == "solution" ? T("tasks.hideSolution") : T("tasks.solution"))
                : "🔒 " + T("tasks.solutionLocked", ("n", AttemptsBeforeSolution - attempts));
            solutionButton.Classes.Set("active", which == "solution");
            if (which == "hint" && hint is not null)
            {
                var h = new MarkdownView { BaseFontSize = 13.5 };
                h.CommandClicked += cmd => terminal.Inject(cmd);
                h.SetMarkdown(RenderLib.Preprocess(hint, Distro, Lang));
                details.Children.Add(h);
            }
            if (which == "solution")
            {
                details.Children.Add(Text(T("tasks.solutionHelp"), 12.5, null, "muted"));
                var cmds = new WrapPanel { FlowDirection = FlowDirection.LeftToRight };
                foreach (var cmd in solution)
                {
                    var b = new Button { Content = cmd, Margin = new Thickness(0, 0, 6, 6) };
                    b.Classes.Add("solution");
                    ToolTip.SetTip(b, T("lesson.cmdTitle"));
                    var c = cmd;
                    b.Click += (_, _) => terminal.Inject(c);
                    cmds.Children.Add(b);
                }
                details.Children.Add(cmds);
            }
        }
        string? open = null;
        if (hint is not null)
        {
            hintButton = new Button();
            hintButton.Classes.Add("chip");
            hintButton.Click += (_, _) => Show(open = open == "hint" ? null : "hint");
            actions.Children.Add(hintButton);
        }
        solutionButton.Classes.Add("chip");
        solutionButton.Click += (_, _) => Show(open = open == "solution" ? null : "solution");
        actions.Children.Add(solutionButton);
        Show(null);
        main.Children.Add(actions);
        main.Children.Add(details);

        var row = new Grid { ColumnDefinitions = new ColumnDefinitions("Auto,*") };
        row.Children.Add(check);
        Grid.SetColumn(main, 1);
        row.Children.Add(main);
        var item = new Border { Padding = new Thickness(6, 12), BorderThickness = new Thickness(0, 1, 0, 0), Child = row, CornerRadius = new CornerRadius(6) };
        item.Bind(Border.BorderBrushProperty, this.GetResourceObservable("CsSurface2"));
        if (fresh) item.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsSuccessSoft"));
        return item;
    }

    private static string FamilyShort(string f) => f switch { "debian" => "Debian", "arch" => "Arch", _ => "Red Hat" };

    // ---------- Actions ----------

    private void Navigate(string id)
    {
        state.Chapter = id;
        justCompleted = new();
        SaveState();
        UseShellFor(Chapter);
        FillPickers();
        RenderAll();
    }

    /// <summary>Switches the terminal to the chapter's distribution (Ubuntu outside the distro main chapter).</summary>
    private void UseShellFor(Chapter chapter)
    {
        var id = ChaptersLib.DistroFor(chapter, state.Distro);
        if (id == shell.Distro.Id) return;
        SaveShell();
        shell = LoadShell(id);
        terminal.Shell = shell;
        FillPickers();
    }

    private void OnResult(ExecResult result)
    {
        SaveShell();
        terminalTitle.Text = $"{shell.CurrentUser().Name}@{Distro.Hostname} — {Distro.Name}";
        var newly = ProgressLib.EvaluateTasks(Chapter, shell, result, state.Progress);
        // Every finished command line counts as an attempt for the tasks that are not done yet.
        bool solutionUnlocked = false;
        if (!result.Pending && !result.Incomplete && result.Line.Trim() != "")
        {
            foreach (var task in Chapter.Tasks)
            {
                var key = TaskKeyOf(Chapter, task);
                if (state.Progress.ContainsKey(key) || newly.Contains(key)) continue;
                int n = (state.Attempts.TryGetValue(key, out var a) ? a : 0) + 1;
                if (n > AttemptsBeforeSolution) continue;
                state.Attempts[key] = n;
                if (n == AttemptsBeforeSolution) solutionUnlocked = true;
            }
        }
        foreach (var k in newly) state.Progress[k] = true;
        // The game counts every finished command line (statistics, hidden achievements) and the solved tasks.
        GameEvents? ev = null;
        if (!result.Pending && !result.Incomplete && result.Line.Trim() != "")
        {
            var solved = newly.Select(k => new SolvedTask(k, state.HintSeen.Contains(k) || state.Game.SolutionSeen.Contains(k))).ToList();
            ev = GameEngine.OnCommand(state.Game, Snapshot(), CommandInfo.Analyze(result.Line, result.Output, result.ExitCode), Chapter.Id, solved, DateTime.Now);
        }
        if (newly.Count == 0)
        {
            if (solutionUnlocked || ev?.Changed == true) SaveState();
            if (solutionUnlocked) RenderTasks();
            if (ev is not null) Present(ev);
            return;
        }
        SaveState();
        justCompleted = newly;
        RenderProgress();
        RenderSidebar();
        RenderTasks();
        freshTimer?.Dispose();
        freshTimer = DispatcherTimer.RunOnce(() =>
        {
            justCompleted = new();
            RenderTasks();
        }, TimeSpan.FromSeconds(2));
        if (ev is not null) Present(ev);
    }

    private void ChangeDistro(string id)
    {
        if (id == state.Distro) return;
        SaveShell();
        state.Distro = id;
        SaveState();
        UseShellFor(Chapter);
        FillPickers();
        RenderAll();
    }

    private void ChangeLanguage(string code)
    {
        if (code == Lang || !LanguagesLib.IsLang(code)) return;
        state.Lang = code;
        SaveState();
        // The exercise files, folders and the user get names and texts in the new language (see World.cs).
        WorldMigration.Translate(shell, code);
        SaveShell();
        ApplyLanguage();
    }

    private void ApplyTheme()
    {
        if (Application.Current is null) return;
        Application.Current.RequestedThemeVariant = state.Theme switch
        {
            "light" => ThemeVariant.Light,
            "dark" => ThemeVariant.Dark,
            _ => ThemeVariant.Default,
        };
    }

    /// <summary>
    /// Installed with Setup.exe or as an AppImage, the app updates itself (Velopack). Installed by the hub or
    /// as a native package, the hub or the package manager does it instead.
    /// </summary>
    /// <summary>True when the app had saved progress at start (so a missing "seen" version means an update, not a new installation).</summary>
    private readonly bool existingUser;

    /// <summary>The changelog embedded in the app.</summary>
    private static readonly Lazy<List<ChangelogEntry>> ChangelogEntries = new(() => Changelog.Embedded(typeof(MainWindow).Assembly));

    /// <summary>Shows "What's new" if the app was updated since it last ran. Returns false if there was nothing to show.</summary>
    private bool ShowNewsAfterUpdate()
    {
        var news = Changelog.NewsAtStart(storage, ChangelogEntries.Value, ProductInfo.Version, existingUser);
        if (news.Count == 0) return false;
        ShowNews(news, () => _ = OfferUpdate());
        return true;
    }

    /// <summary>The "What's new" dialog for some versions (newest first).</summary>
    private void ShowNews(IEnumerable<ChangelogEntry> entries, Action? afterClose = null)
    {
        void Close()
        {
            overlay.CloseDialog();
            afterClose?.Invoke();
        }
        var texts = new WhatsNewTexts(T("whatsnew.title", ("name", ProductInfo.Name)), T("whatsnew.version"), T("whatsnew.close"));
        overlay.ShowDialog(WhatsNewView.Build(texts, entries, Lang, Close), Close, 560, scroll: false);
    }

    private async Task OfferUpdate()
    {
        var updater = new SelfUpdate(ProductInfo.ReleasesRepo, ProductInfo.ToolId);
        if (!updater.CanUpdateItself) return;
        string? version;
        try
        {
            version = await updater.CheckAsync();
        }
        catch (Exception)
        {
            return; // Offline or the release server is unavailable – try again next start.
        }
        if (version is null) return;
        overlay.ShowWhenFree(() => overlay.Confirm(T("update.title"), T("update.text", ("version", version)), T("update.button"), T("update.later"), false, async () =>
        {
            overlay.Toast(T("update.downloading"), 30);
            try
            {
                SaveAll();
                await updater.DownloadAndRestartAsync(_ => { });
            }
            catch (Exception e)
            {
                overlay.Toast(e.Message);
            }
        }));
    }

    private void ConfirmResetTerminal()
    {
        overlay.Confirm(T("reset.terminal.title"), T("reset.terminal.confirm", ("distro", Distro.Name)), T("reset.terminal.button"), T("dialog.cancel"), true, () =>
        {
            storage.Remove($"shell.{Distro.Id}");
            shell = ShellType.Create(Distro.Id, Lang);
            shell.Lang = Lang;
            terminal.Shell = shell;
            RenderAll();
            overlay.Toast(T("toast.terminalReset"));
        });
    }

    private void ConfirmResetProgress()
    {
        overlay.Confirm(T("reset.progress.title"), T("reset.progress.confirm"), T("reset.progress.button"), T("dialog.cancel"), true, () =>
        {
            state.Progress = Js.Obj<bool>();
            state.Checkpoints = Js.Obj<bool>();
            state.Read = new();
            state.Attempts = Js.Obj<int>();
            state.HintSeen = new();
            state.Exams = Js.Obj<int>();
            ResetGame();
            SaveState();
            RenderAll();
            overlay.Toast(T("toast.progressReset"));
        });
    }

    private void OpenSettings()
    {
        var panel = new StackPanel { Spacing = 10 };
        panel.Children.Add(Text(T("settings.title"), 21, FontWeight.Bold));

        // Language
        panel.Children.Add(Text(T("settings.language"), 15, FontWeight.SemiBold));
        var langs = new WrapPanel();
        foreach (var l in LanguagesLib.Languages)
        {
            var b = new Button { Content = l.Name, Margin = new Thickness(0, 0, 8, 8), MinWidth = 120 };
            b.Classes.Add("chip");
            if (l.Code == Lang) b.Classes.Add("active");
            var code = l.Code;
            b.Click += (_, _) =>
            {
                ChangeLanguage(code);
                OpenSettings();
            };
            langs.Children.Add(b);
        }
        panel.Children.Add(langs);
        if (Lang != "sv" && Lang != "en") panel.Children.Add(Text(T("settings.languageNote"), 12.5, null, "muted"));

        // Theme
        panel.Children.Add(Text(T("settings.theme"), 15, FontWeight.SemiBold));
        var themes = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        foreach (var (value, label) in new (string?, string)[] { (null, T("theme.system")), ("light", T("theme.light")), ("dark", T("theme.dark")) })
        {
            var b = new Button { Content = label };
            b.Classes.Add("chip");
            if (state.Theme == value) b.Classes.Add("active");
            var v = value;
            b.Click += (_, _) =>
            {
                state.Theme = v;
                SaveState();
                ApplyTheme();
                OpenSettings();
            };
            themes.Children.Add(b);
        }
        panel.Children.Add(themes);

        // Distro
        panel.Children.Add(Text(T("settings.distro"), 15, FontWeight.SemiBold));
        var distros = new WrapPanel();
        foreach (var d in DistrosLib.Distros)
        {
            var b = new Button { Content = d.Name, Margin = new Thickness(0, 0, 8, 8) };
            b.Classes.Add("chip");
            if (d.Id == state.Distro) b.Classes.Add("active");
            var id = d.Id;
            b.Click += (_, _) =>
            {
                ChangeDistro(id);
                OpenSettings();
            };
            distros.Children.Add(b);
        }
        panel.Children.Add(distros);
        panel.Children.Add(Text(T("settings.distroNote"), 12.5, null, "muted"));

        // Danger zone
        var danger = new StackPanel { Spacing = 12 };
        danger.Children.Add(Text(T("settings.reset"), 15, FontWeight.SemiBold));
        danger.Children.Add(ResetRow(T("reset.terminal.title"), T("reset.terminal.desc", ("distro", Distro.Name)), T("reset.terminal.button"), ConfirmResetTerminal));
        danger.Children.Add(ResetRow(T("reset.progress.title"), T("reset.progress.desc"), T("reset.progress.button"), ConfirmResetProgress));
        var dangerBox = new Border { Padding = new Thickness(14), CornerRadius = new CornerRadius(8), BorderThickness = new Thickness(1), Margin = new Thickness(0, 8, 0, 0), Child = danger };
        dangerBox.Bind(Border.BorderBrushProperty, this.GetResourceObservable("CsDanger"));
        panel.Children.Add(dangerBox);

        var close = new Button { Content = T("dialog.close"), HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 8, 0, 0) };
        close.Classes.Add("primary");
        close.Click += (_, _) => overlay.CloseDialog();
        panel.Children.Add(close);
        var version = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 10 };
        version.Children.Add(Text($"{ProductInfo.Name} {ProductInfo.Version}", 11.5, null, "muted"));
        if (ChangelogEntries.Value.Count > 0)
        {
            var news = new Button { Content = T("settings.whatsNew"), Padding = new Thickness(8, 2), FontSize = 11.5 };
            news.Classes.Add("secondary");
            news.Click += (_, _) => ShowNews(ChangelogEntries.Value.Take(5));
            version.Children.Add(news);
        }
        panel.Children.Add(version);
        overlay.ShowDialog(panel, overlay.CloseDialog, 640);
    }

    private static Control ResetRow(string title, string description, string button, Action onClick)
    {
        var grid = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto") };
        var text = new StackPanel { Spacing = 2, Margin = new Thickness(0, 0, 12, 0) };
        text.Children.Add(Text(title, 14, FontWeight.SemiBold));
        text.Children.Add(Text(description, 12.5, null, "muted"));
        grid.Children.Add(text);
        var b = new Button { Content = button, VerticalAlignment = VerticalAlignment.Center };
        b.Classes.Add("danger-outline");
        b.Click += (_, _) => onClick();
        Grid.SetColumn(b, 1);
        grid.Children.Add(b);
        return grid;
    }

    // ---------- Smoke test (installation tests) ----------

    private void RunSmokeTest()
    {
        int code = 0;
        try
        {
            // Every chapter renders in every language without throwing.
            foreach (var l in LanguagesLib.Languages)
            {
                state.Lang = l.Code;
                foreach (var ch in ChaptersLib.Chapters)
                {
                    state.Chapter = ch.Id;
                    UseShellFor(ch);
                    RenderAll();
                }
            }
            // Switching language and distribution in the pickers, as a click does, must not crash
            // (it once closed the app: the pickers were rebuilt inside their own SelectionChanged).
            foreach (var lc in new[] { "sv", "ar", "en" })
            {
                langPicker.SelectedItem = langPicker.Items.OfType<ComboBoxItem>().First(i => Equals(i.Tag, lc));
                Dispatcher.UIThread.RunJobs();
                if (Lang != lc) throw new InvalidOperationException($"The language picker did not switch to {lc}.");
            }
            state.Chapter = ChaptersLib.Chapters.First(c => ChaptersLib.DistrosFor(c).Count() > 1).Id;
            UseShellFor(Chapter);
            FillPickers();
            foreach (var id in distroPicker.Items.OfType<ComboBoxItem>().Select(i => i.Tag).OfType<string>().ToList())
            {
                distroPicker.SelectedItem = distroPicker.Items.OfType<ComboBoxItem>().First(i => Equals(i.Tag, id));
                Dispatcher.UIThread.RunJobs();
                if (Distro.Id != id) throw new InvalidOperationException($"The distribution picker did not switch to {id}.");
            }
            // Solve the first task of the first chapter in the real terminal.
            state.Lang = "en";
            state.Chapter = ChaptersLib.Chapters[0].Id;
            UseShellFor(Chapter);
            ApplyLanguage();
            var task = Chapter.Tasks[0];
            var before = state.Progress.ContainsKey(ChaptersLib.TaskKey(Chapter.Id, task.Id, task.PerFamily, Distro.Family));
            foreach (var cmd in task.SolutionFor(Distro, shell.World))
            {
                terminal.Inject(cmd);
                OnResult(shell.Execute(cmd));
            }
            var after = state.Progress.ContainsKey(ChaptersLib.TaskKey(Chapter.Id, task.Id, task.PerFamily, Distro.Family));
            if (!before && !after) throw new InvalidOperationException("The first task was not completed by its solution.");
            if (state.Game.Xp <= 0 || !state.Game.Achievements.ContainsKey("first-task"))
                throw new InvalidOperationException($"The game did not count the first task (XP {state.Game.Xp}).");
            Console.WriteLine($"SMOKE OK {ProductInfo.Name} {ProductInfo.Version} ({ChaptersLib.Chapters.Count} chapters, {LanguagesLib.Languages.Count} languages)");
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("SMOKE FAILED: " + e);
            code = 1;
        }
        Environment.ExitCode = code;
        Close();
    }
}

/// <summary>Small wrapper so screen-reader names can be set without importing the automation namespace everywhere.</summary>
internal static class AutomationPropertiesHelper
{
    public static void SetName(Control c, string name) => Avalonia.Automation.AutomationProperties.SetName(c, name);
}
