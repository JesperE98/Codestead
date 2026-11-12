using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using static Codestead.UI.App.UiParts;

namespace Codestead.GP.YourProject;

// The status list: one row per task with its state (locked, waiting for a build or a run, checking, done, not yet)
// and, when a check did not pass, why.
public sealed partial class ProjectPanel
{
    private Control TaskList(PanelModel m, Tr t)
    {
        var list = new StackPanel { Spacing = 2 };
        if (m.Tasks.Count == 0)
        {
            list.Children.Add(Wrapped(t("yourProject.noTasks"), 13, "muted"));
            return list;
        }
        list.Children.Add(Text(t("yourProject.tasks"), 14, FontWeight.SemiBold));
        foreach (var row in m.Tasks) list.Children.Add(TaskItem(row, row.Index == m.SelectedTask, t));
        return list;
    }

    /// <summary>
    /// The state of one task under its text in the task list: what the app is waiting for, or why the check did not
    /// pass. Clicking it shows the task's expected result.
    /// </summary>
    public Control StatusLine(TaskRow row, bool selected, Tr t)
    {
        var (icon, brush, label) = Look(row, t);
        var mark = new TextBlock { Text = icon, FontWeight = FontWeight.Bold, FontSize = 12.5, Margin = new Thickness(0, 0, 6, 0), VerticalAlignment = VerticalAlignment.Top };
        mark.Bind(TextBlock.ForegroundProperty, this.GetResourceObservable(brush));
        var main = new StackPanel { Spacing = 2 };
        var state = Text(label, 12.5, selected ? FontWeight.SemiBold : FontWeight.Normal);
        state.Bind(TextBlock.ForegroundProperty, this.GetResourceObservable(row.State == TaskState.Done ? "CsSuccess" : row.State == TaskState.NotYet ? "CsWarning" : "CsTextMuted"));
        main.Children.Add(state);
        foreach (var message in row.Messages) main.Children.Add(Wrapped(message, 12.5, "muted"));
        var grid = new Grid { ColumnDefinitions = new ColumnDefinitions("Auto,*") };
        grid.Children.Add(mark);
        Grid.SetColumn(main, 1);
        grid.Children.Add(main);
        var button = new Button { Content = grid, HorizontalAlignment = HorizontalAlignment.Stretch, HorizontalContentAlignment = HorizontalAlignment.Stretch, Padding = new Thickness(6, 4) };
        button.Classes.Add("flat");
        if (selected) button.Bind(Button.BackgroundProperty, this.GetResourceObservable("CsSurface2"));
        ToolTip.SetTip(button, t("expected.show"));
        int index = row.Index;
        button.Click += (_, _) => TaskSelected?.Invoke(index);
        return button;
    }

    private static (string Icon, string Brush, string Label) Look(TaskRow row, Tr t) => row.State switch
    {
        TaskState.Done => ("✓", "CsSuccess", t("yourProject.done")),
        TaskState.Locked => ("🔒", "CsTextMuted", t("yourProject.locked")),
        TaskState.NeedsFolder => ("·", "CsTextMuted", t("yourProject.needFolder")),
        TaskState.WaitingForBuild => ("⏳", "CsTextMuted", t("yourProject.waitBuild")),
        TaskState.WaitingForRun => ("▶", "CsAccent", t("yourProject.waitRun")),
        TaskState.Checking => ("…", "CsInfo", t("yourProject.checking")),
        _ => ("✗", "CsWarning", t("yourProject.notYet")),
    };

    private Control TaskItem(TaskRow row, bool selected, Tr t)
    {
        var (icon, brush, label) = row.State switch
        {
            TaskState.Done => ("✓", "CsSuccess", t("yourProject.done")),
            TaskState.Locked => ("🔒", "CsTextMuted", t("yourProject.locked")),
            TaskState.NeedsFolder => ("·", "CsTextMuted", t("yourProject.needFolder")),
            TaskState.WaitingForBuild => ("⏳", "CsTextMuted", t("yourProject.waitBuild")),
            TaskState.WaitingForRun => ("▶", "CsAccent", t("yourProject.waitRun")),
            TaskState.Checking => ("…", "CsInfo", t("yourProject.checking")),
            _ => ("✗", "CsWarning", t("yourProject.notYet")),
        };
        var mark = new TextBlock { Text = icon, FontWeight = FontWeight.Bold, FontSize = 13, Width = 22, TextAlignment = TextAlignment.Center, VerticalAlignment = VerticalAlignment.Top, Margin = new Thickness(0, 1, 8, 0) };
        mark.Bind(TextBlock.ForegroundProperty, this.GetResourceObservable(brush));
        var main = new StackPanel { Spacing = 2 };
        var title = Text(t("yourProject.task", ("n", row.Index + 1)) + "  ·  " + row.Title, 13.5, selected ? FontWeight.SemiBold : FontWeight.Normal);
        title.TextTrimming = TextTrimming.CharacterEllipsis;
        main.Children.Add(title);
        var state = Text(label, 12.5);
        state.Bind(TextBlock.ForegroundProperty, this.GetResourceObservable(row.State == TaskState.Done ? "CsSuccess" : row.State == TaskState.NotYet ? "CsWarning" : "CsTextMuted"));
        main.Children.Add(state);
        foreach (var message in row.Messages) main.Children.Add(Wrapped(message, 12.5, "muted"));
        var grid = new Grid { ColumnDefinitions = new ColumnDefinitions("Auto,*") };
        grid.Children.Add(mark);
        Grid.SetColumn(main, 1);
        grid.Children.Add(main);
        var button = new Button
        {
            Content = grid,
            HorizontalAlignment = HorizontalAlignment.Stretch,
            HorizontalContentAlignment = HorizontalAlignment.Stretch,
            Padding = new Thickness(6, 6),
        };
        button.Classes.Add("flat");
        if (selected) button.Bind(Button.BackgroundProperty, this.GetResourceObservable("CsSurface2"));
        ToolTip.SetTip(button, t("expected.show"));
        int index = row.Index;
        button.Click += (_, _) => TaskSelected?.Invoke(index);
        return button;
    }
}
