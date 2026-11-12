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

// The layout (top bar, sidebar, lesson, workbench), the language and distribution pickers, and rendering everything.
public partial class LearningWindow
{
    private Control BuildLayout()
    {
        // Top bar
        // The tool's icon (build/icons/<id>.svg).
        var brandMark = new Image
        {
            Source = new Bitmap(AssetLoader.Open(new Uri(tool.IconUri))),
            Width = 30,
            Height = 30,
        };
        RenderOptions.SetBitmapInterpolationMode(brandMark, Avalonia.Media.Imaging.BitmapInterpolationMode.HighQuality);
        var brand = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 10, VerticalAlignment = VerticalAlignment.Center };
        brand.Children.Add(brandMark);
        brand.Children.Add(new TextBlock { Text = tool.Product.Name, FontSize = 17, FontWeight = FontWeight.Bold, VerticalAlignment = VerticalAlignment.Center });

        var progress = new StackPanel { Orientation = Orientation.Horizontal, VerticalAlignment = VerticalAlignment.Center };
        totalBar.Bind(ProgressBar.ForegroundProperty, this.GetResourceObservable("CsSuccess"));
        progress.Children.Add(totalBar);
        progress.Children.Add(totalText);

        // Changing variant or language rebuilds both pickers (FillPickers). That must wait until the
        // picker has finished its own selection change: clearing a ComboBox's items from inside its
        // SelectionChanged event crashes Avalonia, which closed the whole app.
        variantPicker.SelectionChanged += (_, _) =>
        {
            if (updatingPickers || variantPicker.SelectedItem is not ComboBoxItem { Tag: string id }) return;
            Dispatcher.UIThread.Post(() => ChangeVariant(id));
        };
        langPicker.SelectionChanged += (_, _) =>
        {
            if (updatingPickers || langPicker.SelectedItem is not ComboBoxItem { Tag: string code }) return;
            Dispatcher.UIThread.Post(() => ChangeLanguage(code));
        };

        var right = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 12, VerticalAlignment = VerticalAlignment.Center };
        right.Children.Add(gameBar);
        right.Children.Add(progress);
        right.Children.Add(variantPicker);
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

        // Workbench: tasks (or the "read first" card) above, the tool's workbench (Codestead Linux: the terminal) below
        if (!tool.HostsTasks) tasksCard.Child = new ScrollViewer { Content = taskPanel };
        tasksCard.Classes.Add("card");
        gateCard.Classes.Add("card");
        gateCard.Child = gatePanel;
        workbenchFrame = tool.Workbench;
        var workbench = new Grid { RowDefinitions = new RowDefinitions("2*,12,3*"), Margin = new Thickness(0, 14, 14, 14) };
        workbench.Children.Add(tasksCard);
        Grid.SetRow(workbenchFrame, 2);
        workbench.Children.Add(workbenchFrame);
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
        FlowDirection = Languages.Find(Lang)?.RightToLeft == true ? FlowDirection.RightToLeft : FlowDirection.LeftToRight;
        markdown.CommandHint = T("lesson.cmdTitle");
        sidebarSettings.Content = Icons.Label(Icons.Gear(), T("settings.open"));
        UpdateGameViews();
        tool.TextsApplied();
        FillPickers();
        RenderAll();
    }

    private void FillPickers()
    {
        updatingPickers = true;
        variantPicker.Items.Clear();
        // Only the variants this chapter can run on, grouped (Codestead Linux: distributions by family).
        var current = tool.CurrentVariant(Chapter.Id);
        foreach (var group in tool.Variants(Chapter.Id))
        {
            variantPicker.Items.Add(new ComboBoxItem { Content = group.Label, IsEnabled = false, FontWeight = FontWeight.SemiBold, FontSize = 12 });
            foreach (var v in group.Options)
            {
                var item = new ComboBoxItem { Content = "   " + v.Name, Tag = v.Id };
                variantPicker.Items.Add(item);
                if (v.Id == current) variantPicker.SelectedItem = item;
            }
        }
        ToolTip.SetTip(variantPicker, T("distro.label"));
        langPicker.Items.Clear();
        foreach (var l in Languages.Offered)
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
        Title = $"{tool.ChapterTitle(Chapter.Id, Lang)} – {tool.Product.Name}";
        RenderProgress();
        RenderSidebar();
        RenderLesson();
        RenderTasks();
        RenderWorkbench();
        // The variant choice only matters where a chapter can run on more than one.
        variantPicker.IsVisible = tool.Variants(Chapter.Id).Sum(g => g.Options.Count) > 1;
        tool.Rendered();
    }

    /// <summary>
    /// A lesson always shows the workbench (Codestead Linux: the terminal), so its "try it" questions can be
    /// answered there. Above it are the tasks once the lesson is unlocked, or a "read first" card until then.
    /// An open exam shows only the workbench (it has "try it" questions too); summaries and locked exams
    /// use the whole width.
    /// </summary>
    private void RenderWorkbench()
    {
        var chapter = Chapter;
        bool lesson = chapter.Kind == ChapterKinds.Lesson;
        bool exam = chapter.Kind == ChapterKinds.Exam && IsExamOpen(chapter);
        bool shown = lesson || exam;
        if (body.ColumnDefinitions[3].Width.Value > 0) workbenchWidth = body.ColumnDefinitions[3].Width;
        body.ColumnDefinitions[3].Width = shown ? workbenchWidth : new GridLength(0);
        splitter.IsVisible = shown;
        workbenchFrame.IsVisible = shown;
        bool unlocked = lesson && IsUnlocked(chapter);
        // A tool that hosts the tasks gets the whole column: no tasks card and no "read first" card above it (it says
        // itself that the tasks are locked; Codestead Linux keeps both cards above its terminal).
        bool below = lesson && !tool.HostsTasks;
        Grid.SetRow(workbenchFrame, below ? 2 : 0);
        Grid.SetRowSpan(workbenchFrame, below ? 1 : 3);
        tasksCard.IsVisible = unlocked && !tool.HostsTasks;
        gateCard.IsVisible = lesson && !unlocked && !tool.HostsTasks;
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
        tool.TasksUnlocked(Chapter.Id);
        if (!smokeTest) tool.FocusWorkbench();
    }
}
