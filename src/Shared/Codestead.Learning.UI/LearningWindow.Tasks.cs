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

// The tasks of a chapter: check marks, hints, the solution and the per-family chips.
public partial class LearningWindow
{
    private void RenderTasks()
    {
        var chapter = Chapter;
        var tasks = tool.Tasks(chapter.Id, Lang);
        taskPanel.Children.Clear();
        int done = tasks.Count(t => state.Progress.ContainsKey(t.Key));
        var header = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto") };
        header.Children.Add(Text(T("tasks.title"), 16, FontWeight.Bold));
        var count = Text(T("tasks.count", ("done", done), ("total", tasks.Count)), 13, null, "muted");
        Grid.SetColumn(count, 1);
        header.Children.Add(count);
        taskPanel.Children.Add(header);
        var bar = new ProgressBar { Minimum = 0, Maximum = Math.Max(1, tasks.Count), Value = done, Height = 4, MinHeight = 4, Margin = new Thickness(0, 10, 0, 6) };
        bar.Bind(ProgressBar.ForegroundProperty, this.GetResourceObservable("CsSuccess"));
        taskPanel.Children.Add(bar);

        for (int i = 0; i < tasks.Count; i++) taskPanel.Children.Add(TaskItem(tasks[i], i));

        if (done == tasks.Count)
        {
            var box = new StackPanel { Spacing = 10, Margin = new Thickness(0, 14, 0, 0) };
            box.Children.Add(Text(T("tasks.chapterDone"), 15, FontWeight.Bold));
            if (ChapterIndex < Chapters.Count - 1)
            {
                var next = Chapters[ChapterIndex + 1];
                var b = new Button { Content = T("tasks.next", ("title", tool.ChapterTitle(next.Id, Lang))) + " →" };
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

    private Control TaskItem(TaskInfo task, int index)
    {
        var key = task.Key;
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
        text.CommandClicked += cmd => tool.Inject(cmd);
        text.SetMarkdown(task.Text);
        main.Children.Add(text);

        if (task.Chips.Count > 0)
        {
            var chips = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 6 };
            foreach (var f in task.Chips)
            {
                bool fDone = state.Progress.ContainsKey(f.Key);
                var chip = new Border { CornerRadius = new CornerRadius(10), Padding = new Thickness(8, 1), BorderThickness = new Thickness(1), Child = Text((fDone ? "✓ " : "") + f.Label, 11.5) };
                chip.Bind(Border.BorderBrushProperty, this.GetResourceObservable(fDone ? "CsSuccess" : "CsBorder"));
                if (fDone) chip.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsSuccessSoft"));
                if (f.Current) ((TextBlock)chip.Child!).FontWeight = FontWeight.Bold;
                chips.Children.Add(chip);
            }
            ToolTip.SetTip(chips, T("tasks.perFamily"));
            main.Children.Add(chips);
        }
        if (tool.TaskStatus(task, index) is { } status) main.Children.Add(status);

        var hint = task.Hint;
        var solution = task.Solution;
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
                GameRules.OnSolutionShown(state.Game, key);
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
                h.CommandClicked += cmd => tool.Inject(cmd);
                h.SetMarkdown(hint);
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
                    b.Click += (_, _) => tool.Inject(c);
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

}
