using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using static Codestead.UI.App.UiParts;

namespace Codestead.GP.YourProject;

/// <summary>
/// "Your project": the learner's own project folder for the chapter and API, the buttons to choose it, copy the start
/// files into it and open it, what the app has seen (built, run), every task's state, and the picture of what the
/// current task's result should look like. The learner writes, builds and runs the code in their own IDE.
/// </summary>
public sealed partial class ProjectPanel : Border
{
    private static readonly FontFamily Mono = new("Cascadia Mono, JetBrains Mono, DejaVu Sans Mono, Liberation Mono, Noto Sans Mono, Menlo, Consolas, monospace");

    private readonly StackPanel content = new() { Spacing = 10, Margin = new Thickness(16, 14, 16, 16) };
    private readonly ExpectedPicture picture = new();

    public event Action? ChooseRequested;
    public event Action? UseSuggestionRequested;
    public event Action? CopyRequested;
    public event Action? CopyOldRequested;
    public event Action? OpenRequested;
    public event Action? RanRequested;
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

        content.Children.Add(FolderBox(m, t));
        content.Children.Add(Buttons(m, t));
        if (m.HasOldCode && m.Folder is not null && !m.FolderMissing)
        {
            var old = new StackPanel { Spacing = 6 };
            old.Children.Add(Wrapped(t("yourProject.oldCode"), 13));
            var b = new Button { Content = t("yourProject.copyOld") };
            b.Classes.Add("secondary");
            b.Click += (_, _) => CopyOldRequested?.Invoke();
            old.Children.Add(b);
            content.Children.Add(Note(old, "CsInfoSoft"));
        }
        if (m.Folder is not null && !m.FolderMissing) content.Children.Add(StatusBox(m, t));
        content.Children.Add(TaskList(m, t));
        if (m.Tasks.Count > 0)
        {
            picture.Caption = t("expected.task", ("n", m.SelectedTask + 1));
            content.Children.Add(picture);
        }
    }

    private Control FolderBox(PanelModel m, Tr t)
    {
        var box = new StackPanel { Spacing = 6 };
        if (m.Folder is null)
        {
            box.Children.Add(Wrapped(t("yourProject.noFolder"), 13.5));
            if (m.Suggestion is { } s)
            {
                var row = new StackPanel { Spacing = 6 };
                row.Children.Add(Wrapped(t("yourProject.suggestion", ("folder", s)), 12.5, "muted"));
                var use = new Button { Content = t("yourProject.useSuggestion") };
                use.Classes.Add("secondary");
                use.Click += (_, _) => UseSuggestionRequested?.Invoke();
                row.Children.Add(use);
                box.Children.Add(row);
            }
            return box;
        }
        var path = new SelectableTextBlock { Text = m.Folder, FontFamily = Mono, FontSize = 12.5, TextWrapping = TextWrapping.Wrap };
        box.Children.Add(path);
        if (m.FolderMissing) box.Children.Add(Note(Wrapped(t("yourProject.missingFolder"), 13), "CsWarningSoft"));
        return box;
    }

    private Control Buttons(PanelModel m, Tr t)
    {
        var row = new WrapPanel { Orientation = Orientation.Horizontal };
        var choose = new Button { Content = t("yourProject.choose"), Margin = new Thickness(0, 0, 8, 6) };
        choose.Classes.Add(m.Folder is null ? "primary" : "secondary");
        choose.Click += (_, _) => ChooseRequested?.Invoke();
        row.Children.Add(choose);
        bool usable = m.Folder is not null && !m.FolderMissing;
        var copy = new Button { Content = t("yourProject.copy"), IsEnabled = usable, Margin = new Thickness(0, 0, 8, 6) };
        copy.Classes.Add("secondary");
        ToolTip.SetTip(copy, t("yourProject.copyTitle"));
        copy.Click += (_, _) => CopyRequested?.Invoke();
        row.Children.Add(copy);
        var open = new Button { Content = t("yourProject.open"), IsEnabled = usable, Margin = new Thickness(0, 0, 8, 6) };
        open.Classes.Add("secondary");
        open.Click += (_, _) => OpenRequested?.Invoke();
        row.Children.Add(open);
        return row;
    }

    private Control StatusBox(PanelModel m, Tr t)
    {
        var box = new StackPanel { Spacing = 4 };
        var line = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto") };
        line.Children.Add(Wrapped(m.StatusLine, 13.5));
        // "I ran it": a small link for setups the app cannot see.
        var ran = new Button { Content = t("yourProject.ranIt"), Padding = new Thickness(6, 2), FontSize = 12.5, VerticalAlignment = VerticalAlignment.Top };
        ran.Classes.Add("flat");
        ran.Bind(Button.ForegroundProperty, this.GetResourceObservable("CsLink"));
        ToolTip.SetTip(ran, t("yourProject.ranItTitle"));
        ran.Click += (_, _) => RanRequested?.Invoke();
        Grid.SetColumn(ran, 1);
        line.Children.Add(ran);
        box.Children.Add(line);
        if (m.WhereProgram is { } where) box.Children.Add(Wrapped(where, 12.5, "muted"));
        string Time(DateTime? utc) => utc is { } u ? u.ToLocalTime().ToString("HH:mm", System.Globalization.CultureInfo.InvariantCulture) : t("yourProject.never");
        box.Children.Add(Text(t("yourProject.times", ("built", Time(m.Status.BuiltAt)), ("run", Time(m.Status.LastRunAt))), 12.5, null, "muted"));
        return Note(box, m.Status.Ready ? "CsSuccessSoft" : "CsSurface2");
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
