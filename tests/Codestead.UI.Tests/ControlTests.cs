using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Input;
using Avalonia.LogicalTree;
using Codestead.UI.Controls;

namespace Codestead.UI.Tests;

public class ControlTests
{
    /// <summary>Saves a screenshot when CODESTEAD_SCREENSHOTS points to a folder (for manual review).</summary>
    private static void Snap(Window w, string name)
    {
        var dir = Environment.GetEnvironmentVariable("CODESTEAD_SCREENSHOTS");
        if (string.IsNullOrEmpty(dir)) return;
        Directory.CreateDirectory(dir);
        w.CaptureRenderedFrame()?.Save(Path.Combine(dir, name + ".png"));
    }

    [Fact(DisplayName = "död tilde + mellanslag blir ~, andra döda tangenter lämnas i fred")]
    public void DeadTildeBecomesTilde()
    {
        // The dead key itself (swallowed by the input method), then a space that was not combined.
        Assert.Null(DeadKeys.Filter(Key.RightAlt, null, KeyModifiers.None, null));
        Assert.Null(DeadKeys.Filter(Key.None, null, KeyModifiers.None, null));
        Assert.Equal("~", DeadKeys.Filter(Key.Space, " ", KeyModifiers.None, " "));
        // An ordinary space afterwards stays a space.
        Assert.Equal(" ", DeadKeys.Filter(Key.Space, " ", KeyModifiers.None, " "));
        // A dead key the input method combined (^, ñ ...): the next space is a space.
        Assert.Null(DeadKeys.Filter(Key.None, null, KeyModifiers.None, null));
        Assert.Equal("^", DeadKeys.Filter(Key.None, null, KeyModifiers.None, "^"));
        Assert.Equal(" ", DeadKeys.Filter(Key.Space, " ", KeyModifiers.None, " "));
        // Dead key and a letter.
        Assert.Null(DeadKeys.Filter(Key.None, null, KeyModifiers.None, null));
        Assert.Equal("ñ", DeadKeys.Filter(Key.N, "n", KeyModifiers.None, "ñ"));
        Assert.Equal("a", DeadKeys.Filter(Key.A, "a", KeyModifiers.None, "a"));
    }

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

    [Fact(DisplayName = "markdown blir rubriker, stycken, listor, tabeller och klickbara kommandon")]
    public void MarkdownRenders()
        => Ui.Run(() =>
    {
        var view = new MarkdownView();
        string? clicked = null;
        view.CommandClicked += c => clicked = c;
        view.SetMarkdown("""
            # Rubrik

            Ett stycke med `kod`, **fet** och *kursiv* text och en [länk](https://example.com).

            - punkt ett
            - punkt två

            | Kommando | Gör |
            |---|---|
            | `ls` | listar |

            ```sh
            ls -l
            cd ~
            ```

            > **Tips:** ett citat.

            <div class="distro-block" data-family="debian" data-label="Debian-familjen">

            Bara för Debian.

            </div>
            """);
        var w = new Window { Width = 800, Height = 900, Content = new ScrollViewer { Content = view } };
        w.Show();
        var buttons = view.GetLogicalDescendants().OfType<Button>().Where(b => b.Classes.Contains("cmd")).ToList();
        Assert.Equal(2, buttons.Count);
        buttons[0].RaiseEvent(new Avalonia.Interactivity.RoutedEventArgs(Button.ClickEvent));
        Assert.Equal("ls -l", clicked);
        Snap(w, "markdown");
        w.Close();
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
        Snap(w, "terminal");
        w.Close();
    });
}

