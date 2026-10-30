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
using Codestead.Shell;
using Codestead.UI;
using Codestead.UI.Controls;
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
}

/// <summary>
/// The main window: top bar, chapter list, lesson text, tasks and the terminal.
/// The layout follows the old web version: sidebar | lesson | workbench (tasks + terminal).
/// </summary>
public sealed class MainWindow : Window
{
    private readonly Storage storage = new(ProductInfo.ToolId);
    private readonly AppState state;
    private readonly bool smokeTest;

    private ShellType shell;
    private List<string> justCompleted = new();
    private DispatcherTimer? freshTimer;

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
    private readonly Button settingsButton = new() { Content = "⚙", FontSize = 17, Padding = new Thickness(10, 4) };
    private bool updatingPickers;

    private static readonly string[] FamilyOrder = { "debian", "arch", "redhat" };

    public MainWindow() : this(false) { }

    public MainWindow(bool smokeTest)
    {
        this.smokeTest = smokeTest;
        state = storage.Load<AppState>("state") ?? new AppState();
        if (!LanguagesLib.IsLang(state.Lang)) state.Lang = LanguagesLib.DetectLang();
        state.Distro = DistrosLib.GetDistro(state.Distro).Id;
        if (state.Chapter is null || ChaptersLib.Chapters.All(c => c.Id != state.Chapter)) state.Chapter = ChaptersLib.Chapters[0].Id;
        shell = LoadShell(state.Distro);

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
        Content = overlay;

        terminal.CommandExecuted += OnResult;
        markdown.CommandClicked += text => terminal.Inject(text);
        markdown.LinkClicked += OpenLink;

        ApplyTheme();
        ApplyLanguage();
        Opened += (_, _) =>
        {
            if (this.smokeTest) Dispatcher.UIThread.Post(RunSmokeTest, DispatcherPriority.Background);
            else terminal.FocusInput();
        };
        Closing += (_, _) => SaveAll();
    }

    // ---------- Helpers ----------

    private string Lang => state.Lang ?? "en";

    private string T(string key, params (string Name, object Value)[] args) =>
        UiStrings.Translate(Lang, key, args.Length == 0 ? null : args.ToDictionary(a => a.Name, a => a.Value));

    private Distro Distro => shell.Distro;

    private int ChapterIndex => Math.Max(0, ChaptersLib.Chapters.FindIndex(c => c.Id == state.Chapter));
    private Chapter Chapter => ChaptersLib.Chapters[ChapterIndex];

    private ShellType LoadShell(string distroId)
    {
        var sh = ShellType.RestoreJson(storage.LoadText($"shell.{distroId}")) ?? ShellType.Create(distroId);
        sh.Lang = Lang == "sv" ? "sv" : "en";
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
        var brandMark = new Border
        {
            Background = new SolidColorBrush(Color.Parse("#0f1318")),
            CornerRadius = new CornerRadius(7),
            Width = 30,
            Height = 30,
            Child = new TextBlock { Text = ">_", Foreground = new SolidColorBrush(Color.Parse("#7ee787")), FontWeight = FontWeight.Bold, FontFamily = new FontFamily("Cascadia Mono, DejaVu Sans Mono, monospace"), HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center },
        };
        var brand = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 10, VerticalAlignment = VerticalAlignment.Center };
        brand.Children.Add(brandMark);
        brand.Children.Add(new TextBlock { Text = ProductInfo.Name, FontSize = 17, FontWeight = FontWeight.Bold, VerticalAlignment = VerticalAlignment.Center });

