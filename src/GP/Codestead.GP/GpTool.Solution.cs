using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using Codestead.GP.Course;
using Codestead.Learning.UI;
using static Codestead.UI.App.UiParts;

namespace Codestead.GP;

// A task's solution opens in a window of its own: the course's code for the task, file by file, to compare with the
// learner's own; nothing is written into their files.
public sealed partial class GpTool
{
    private static readonly FontFamily SolutionMono = new("Cascadia Mono, JetBrains Mono, DejaVu Sans Mono, Liberation Mono, Noto Sans Mono, Menlo, Consolas, monospace");

    public override Control? SolutionWindow(TaskInfo task, int index, Action close)
    {
        var tasks = GpCourse.AllTasks(chapter, shownApi);
        if (index < 0 || index >= tasks.Count) return null;
        var panel = new StackPanel { Spacing = 10 };
        int steps = GpCourse.Tasks(chapter, shownApi).Count;
        var title = Text(index < steps
            ? Window.T("yourProject.solutionTitle", ("n", index + 1))
            : Window.T("yourProject.solutionExercise", ("n", index - steps + 1)), 18, FontWeight.Bold);
        panel.Children.Add(title);
        var help = Text(Window.T(tasks[index].Edits.Count > 0 ? "yourProject.solutionHelp" : "yourProject.buildRunSolution"), 13, null, "muted");
        help.TextWrapping = TextWrapping.Wrap;
        panel.Children.Add(help);
        foreach (var edit in tasks[index].Edits)
        {
            var head = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto"), Margin = new Thickness(0, 6, 0, 0) };
            var file = new TextBlock { Text = edit.File, FontFamily = SolutionMono, FontSize = 13, FontWeight = FontWeight.SemiBold, VerticalAlignment = VerticalAlignment.Center };
            head.Children.Add(file);
            var copy = new Button { Content = Window.T("yourProject.copyCode"), Padding = new Thickness(10, 3), FontSize = 12.5 };
            copy.Classes.Add("secondary");
            var code = Dedent(edit.Replace);
            copy.Click += (_, _) => _ = CopyToClipboard(code);
            Grid.SetColumn(copy, 1);
            head.Children.Add(copy);
            panel.Children.Add(head);
            panel.Children.Add(new Border
            {
                Background = new SolidColorBrush(Color.Parse("#0f1318")),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(14, 10),
                Child = new ScrollViewer
                {
                    HorizontalScrollBarVisibility = Avalonia.Controls.Primitives.ScrollBarVisibility.Auto,
                    VerticalScrollBarVisibility = Avalonia.Controls.Primitives.ScrollBarVisibility.Disabled,
                    Content = new SelectableTextBlock { Text = code.TrimEnd('\n'), FontFamily = SolutionMono, FontSize = 13, LineHeight = 19, Foreground = new SolidColorBrush(Color.Parse("#e6edf3")) },
                },
            });
        }
        var closeButton = new Button { Content = Window.T("yourProject.close"), HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 8, 0, 0) };
        closeButton.Classes.Add("primary");
        closeButton.Click += (_, _) => close();
        panel.Children.Add(closeButton);
        return panel;
    }

    /// <summary>The code without the indentation all its lines share (it comes from inside a function).</summary>
    private static string Dedent(string code)
    {
        var lines = code.Replace("\r\n", "\n").TrimEnd('\n').Split('\n');
        int indent = lines.Where(l => l.Trim().Length > 0).Select(l => l.Length - l.TrimStart(' ', '\t').Length).DefaultIfEmpty(0).Min();
        return string.Join("\n", lines.Select(l => l.Length >= indent ? l[indent..] : l.TrimStart()));
    }
}
