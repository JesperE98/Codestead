using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Documents;
using Avalonia.Controls.Primitives;
using Avalonia.Layout;
using Avalonia.Media;
using Codestead.UI.Learning;
using ShellType = Codestead.Shell.Shell;

namespace Codestead.UI.Controls;

/// <summary>Localised texts used by the checkpoint controls.</summary>
public sealed record CheckpointTexts(
    string Check,
    string Correct,
    string Wrong,
    string PredictPrompt,
    string TryPrompt,
    string Done,
    string AnswerPlaceholder,
    string Question);

/// <summary>
/// One interactive checkpoint in a lesson (or a question in an exam): a quiz, a "what does this print?"
/// question or a "try it" mini terminal.
/// In lesson mode answers are checked at once and the control turns green when solved.
/// In exam mode (<see cref="ExamMode"/>) answers are only collected; <see cref="Grade"/> marks them.
/// </summary>
public sealed class CheckpointView : UserControl
{
    private readonly Checkpoint cp;
    private readonly CheckpointTexts texts;
    private readonly bool examMode;
    private readonly Border card;
    private readonly StackPanel body = new() { Spacing = 8 };
    private readonly TextBlock feedback = new() { TextWrapping = TextWrapping.Wrap, IsVisible = false, FontWeight = FontWeight.SemiBold };
    private readonly MarkdownView explanation = new() { BaseFontSize = 14, IsVisible = false };
    private readonly List<ToggleButton> optionButtons = new();
    private TextBox? answerBox;
    private Button? checkButton;
    private bool trySolved;
    private bool solved;

    /// <summary>Fired once when the checkpoint has been answered correctly (lesson mode).</summary>
    public event Action<Checkpoint>? Solved;

    /// <summary>Fired when a "try" command line was run in the mini terminal.</summary>
    public event Action<string>? CommandRun;

    public bool IsSolved => solved;
    public bool ExamMode => examMode;

    /// <param name="sandbox">Creates the shell for "try" blocks (a separate sandbox, not the student's terminal).</param>
    public CheckpointView(Checkpoint cp, CheckpointTexts texts, bool alreadySolved, Func<ShellType> sandbox, bool examMode = false, Action<string>? onCommandClicked = null)
    {
        this.cp = cp;
        this.texts = texts;
        this.examMode = examMode;
        card = new Border
        {
            CornerRadius = new CornerRadius(10),
            BorderThickness = new Thickness(1, 1, 1, 1),
            Padding = new Thickness(16, 12),
            Margin = new Thickness(0, 10, 0, 14),
            Child = body,
        };
        card.Bind(Border.BackgroundProperty, card.GetResourceObservable("CsSurface"));
        card.Bind(Border.BorderBrushProperty, card.GetResourceObservable("CsBorder"));
        Content = card;

        var label = new TextBlock { Text = (examMode ? texts.Question + " " + (cp.Index + 1) : "✎ " + texts.Question).ToUpperInvariant(), FontSize = 11.5, FontWeight = FontWeight.Bold, LetterSpacing = 0.6 };
        label.Bind(TextBlock.ForegroundProperty, label.GetResourceObservable("CsAccent"));
        body.Children.Add(label);

        switch (cp.Kind)
        {
            case Checkpoint.Quiz:
                BuildQuiz(onCommandClicked);
                break;
            case Checkpoint.Predict:
                BuildPredict();
                break;
            default:
                BuildTry(sandbox);
                break;
        }

        if (!examMode && cp.Kind != Checkpoint.Try)
        {
            checkButton = new Button { Content = texts.Check, HorizontalAlignment = HorizontalAlignment.Left };
            checkButton.Classes.Add("secondary");
            checkButton.Click += (_, _) => CheckNow();
            body.Children.Add(checkButton);
        }
        body.Children.Add(feedback);
        if (cp.Explanation is not null)
        {
            explanation.SetMarkdown(cp.Explanation);
            body.Children.Add(explanation);
        }
        if (alreadySolved && !examMode) MarkSolved(silent: true);
    }

    private void BuildQuiz(Action<string>? onCommandClicked)
    {
        var prompt = new MarkdownView { BaseFontSize = 15.5 };
        if (onCommandClicked is not null) prompt.CommandClicked += onCommandClicked;
        prompt.SetMarkdown(cp.Prompt);
        body.Children.Add(prompt);
        var group = $"cp-{Guid.NewGuid():N}";
        foreach (var option in cp.Options)
        {
            var md = new MarkdownView { BaseFontSize = 14.5 };
            md.SetMarkdown(option.Text);
            ToggleButton b = cp.MultipleAnswers ? new CheckBox { Content = md } : new RadioButton { Content = md, GroupName = group };
            b.Margin = new Thickness(0, 0, 0, 2);
            optionButtons.Add(b);
            body.Children.Add(b);
        }
    }

