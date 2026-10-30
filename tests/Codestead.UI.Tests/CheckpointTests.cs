using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Input;
using Avalonia.LogicalTree;
using Codestead.UI.Controls;
using Codestead.UI.Learning;

namespace Codestead.UI.Tests;

public class CheckpointTests
{
    private static readonly CheckpointTexts Texts = new("Check", "Correct", "Wrong", "Predict", "Try", "Done", "Answer", "Question");

    private const string Sample = """
        # Title

        ```quiz
        Which command shows where you are?
        - [ ] ls
        - [x] pwd
        ---
        `pwd` = print working directory.
        ```

        Some text.

        ```predict
        $ echo $((2 + 3))
        5
        ```

        ```try
        pwd
        echo $PWD
        ```

        ```sh
        ls
        ```
        """;

    [Fact(DisplayName = "kontrollpunkter tolkas i ordning: quiz, predict, try")]
    public void ParsesAllKinds()
    {
        var cps = Checkpoint.ParseAll(Sample);
        Assert.Equal(new[] { "quiz", "predict", "try" }, cps.Select(c => c.Kind));
        Assert.Equal(new[] { 0, 1, 2 }, cps.Select(c => c.Index));

        var quiz = cps[0];
        Assert.Equal("Which command shows where you are?", quiz.Prompt);
        Assert.Equal(2, quiz.Options.Count);
        Assert.False(quiz.MultipleAnswers);
        Assert.Equal("`pwd` = print working directory.", quiz.Explanation);
        Assert.True(quiz.IsCorrectChoice(new[] { 1 }));
        Assert.False(quiz.IsCorrectChoice(new[] { 0 }));
        Assert.False(quiz.IsCorrectChoice(new[] { 0, 1 }));

        var predict = cps[1];
        Assert.Equal(new[] { "echo $((2 + 3))" }, predict.Commands);
        Assert.True(predict.IsCorrectPrediction(" 5 "));
        Assert.False(predict.IsCorrectPrediction("6"));
        Assert.Null(predict.Explanation);

        Assert.Equal(new[] { "pwd", "echo $PWD" }, cps[2].Commands);
    }

    [Fact(DisplayName = "felaktiga kontrollpunkter ger FormatException")]
    public void RejectsMalformed()
    {
        Assert.Throws<FormatException>(() => Checkpoint.Parse("quiz", "Question?\n- [ ] a\n- [ ] b", 0));
        Assert.Throws<FormatException>(() => Checkpoint.Parse("quiz", "Question?\n- [x] only one", 0));
        Assert.Throws<FormatException>(() => Checkpoint.Parse("quiz", "- [x] a\n- [ ] b", 0));
        Assert.Throws<FormatException>(() => Checkpoint.Parse("predict", "echo hi\nhi", 0));
        Assert.Throws<FormatException>(() => Checkpoint.Parse("try", "\n---\nText", 0));
    }

    [Fact(DisplayName = "flervalsfråga med flera rätt kräver exakt de rätta")]
    public void MultipleAnswers()
    {
        var cp = Checkpoint.Parse("quiz", "Pick both\n- [x] a\n- [ ] b\n- [x] c", 0);
        Assert.True(cp.MultipleAnswers);
        Assert.True(cp.IsCorrectChoice(new[] { 0, 2 }));
        Assert.False(cp.IsCorrectChoice(new[] { 0 }));
    }

    private static CheckpointView View(string kind, string body, bool exam = false, bool solved = false) =>
        new(Checkpoint.Parse(kind, body, 0), Texts, solved, () => Codestead.Shell.Shell.Create("ubuntu"), exam);

    [Fact(DisplayName = "quiz: fel svar låser inte upp, rätt svar gör det")]
    public void QuizSolves()
        => Ui.Run(() =>
    {
        var view = View("quiz", "Which?\n- [ ] ls\n- [x] pwd");
        int solved = 0;
        view.Solved += _ => solved++;
        var w = new Window { Content = view };
        w.Show();
        var options = view.GetLogicalDescendants().OfType<RadioButton>().ToList();
        var check = view.GetLogicalDescendants().OfType<Button>().First(b => b.Content as string == "Check");

        options[0].IsChecked = true;
        check.RaiseEvent(new Avalonia.Interactivity.RoutedEventArgs(Button.ClickEvent));
        Assert.False(view.IsSolved);
        Assert.Equal(0, solved);

        options[1].IsChecked = true;
        check.RaiseEvent(new Avalonia.Interactivity.RoutedEventArgs(Button.ClickEvent));
        Assert.True(view.IsSolved);
        Assert.Equal(1, solved);
        Assert.All(options, o => Assert.False(o.IsEnabled));
        w.Close();
    });

    [Fact(DisplayName = "predict: svaret jämförs med förväntad utskrift")]
    public void PredictSolves()
        => Ui.Run(() =>
    {
        var view = View("predict", "$ echo hej\nhej");
        var w = new Window { Content = view };
        w.Show();
        var box = view.GetLogicalDescendants().OfType<TextBox>().First();
        box.Text = "hej då";
        box.RaiseEvent(new KeyEventArgs { RoutedEvent = InputElement.KeyDownEvent, Key = Key.Enter });
        Assert.False(view.IsSolved);
        box.Text = "hej";
        box.RaiseEvent(new KeyEventArgs { RoutedEvent = InputElement.KeyDownEvent, Key = Key.Enter });
        Assert.True(view.IsSolved);
        w.Close();
    });

    [Fact(DisplayName = "try: rätt kommando – eller ett med samma utskrift – i miniterminalen löser den")]
    public void TrySolves()
        => Ui.Run(() =>
    {
        foreach (var typed in new[] { "pwd", "echo $PWD" })
        {
            var view = View("try", "pwd");
            var w = new Window { Content = view };
            w.Show();
            var input = view.GetLogicalDescendants().OfType<TerminalView>().First().GetLogicalDescendants().OfType<TextBox>().First();
            input.Text = "ls";
            input.RaiseEvent(new KeyEventArgs { RoutedEvent = InputElement.KeyDownEvent, Key = Key.Enter });
            Assert.False(view.IsSolved);
            input.Text = typed;
            input.RaiseEvent(new KeyEventArgs { RoutedEvent = InputElement.KeyDownEvent, Key = Key.Enter });
            Assert.True(view.IsSolved, typed);
            w.Close();
        }
    });

    [Fact(DisplayName = "redan klarad kontrollpunkt visas som klar utan att Solved skickas")]
    public void AlreadySolved()
        => Ui.Run(() =>
    {
        var view = View("quiz", "Which?\n- [ ] ls\n- [x] pwd", solved: true);
        int solved = 0;
        view.Solved += _ => solved++;
        Assert.True(view.IsSolved);
        Assert.Equal(0, solved);
    });

    [Fact(DisplayName = "provläge: inget rättas förrän Grade() anropas")]
    public void ExamMode()
        => Ui.Run(() =>
    {
        var view = View("quiz", "Which?\n- [ ] ls\n- [x] pwd", exam: true);
        var w = new Window { Content = view };
        w.Show();
        Assert.DoesNotContain(view.GetLogicalDescendants().OfType<Button>(), b => b.Content as string == "Check");
        var options = view.GetLogicalDescendants().OfType<RadioButton>().ToList();
        options[1].IsChecked = true;
        Assert.False(view.IsSolved);
        Assert.True(view.Grade());
        Assert.All(options, o => Assert.False(o.IsEnabled));

        var wrong = View("predict", "$ echo hej\nhej", exam: true);
        Assert.False(wrong.Grade());
        w.Close();
    });
}
