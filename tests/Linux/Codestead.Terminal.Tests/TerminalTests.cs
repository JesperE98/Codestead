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
    {
        var sandbox = new ShellSandbox("ubuntu", "en");
        Assert.Equal("5", sandbox.OutputOf("echo $((2 + 3))").Trim());
        Assert.Equal("", sandbox.OutputOf("touch spår.txt").Trim());
        // The next command runs on a new computer that does not have the file.
        Assert.Contains("No such file", sandbox.OutputOf("ls spår.txt"));
    }

    [Fact(DisplayName = "en try-fråga löses av ett kommando i den riktiga simulerade terminalen")]
    public void TryWithTheSimulator()
        => Ui.Run(() =>
    {
        var texts = new CheckpointTexts("Check", "Correct", "Wrong", "Predict", "Try", "Done", "Answer", "Question");
        var view = new CheckpointView(Checkpoint.Parse("try", "pwd", 0), texts, false, new ShellSandbox("ubuntu", "en"));
        var sh = Codestead.Shell.Shell.Create("ubuntu", "en");
        var term = new TerminalView { Shell = sh };
        term.CommandExecuted += r => view.CommandRan(new SandboxRun(r.Line, Codestead.Shell.Commands.UtilCmd.StripAnsi(r.Output), r.ExitCode, !r.Pending && !r.Incomplete));
        var w = new Window { Content = term };
        w.Show();
        var input = term.GetLogicalDescendants().OfType<TextBox>().First();
        // Another command with the same output counts too.
        input.Text = "echo $PWD";
        input.RaiseEvent(new KeyEventArgs { RoutedEvent = InputElement.KeyDownEvent, Key = Key.Enter });
        Assert.True(view.IsSolved);
        w.Close();
    });
}
