using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.LogicalTree;
using Codestead.UI.Controls;
using Codestead.UI.Learning;
using Codestead.UI.Tests;

namespace Codestead.Terminal.Tests;

public class TerminalTests
{
    [Fact(DisplayName = "ANSI-färger delas upp i segment")]
    public void AnsiSegments()
        => Ui.Run(() =>
    {
        var segs = Ansi.Parse("a\x1b[1;32mgrön\x1b[0m b");
        Assert.Equal(3, segs.Count);
        Assert.Equal("grön", segs[1].Text);
        Assert.Equal(32, segs[1].Fg);
        Assert.True(segs[1].Bold);
        Assert.Equal(0, segs[2].Fg);
    });


    [Fact(DisplayName = "terminalen kör kommandon och visar prompten")]
    public void TerminalRuns()
        => Ui.Run(() =>
    {
        var sh = Codestead.Shell.Shell.Create("ubuntu");
        var term = new TerminalView { Shell = sh };
        Codestead.Shell.ExecResult? last = null;
        term.CommandExecuted += r => last = r;
        var w = new Window { Width = 700, Height = 400, Content = term };
        w.Show();
        // Assignments are handled by the shell core itself (no command module needed).
        term.Inject("X=hej");
        var input = term.GetLogicalDescendants().OfType<TextBox>().First();
        Assert.Equal("X=hej", input.Text);
        input.RaiseEvent(new KeyEventArgs { RoutedEvent = InputElement.KeyDownEvent, Key = Key.Enter });
        Assert.NotNull(last);
        Assert.Equal("hej", sh.Env["X"]);
        Assert.Equal("", input.Text);
        w.Close();
    });

    [Fact(DisplayName = "sandlådan för kontrollfrågor är en ny dator varje gång")]
    public void SandboxIsFresh()
        => Ui.Run(() =>
    {
        var sandbox = new ShellSandbox("ubuntu", "en");
        Assert.Equal("5", sandbox.OutputOf("echo $((2 + 3))").Trim());
        var terminal = sandbox.NewTerminal();
        var w = new Window { Content = terminal.View };
        w.Show();
        SandboxRun? run = null;
        terminal.Ran += r => run = r;
        var input = terminal.View.GetLogicalDescendants().OfType<TextBox>().First();
        input.Text = "touch spår.txt";
        input.RaiseEvent(new KeyEventArgs { RoutedEvent = InputElement.KeyDownEvent, Key = Key.Enter });
        Assert.True(run is { Finished: true, ExitCode: 0 });
        // A new terminal does not see the file of the first one.
        Assert.Contains("No such file", sandbox.OutputOf("ls spår.txt"));
        w.Close();
    });

    [Fact(DisplayName = "en try-fråga löses i en riktig simulerad terminal")]
    public void TryWithTheSimulator()
        => Ui.Run(() =>
    {
        var texts = new CheckpointTexts("Check", "Correct", "Wrong", "Predict", "Try", "Done", "Answer", "Question");
        var view = new CheckpointView(Checkpoint.Parse("try", "pwd", 0), texts, false, new ShellSandbox("ubuntu", "en"));
        var w = new Window { Content = view };
        w.Show();
        var input = view.GetLogicalDescendants().OfType<TerminalView>().First().GetLogicalDescendants().OfType<TextBox>().First();
        input.Text = "echo $PWD";
        input.RaiseEvent(new KeyEventArgs { RoutedEvent = InputElement.KeyDownEvent, Key = Key.Enter });
        Assert.True(view.IsSolved);
        w.Close();
    });
}
