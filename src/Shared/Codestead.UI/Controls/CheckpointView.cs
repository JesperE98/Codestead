using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Documents;
using Avalonia.Controls.Primitives;
using Avalonia.Layout;
using Avalonia.Media;
using Codestead.UI.Learning;

namespace Codestead.UI.Controls;

/// <summary>
/// One interactive checkpoint in a lesson (or a question in an exam): a quiz, a "what does this print?"
/// question or a "try it" question. A "try it" question has no terminal of its own: the student runs the
/// command in the tool's terminal, and the window passes every command line on with <see cref="CommandRan"/>.
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
    private readonly ISandbox sandbox;
    private readonly TextBlock feedback = new() { TextWrapping = TextWrapping.Wrap, IsVisible = false, FontWeight = FontWeight.SemiBold };
    private readonly MarkdownView explanation = new() { BaseFontSize = 14, IsVisible = false };
    private readonly List<ToggleButton> optionButtons = new();
    private TextBox? answerBox;
    private Button? checkButton;
    private bool trySolved;
    private bool solved;

    /// <summary>Fired once when the checkpoint has been answered correctly (lesson mode).</summary>
    public event Action<Checkpoint>? Solved;

    public bool IsSolved => solved;
    public bool ExamMode => examMode;

    /// <param name="sandbox">Gives the output a "try" command has on a fresh computer (another command with the same output also counts).</param>
    public CheckpointView(Checkpoint cp, CheckpointTexts texts, bool alreadySolved, ISandbox sandbox, bool examMode = false, Action<string>? onCommandClicked = null)
    {
        this.cp = cp;
        this.texts = texts;
        this.examMode = examMode;
        this.sandbox = sandbox;
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
                BuildTry(onCommandClicked);
                break;
        }

        if (!examMode && cp.Kind != Checkpoint.Try)
        {
            checkButton = new Button { Content = texts.Check, HorizontalAlignment = HorizontalAlignment.Left };
            checkButton.Classes.Add("secondary");
            checkButton.Click += (_, _) => CheckNow();
            showAnswerButton = new Button { Content = texts.ShowAnswer, IsVisible = false };
            showAnswerButton.Classes.Add("secondary");
            showAnswerButton.Click += (_, _) => ShowAnswer();
            body.Children.Add(new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8, Children = { checkButton, showAnswerButton } });
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

    private string? tryExpected;

    private void BuildTry(Action<string>? onCommandClicked)
    {
        var prompt = new TextBlock { Text = texts.TryPrompt, TextWrapping = TextWrapping.Wrap };
        body.Children.Add(prompt);
        var command = cp.Commands[0];
        if (onCommandClicked is not null)
        {
            // A click puts the command in the terminal, like the commands in the lesson text.
            var b = new Button { Content = command, HorizontalAlignment = HorizontalAlignment.Left, FlowDirection = FlowDirection.LeftToRight };
            b.Classes.Add("solution");
            b.Click += (_, _) => onCommandClicked(command);
            body.Children.Add(b);
        }
        else
        {
            var hint = new SelectableTextBlock { FontFamily = new FontFamily("Cascadia Mono, DejaVu Sans Mono, Liberation Mono, monospace"), FontSize = 14, Text = command, FlowDirection = FlowDirection.LeftToRight };
            hint.Bind(TextBlock.ForegroundProperty, hint.GetResourceObservable("CsAccent"));
            body.Children.Add(hint);
        }
    }

    /// <summary>
    /// A command line run in the tool's terminal. Solves a "try it" question when it is one of the accepted
    /// commands, or prints what the first of them prints on a fresh computer. Other kinds ignore it.
    /// </summary>
    public void CommandRan(SandboxRun run)
    {
        if (cp.Kind != Checkpoint.Try || solved || !run.Finished) return;
        var line = Checkpoint.Normalize(run.Line);
        bool right = cp.Commands.Any(c => Checkpoint.Normalize(c) == line);
        if (!right && run.ExitCode == 0)
        {
            tryExpected ??= sandbox.OutputOf(cp.Commands[0]).Trim();
            right = tryExpected != "" && run.Output.Trim() == tryExpected;
        }
        if (!right) return;
        trySolved = true;
        if (!examMode) MarkSolved(silent: false);
    }

    private bool IsAnswerRight() => cp.Kind switch
    {
        Checkpoint.Quiz => cp.IsCorrectChoice(optionButtons.Select((b, i) => (b, i)).Where(x => x.b.IsChecked == true).Select(x => x.i).ToList()),
        Checkpoint.Predict => cp.IsCorrectPrediction(answerBox?.Text ?? ""),
        _ => trySolved,
    };

    /// <summary>Wrong answers before "Show the answer" appears (lessons only; exams are graded at the end).</summary>
    public const int AttemptsBeforeAnswer = 2;

    private int wrongAttempts;
    private Button? showAnswerButton;

    private void CheckNow()
    {
        if (solved) return;
        if (IsAnswerRight())
        {
            MarkSolved(silent: false);
            return;
        }
        wrongAttempts++;
        // The most common slip in "what does this print?": the names without the directory ls prints in front.
        bool almost = cp.Kind == Checkpoint.Predict && cp.IsRightWithoutDirectories(answerBox?.Text ?? "");
        feedback.Text = "✗ " + (almost ? texts.AlmostPath : texts.Wrong);
        feedback.IsVisible = true;
        feedback.Bind(TextBlock.ForegroundProperty, feedback.GetResourceObservable("CsDanger"));
        // Nobody should be stuck: after a few tries the answer can be shown (and the chapter goes on).
        if (!examMode && cp.Kind != Checkpoint.Try && wrongAttempts >= AttemptsBeforeAnswer && showAnswerButton is not null)
            showAnswerButton.IsVisible = true;
    }

    private void ShowAnswer()
    {
        if (solved) return;
        if (answerBox is not null) answerBox.Text = cp.Expected;
        MarkSolved(silent: false);
    }

    private void MarkSolved(bool silent)
    {
        if (solved) return;
        solved = true;
        if (checkButton is not null) checkButton.IsVisible = false;
        if (showAnswerButton is not null) showAnswerButton.IsVisible = false;
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
