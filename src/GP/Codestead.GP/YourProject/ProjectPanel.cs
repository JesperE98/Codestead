using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using static Codestead.UI.App.UiParts;

namespace Codestead.GP.YourProject;

/// <summary>
/// "Your project": the learner writes, builds and runs the chapter's code in their own IDE, organised as they like. The
/// panel ticks tasks by hand ("Mark as done" under each task), checks the code when asked ("Check my code" reads the
/// chapter's main file, which the learner picks, and the files around it), saves the start files into a folder, and
/// shows the picture of what the current task's result should look like.
/// </summary>
public sealed partial class ProjectPanel : Border
{
    private static readonly FontFamily Mono = new("Cascadia Mono, JetBrains Mono, DejaVu Sans Mono, Liberation Mono, Noto Sans Mono, Menlo, Consolas, monospace");

    private readonly StackPanel content = new() { Spacing = 10, Margin = new Thickness(16, 14, 16, 16) };
    private readonly ExpectedPicture picture = new();

    public event Action? CheckRequested;
    public event Action? ChangeFileRequested;
    public event Action? SaveRequested;
    public event Action? SaveOldRequested;
    /// <summary>The learner ticked a task by hand.</summary>
    public event Action<int>? MarkDoneRequested;
    /// <summary>The learner clicked a task in the list: show its expected result.</summary>
    public event Action<int>? TaskSelected;

    /// <summary>Styled as a Border, so the theme's "card" style applies.</summary>
    protected override Type StyleKeyOverride => typeof(Border);

    public ProjectPanel()
    {
        Classes.Add("card");
        Child = new ScrollViewer { Content = content, HorizontalScrollBarVisibility = Avalonia.Controls.Primitives.ScrollBarVisibility.Disabled };
    }

    /// <summary>The expected-result picture (the tool tells it what to draw).</summary>
    public ExpectedPicture Picture => picture;

    /// <summary>The window's task list, shown in the panel once the tasks are unlocked (else the short status list).</summary>
    public Control? HostedTasks { get; set; }

    public void Render(PanelModel m, Tr t)
    {
        content.Children.Clear();
        var header = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto") };
        header.Children.Add(Text(t("yourProject.title"), 16, FontWeight.Bold));
        var api = Text(m.ApiName, 12.5, FontWeight.SemiBold, "muted");
        api.VerticalAlignment = VerticalAlignment.Center;
        Grid.SetColumn(api, 1);
        header.Children.Add(api);
        content.Children.Add(header);
        content.Children.Add(Wrapped(t("yourProject.intro"), 13, "muted"));

        if (m.MainFile is { } file)
        {
            var path = new SelectableTextBlock { Text = file, FontFamily = Mono, FontSize = 12.5, TextWrapping = TextWrapping.Wrap };
            ToolTip.SetTip(path, t("yourProject.fileTitle"));
            content.Children.Add(path);
            if (m.FileMissing) content.Children.Add(Note(Wrapped(t("yourProject.fileMissing"), 13), "CsWarningSoft"));
        }
        content.Children.Add(Buttons(m, t));
        if (m.CheckSummary is not null || m.CheckMessages.Count > 0)
        {
            var box = new StackPanel { Spacing = 4 };
            if (m.CheckSummary is { } summary) box.Children.Add(Wrapped(summary, 13.5));
            foreach (var message in m.CheckMessages) box.Children.Add(Wrapped(message, 12.5, "muted"));
            content.Children.Add(Note(box, m.AllPassed ? "CsSuccessSoft" : "CsSurface2"));
        }
        if (m.HasOldCode)
        {
            var old = new StackPanel { Spacing = 6 };
            old.Children.Add(Wrapped(t("yourProject.oldCode"), 13));
            var b = new Button { Content = t("yourProject.copyOld") };
            b.Classes.Add("secondary");
            b.Click += (_, _) => SaveOldRequested?.Invoke();
            old.Children.Add(b);
            content.Children.Add(Note(old, "CsInfoSoft"));
        }
        if (HostedTasks is { } tasks)
        {
            if (tasks.Parent is Panel old) old.Children.Remove(tasks);
            content.Children.Add(tasks);
        }
        else
        {
            if (m.LockNote is { } note)
            {
                var box = new StackPanel { Spacing = 8 };
                box.Children.Add(Wrapped("🔒  " + note, 13.5));
                if (m.Questions.Total > 0)
                {
                    var bar = new ProgressBar { Minimum = 0, Maximum = m.Questions.Total, Value = m.Questions.Done, Height = 6, MinHeight = 6 };
                    bar.Bind(ProgressBar.ForegroundProperty, this.GetResourceObservable("CsAccent"));
                    box.Children.Add(bar);
                }
                content.Children.Add(Note(box, "CsSurface2"));
            }
            content.Children.Add(TaskList(m, t));
        }
        if (m.Tasks.Count > 0)
        {
            picture.Caption = t("expected.task", ("n", m.SelectedTask + 1));
            content.Children.Add(picture);
        }
    }

    private Control Buttons(PanelModel m, Tr t)
    {
        var row = new WrapPanel { Orientation = Orientation.Horizontal };
        bool hasTasks = m.Tasks.Count > 0;
        if (hasTasks)
        {
            var check = new Button { Content = m.Checking ? t("yourProject.checking") : t("yourProject.check"), IsEnabled = !m.Checking, Margin = new Thickness(0, 0, 8, 6) };
            check.Classes.Add("primary");
            ToolTip.SetTip(check, t("yourProject.checkTitle"));
            check.Click += (_, _) => CheckRequested?.Invoke();
            row.Children.Add(check);
            if (m.MainFile is not null)
            {
                var change = new Button { Content = t("yourProject.changeFile"), Margin = new Thickness(0, 0, 8, 6) };
                change.Classes.Add("secondary");
                change.Click += (_, _) => ChangeFileRequested?.Invoke();
                row.Children.Add(change);
            }
        }
        var save = new Button { Content = t("yourProject.save"), Margin = new Thickness(0, 0, 8, 6) };
        save.Classes.Add(hasTasks ? "secondary" : "primary");
        ToolTip.SetTip(save, t("yourProject.saveTitle"));
        save.Click += (_, _) => SaveRequested?.Invoke();
        row.Children.Add(save);
        return row;
    }

    private static TextBlock Wrapped(string text, double size, string? cls = null)
    {
        var tb = Text(text, size, null, cls);
        tb.TextWrapping = TextWrapping.Wrap;
        return tb;
    }

    private Border Note(Control child, string background)
    {
        var note = new Border { Padding = new Thickness(12, 8), CornerRadius = new CornerRadius(6), Child = child };
        note.Bind(Border.BackgroundProperty, this.GetResourceObservable(background));
        return note;
    }
}
