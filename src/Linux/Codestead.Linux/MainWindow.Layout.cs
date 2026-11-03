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

// The layout (top bar, sidebar, lesson, workbench), the language and distribution pickers, and rendering everything.
public sealed partial class MainWindow
{
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
}
