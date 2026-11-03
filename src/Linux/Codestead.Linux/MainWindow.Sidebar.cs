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

// The chapter list in the sidebar and the progress meter in the top bar.
public sealed partial class MainWindow
{
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
}
