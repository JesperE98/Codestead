using Avalonia.Controls;
using Avalonia.Threading;
using Avalonia.VisualTree;
using Codestead.UI.Controls;

namespace Codestead.UI.Tests;

/// <summary>A folded block (&lt;details data-summary="…"&gt;) hides its contents until its summary is clicked.</summary>
public class MarkdownDetailsTests
{
    [Fact(DisplayName = "ett hopfällt block visas först när man klickar på sammanfattningen")]
    public void DetailsOpenOnClick()
        => Ui.Run(() =>
    {
        var view = new MarkdownView();
        view.SetMarkdown("Före.\n\n<details data-summary=\"Visa en färdig fil\">\n\n```text\nhemlig rad\n```\n\n</details>\n\nEfter.");
        var window = new Window { Width = 600, Height = 400, Content = view };
        window.Show();
        Dispatcher.UIThread.RunJobs();
        static string Of(TextBlock t) => t.Text ?? string.Concat(t.Inlines?.OfType<Avalonia.Controls.Documents.Run>().Select(r => r.Text) ?? []);
        bool Visible(string text) => view.GetVisualDescendants().OfType<TextBlock>().Any(t => Of(t).Contains(text) && t.IsEffectivelyVisible);
        Assert.True(Visible("Före."));
        Assert.True(Visible("Efter."));
        Assert.True(Visible("Visa en färdig fil"));
        Assert.False(Visible("hemlig rad"));
        var toggle = view.GetVisualDescendants().OfType<Button>().First(b => b.GetVisualDescendants().OfType<TextBlock>().Any(t => t.Text == "Visa en färdig fil"));
        toggle.RaiseEvent(new Avalonia.Interactivity.RoutedEventArgs(Button.ClickEvent));
        Dispatcher.UIThread.RunJobs();
        Assert.True(Visible("hemlig rad"));
        window.Close();
    });
}
