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

// The lesson text with its interactive checkpoints, and the previous/next buttons.
public sealed partial class MainWindow
{
    /// <summary>Turns ```quiz / ```predict / ```try blocks in a lesson or exam into interactive checkpoints.</summary>
    private int nextCheckpoint;
    private readonly List<CheckpointView> examViews = new();
    private bool renderingExam;

    private Control? RenderCheckpoint(Markdig.Syntax.FencedCodeBlock fenced)
    {
        var kind = (fenced.Info ?? "").Trim();
        if (!Codestead.UI.Learning.Checkpoint.Kinds.Contains(kind)) return null;
        var chapter = Chapter;
        int index = nextCheckpoint++;
        var cp = Codestead.UI.Learning.Checkpoint.Parse(kind, fenced.Lines.ToString().TrimEnd('\n', '\r'), index);
        var key = CheckpointKey(chapter, index);
        var distroId = DistroOf(chapter).Id;
        var view = new CheckpointView(cp, CheckpointTexts(), state.Checkpoints.ContainsKey(key), new ShellSandbox(distroId, Lang), renderingExam, cmd => terminal.Inject(cmd));
        if (renderingExam)
        {
            examViews.Add(view);
        }
        else
        {
            view.Solved += _ =>
            {
                bool wasUnlocked = IsUnlocked(chapter);
                state.Checkpoints[key] = true;
                SaveState();
                var ev = LinuxGame.Rules.OnCheckpoint(state.Game, Snapshot(), DateTime.Now);
                if (chapter.Id == Chapter.Id && ev.Celebrate) RenderSidebar();
                Present(ev);
                if (chapter.Id != Chapter.Id) return;
                if (!wasUnlocked && IsUnlocked(chapter))
                {
                    overlay.Toast(T("gate.unlocked"));
                    Unlocked();
                }
                else
                {
                    RenderWorkbench();
                }
            };
        }
        return view;
    }

    private void RenderLesson()
    {
        var chapter = Chapter;
        var available = I18nLib.LanguagesWithMarkdown(chapter);
        var shownLang = LanguagesLib.FallbackChain(Lang).FirstOrDefault(l => available.Contains(l)) ?? "sv";
        var shownDir = LanguagesLib.Languages.FirstOrDefault(l => l.Code == shownLang)?.Dir ?? "ltr";

        lessonPanel.Children.Clear();
        var eyebrowText = chapter.Kind switch
        {
            ChapterKinds.Summary => T($"part.{chapter.Part}") + " · " + T("summary.label"),
            ChapterKinds.Exam => T($"part.{chapter.Part}") + " · " + T("exam.label"),
            // Numbered like the sidebar: lessons only (summaries and exams are not counted).
            _ => T("lesson.chapter", ("n", Lessons.IndexOf(chapter) + 1), ("total", Lessons.Count)),
        };
        var eyebrow = Text(eyebrowText.ToUpperInvariant(), 12.5, null, "eyebrow");
        lessonPanel.Children.Add(eyebrow);
        if (!available.Contains(Lang))
        {
            var note = new Border { Padding = new Thickness(12, 8), CornerRadius = new CornerRadius(6), Margin = new Thickness(0, 10, 0, 0), Child = Text(T("lesson.fallback"), 13.5) };
            note.Bind(Border.BackgroundProperty, this.GetResourceObservable("CsWarningSoft"));
            lessonPanel.Children.Add(note);
        }
        markdown.FlowDirection = shownDir == "rtl" ? FlowDirection.RightToLeft : FlowDirection.LeftToRight;
        var text = RenderLib.Preprocess(I18nLib.ChapterMarkdown(chapter, Lang), Distro, Lang);
        nextCheckpoint = 0;
        examViews.Clear();
        if (chapter.Kind == ChapterKinds.Exam) RenderExam(chapter, text);
        else
        {
            renderingExam = false;
            markdown.SetMarkdown(text);
            lessonPanel.Children.Add(markdown);
        }

        // A lesson without checkpoints: the student confirms having read it.
        if (chapter.Kind == ChapterKinds.Lesson && !IsUnlocked(chapter) && CheckpointCount(chapter) == 0)
        {
            var read = new Button { Content = "✓  " + T("gate.readButton"), Margin = new Thickness(0, 18, 0, 0) };
            read.Classes.Add("primary");
            read.Click += (_, _) =>
            {
                if (!state.Read.Contains(chapter.Id)) state.Read.Add(chapter.Id);
                SaveState();
                read.IsVisible = false;
                overlay.Toast(T("gate.unlocked"));
                Unlocked();
                Present(LinuxGame.Rules.Sync(state.Game, Snapshot(), DateTime.Now));
            };
            lessonPanel.Children.Add(read);
        }

        // Official sources for the chapter.
        var references = I18nLib.References(chapter);
        if (references.Count > 0)
        {
            var refs = new StackPanel { Spacing = 2, Margin = new Thickness(0, 30, 0, 0) };
            refs.Children.Add(Text(T("references.title"), 17, FontWeight.Bold));
            foreach (var r in references)
            {
                var content = new StackPanel { Spacing = 0 };
                var title = Text("↗  " + r.Title, 14.5, FontWeight.SemiBold);
                title.Bind(TextBlock.ForegroundProperty, this.GetResourceObservable("CsLink"));
                content.Children.Add(title);
                content.Children.Add(Text($"{r.Publisher} · {r.Url}", 12, null, "muted"));
                var link = new Button { Content = content, HorizontalAlignment = HorizontalAlignment.Stretch, HorizontalContentAlignment = HorizontalAlignment.Left, Padding = new Thickness(8, 6) };
                link.Classes.Add("flat");
                ToolTip.SetTip(link, r.Url);
                var url = r.Url;
                link.Click += (_, _) => OpenLink(url);
                refs.Children.Add(link);
            }
            lessonPanel.Children.Add(refs);
        }

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
}
