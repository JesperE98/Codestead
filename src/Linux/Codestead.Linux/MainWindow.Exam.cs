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

// The exam of a main chapter.
public sealed partial class MainWindow
{
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
            Present(LinuxGame.Rules.OnExam(state.Game, Snapshot(), chapter.Part, percent, DateTime.Now));
        };
        lessonPanel.Children.Add(submit);
        lessonPanel.Children.Add(result);
    }
}