    private void BuildPredict()
    {
        body.Children.Add(new TextBlock { Text = texts.PredictPrompt, TextWrapping = TextWrapping.Wrap });
        var code = new SelectableTextBlock { FontFamily = new FontFamily("Cascadia Mono, DejaVu Sans Mono, Liberation Mono, monospace"), FontSize = 14, Foreground = new SolidColorBrush(Color.Parse("#e6edf3")), Inlines = new InlineCollection() };
        foreach (var c in cp.Commands)
        {
            if (code.Inlines.Count > 0) code.Inlines.Add(new LineBreak());
            code.Inlines.Add(new Run("$ ") { Foreground = new SolidColorBrush(Color.Parse("#7d8590")) });
            code.Inlines.Add(new Run(c));
        }
        body.Children.Add(new Border { Background = new SolidColorBrush(Color.Parse("#0f1318")), CornerRadius = new CornerRadius(6), Padding = new Thickness(12, 8), FlowDirection = FlowDirection.LeftToRight, Child = code });
        answerBox = new TextBox
        {
            AcceptsReturn = cp.Expected.Contains('\n'),
            FontFamily = new FontFamily("Cascadia Mono, DejaVu Sans Mono, Liberation Mono, monospace"),
            PlaceholderText = texts.AnswerPlaceholder,
            FlowDirection = FlowDirection.LeftToRight,
            MinHeight = cp.Expected.Contains('\n') ? 70 : 0,
        };
        answerBox.KeyDown += (_, e) =>
        {
            if (e.Key == Avalonia.Input.Key.Enter && !answerBox.AcceptsReturn && !examMode)
            {
                e.Handled = true;
                CheckNow();
            }
        };
        body.Children.Add(answerBox);
    }

    private void BuildTry(Func<ShellType> sandbox)
    {
        var prompt = new TextBlock { Text = texts.TryPrompt, TextWrapping = TextWrapping.Wrap };
        body.Children.Add(prompt);
        var hint = new SelectableTextBlock { FontFamily = new FontFamily("Cascadia Mono, DejaVu Sans Mono, Liberation Mono, monospace"), FontSize = 14, Text = string.Join("\n", cp.Commands.Take(1)), FlowDirection = FlowDirection.LeftToRight };
        hint.Bind(TextBlock.ForegroundProperty, hint.GetResourceObservable("CsAccent"));
        body.Children.Add(hint);
        var shell = sandbox();
        // The output the reference command gives in a fresh sandbox – another command with the same output also counts.
        var expected = Codestead.Shell.Commands.UtilCmd.StripAnsi(sandbox().Execute(cp.Commands[0]).Output).Trim();
        var terminal = new TerminalView { Shell = shell, Height = 170 };
        terminal.CommandExecuted += r =>
        {
            CommandRun?.Invoke(r.Line);
            if (r.Pending || r.Incomplete) return;
            var line = Checkpoint.Normalize(r.Line);
            var output = Codestead.Shell.Commands.UtilCmd.StripAnsi(r.Output).Trim();
            if (cp.Commands.Any(c => Checkpoint.Normalize(c) == line) || (expected != "" && output == expected && r.ExitCode == 0))
            {
                trySolved = true;
                if (!examMode) MarkSolved(silent: false);
            }
        };
        body.Children.Add(new Border { CornerRadius = new CornerRadius(8), ClipToBounds = true, Child = terminal });
    }

    private bool IsAnswerRight() => cp.Kind switch
    {
        Checkpoint.Quiz => cp.IsCorrectChoice(optionButtons.Select((b, i) => (b, i)).Where(x => x.b.IsChecked == true).Select(x => x.i).ToList()),
        Checkpoint.Predict => cp.IsCorrectPrediction(answerBox?.Text ?? ""),
        _ => trySolved,
    };

    private void CheckNow()
    {
        if (solved) return;
        if (IsAnswerRight())
        {
            MarkSolved(silent: false);
        }
        else
        {
            feedback.Text = "✗ " + texts.Wrong;
            feedback.IsVisible = true;
            feedback.Bind(TextBlock.ForegroundProperty, feedback.GetResourceObservable("CsDanger"));
        }
    }

    private void MarkSolved(bool silent)
    {
        if (solved) return;
        solved = true;
        if (checkButton is not null) checkButton.IsVisible = false;
        feedback.Text = "✓ " + (silent ? texts.Done : texts.Correct);
        feedback.IsVisible = true;
        feedback.Bind(TextBlock.ForegroundProperty, feedback.GetResourceObservable("CsAccent"));
        explanation.IsVisible = cp.Explanation is not null;
        card.Bind(Border.BorderBrushProperty, card.GetResourceObservable("CsAccent"));
        card.Bind(Border.BackgroundProperty, card.GetResourceObservable("CsAccentSoft"));
        if (cp.Kind == Checkpoint.Quiz)
        {
            for (int i = 0; i < optionButtons.Count; i++)
            {
                optionButtons[i].IsChecked = cp.Options[i].Correct;
                optionButtons[i].IsEnabled = false;
            }
        }
        if (answerBox is not null)
        {
            if (string.IsNullOrWhiteSpace(answerBox.Text)) answerBox.Text = cp.Expected;
            answerBox.IsReadOnly = true;
        }
        if (!silent) Solved?.Invoke(cp);
    }

    /// <summary>Exam mode: marks the answer right or wrong, locks it and returns whether it was right.</summary>
    public bool Grade()
    {
        bool right = IsAnswerRight();
        feedback.Text = right ? "✓ " + texts.Correct : "✗ " + texts.Wrong;
        feedback.IsVisible = true;
        feedback.Bind(TextBlock.ForegroundProperty, feedback.GetResourceObservable(right ? "CsAccent" : "CsDanger"));
        card.Bind(Border.BorderBrushProperty, card.GetResourceObservable(right ? "CsAccent" : "CsDanger"));
        explanation.IsVisible = cp.Explanation is not null;
        foreach (var b in optionButtons) b.IsEnabled = false;
        if (answerBox is not null) answerBox.IsReadOnly = true;
        return right;
    }
}