        var progress = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };
        totalBar.Bind(ProgressBar.ForegroundProperty, this.GetResourceObservable("CsAccent"));
        progress.Children.Add(totalBar);
        progress.Children.Add(totalText);

        distroPicker.SelectionChanged += (_, _) =>
        {
            if (updatingPickers || distroPicker.SelectedItem is not ComboBoxItem { Tag: string id }) return;
            ChangeDistro(id);
        };
        langPicker.SelectionChanged += (_, _) =>
        {
            if (updatingPickers || langPicker.SelectedItem is not ComboBoxItem { Tag: string code }) return;
            ChangeLanguage(code);
        };
        settingsButton.Classes.Add("flat");
        settingsButton.Click += (_, _) => OpenSettings();

        var right = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12, VerticalAlignment = VerticalAlignment.Center };
        right.Children.Add(progress);
        right.Children.Add(distroPicker);
        right.Children.Add(langPicker);
        right.Children.Add(settingsButton);

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
        var settingsBox = new Border { Padding = new Thickness(10, 8), BorderThickness = new Thickness(0, 1, 0, 0), Child = sidebarSettings };
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
        var tasksCard = new Border { Child = new ScrollViewer { Content = taskPanel } };
        tasksCard.Classes.Add("card");
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
        var terminalFrame = new Border { CornerRadius = new CornerRadius(10), ClipToBounds = true, Child = terminalDock, FlowDirection = FlowDirection.LeftToRight };
        var workbench = new Grid { RowDefinitions = new RowDefinitions("2*,12,3*"), Margin = new Thickness(0, 14, 14, 14) };
        workbench.Children.Add(tasksCard);
        Grid.SetRow(terminalFrame, 2);
        workbench.Children.Add(terminalFrame);

        var body = new Grid { ColumnDefinitions = new ColumnDefinitions("270,*,4,560") };
        body.Children.Add(sidebar);
        Grid.SetColumn(lessonScroll, 1);
        body.Children.Add(lessonScroll);
        var splitter = new GridSplitter { ResizeDirection = GridResizeDirection.Columns, Background = Brushes.Transparent };
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
        shell.Lang = Lang == "sv" ? "sv" : "en";
        markdown.CommandHint = T("lesson.cmdTitle");
        terminal.InputLabel = T("terminal.input");
        sidebarSettings.Content = "⚙  " + T("settings.open");
        ToolTip.SetTip(settingsButton, T("settings.open"));
        terminalReset.Content = "↺  " + T("terminal.reset");
        ToolTip.SetTip(terminalReset, T("terminal.resetTitle"));
        FillPickers();
        RenderAll();
    }

    private void FillPickers()
    {
        updatingPickers = true;
        distroPicker.Items.Clear();
        foreach (var family in FamilyOrder)
        {
            distroPicker.Items.Add(new ComboBoxItem { Content = T($"family.{family}"), IsEnabled = false, FontWeight = FontWeight.SemiBold, FontSize = 12 });
            foreach (var d in DistrosLib.Distros.Where(d => d.Family == family))
            {
                var item = new ComboBoxItem { Content = "   " + d.Name, Tag = d.Id };
                distroPicker.Items.Add(item);
                if (d.Id == shell.Distro.Id) distroPicker.SelectedItem = item;
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
        terminalTitle.Text = $"{shell.CurrentUser().Name}@{Distro.Hostname} — {Distro.Name}";
    }

    private void RenderProgress()
    {
        var (done, total) = ProgressLib.TotalProgress(state.Progress, Distro);
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
                number++;
                var (done, total) = ProgressLib.ChapterProgress(ch, state.Progress, Distro);
                var row = new Grid { ColumnDefinitions = new ColumnDefinitions("26,*,Auto") };
                var no = Text(number.ToString(), 13, null, "muted");
                var title = Text(I18nLib.ChapterTitle(ch, Lang), 14);
                Grid.SetColumn(title, 1);
                var count = Text(done == total ? "✓" : $"{done}/{total}", 12.5, done == total ? FontWeight.Bold : null, done == total ? null : "muted");
                if (done == total) count.Bind(TextBlock.ForegroundProperty, this.GetResourceObservable("CsAccent"));
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
        var eyebrow = Text(T("lesson.chapter", ("n", ChapterIndex + 1), ("total", ChaptersLib.Chapters.Count)).ToUpperInvariant(), 12.5, null, "eyebrow");
        lessonPanel.Children.Add(eyebrow);
        if (!available.Contains(Lang))
        {
            var note = new Border { Padding = new Thickness(12, 8), CornerRadius = new CornerRadius(6), Margin = new Thickness(0, 10, 0, 0), Child = Text(T("lesson.fallback"), 13.5) };
            note.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsWarnBg"));
            lessonPanel.Children.Add(note);
        }
        markdown.FlowDirection = shownDir == "rtl" ? FlowDirection.RightToLeft : FlowDirection.LeftToRight;
        markdown.SetMarkdown(RenderLib.Preprocess(I18nLib.ChapterMarkdown(chapter, Lang), Distro, Lang));
        lessonPanel.Children.Add(markdown);

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
        bar.Bind(ProgressBar.ForegroundProperty, this.GetResourceObservable("CsAccent"));
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
            card.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsAccentSoft"));
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
        check.Bind(Border.BorderBrushProperty, this.GetResourceObservable(done ? "CsAccent" : "CsBorder"));
        if (done) check.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsAccent"));
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
                chip.Bind(Border.BorderBrushProperty, this.GetResourceObservable(fDone ? "CsAccent" : "CsBorder"));
                if (fDone) chip.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsAccentSoft"));
                if (f == Distro.Family) ((TextBlock)chip.Child!).FontWeight = FontWeight.Bold;
                chips.Children.Add(chip);
            }
            ToolTip.SetTip(chips, T("tasks.perFamily"));
            main.Children.Add(chips);
        }

        var hint = I18nLib.TaskHint(chapter, task, Lang, Distro);
        var solution = task.Solution.Resolve(Distro);
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
            solutionButton.Content = "👁 " + (which == "solution" ? T("tasks.hideSolution") : T("tasks.solution"));
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
        if (fresh) item.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsAccentSoft"));
        return item;
    }

    private static string FamilyShort(string f) => f switch { "debian" => "Debian", "arch" => "Arch", _ => "Red Hat" };

    // ---------- Actions ----------

    private void Navigate(string id)
    {
        state.Chapter = id;
        justCompleted = new();
        SaveState();
        RenderAll();
    }

    private void OnResult(ExecResult result)
    {
        SaveShell();
        terminalTitle.Text = $"{shell.CurrentUser().Name}@{Distro.Hostname} — {Distro.Name}";
        var newly = ProgressLib.EvaluateTasks(Chapter, shell, result, state.Progress);
        if (newly.Count == 0) return;
        foreach (var k in newly) state.Progress[k] = true;
        SaveState();
        justCompleted = newly;
        RenderProgress();
        RenderSidebar();
        RenderTasks();
        freshTimer?.Stop();
        freshTimer = DispatcherTimer.RunOnce(() =>
        {
            justCompleted = new();
            RenderTasks();
        }, TimeSpan.FromSeconds(2));
    }

    private void ChangeDistro(string id)
    {
        if (id == shell.Distro.Id) return;
        SaveShell();
        state.Distro = id;
        SaveState();
        shell = LoadShell(id);
        terminal.Shell = shell;
        FillPickers();
        RenderAll();
    }

    private void ChangeLanguage(string code)
    {
        if (code == Lang || !LanguagesLib.IsLang(code)) return;
        state.Lang = code;
        SaveState();
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

    private void ConfirmResetTerminal()
    {
        overlay.Confirm(T("reset.terminal.title"), T("reset.terminal.confirm", ("distro", Distro.Name)), T("reset.terminal.button"), T("dialog.cancel"), true, () =>
        {
            storage.Remove($"shell.{Distro.Id}");
            shell = ShellType.Create(Distro.Id);
            shell.Lang = Lang == "sv" ? "sv" : "en";
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
            if (d.Id == Distro.Id) b.Classes.Add("active");
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
        panel.Children.Add(Text($"{ProductInfo.Name} {ProductInfo.Version}", 11.5, null, "muted"));
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
                    RenderAll();
                }
            }
            // Solve the first task of the first chapter in the real terminal.
            state.Lang = "en";
            state.Chapter = ChaptersLib.Chapters[0].Id;
            ApplyLanguage();
            var task = Chapter.Tasks[0];
            var before = state.Progress.ContainsKey(ChaptersLib.TaskKey(Chapter.Id, task.Id, task.PerFamily, Distro.Family));
            foreach (var cmd in task.Solution.Resolve(Distro))
            {
                terminal.Inject(cmd);
                OnResult(shell.Execute(cmd));
            }
            var after = state.Progress.ContainsKey(ChaptersLib.TaskKey(Chapter.Id, task.Id, task.PerFamily, Distro.Family));
            if (!before && !after) throw new InvalidOperationException("The first task was not completed by its solution.");
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
