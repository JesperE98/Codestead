using Avalonia;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Input;
using Avalonia.LogicalTree;
using Avalonia.Threading;
using Avalonia.VisualTree;
using Codestead.UI.Controls;

namespace Codestead.UI.Tests;

/// <summary>A link in rendered markdown opens on a real mouse click: in a paragraph, a list, a table and bold text.</summary>
public class MarkdownLinkTests
{
    [Theory(DisplayName = "en länk i markdown öppnas när man klickar på den")]
    [InlineData("Ett stycke med en [länk](https://example.com/a) i.", "https://example.com/a")]
    [InlineData("- en punkt med [länk](https://example.com/b)", "https://example.com/b")]
    [InlineData("| A | B |\n|---|---|\n| [länk](https://example.com/c) | x |", "https://example.com/c")]
    [InlineData("**Fet** text ([länk](https://example.com/d)) efter.", "https://example.com/d")]
    public void LinkOpensOnClick(string markdown, string url)
        => Ui.Run(() =>
    {
        var view = new MarkdownView();
        string? clicked = null;
        view.LinkClicked += u => clicked = u;
        view.SetMarkdown(markdown);
        var window = new Window { Width = 800, Height = 400, Content = view };
        window.Show();
        Dispatcher.UIThread.RunJobs();
        var link = view.GetVisualDescendants().OfType<TextBlock>().First(t => ToolTip.GetTip(t) as string == url);
        var centre = link.TranslatePoint(new Point(link.Bounds.Width / 2, link.Bounds.Height / 2), window)!.Value;
        window.MouseDown(centre, MouseButton.Left);
        window.MouseUp(centre, MouseButton.Left);
        Dispatcher.UIThread.RunJobs();
        window.Close();
        Assert.Equal(url, clicked);
    });

    [Fact(DisplayName = "en länk utan lyssnare öppnas av vyn själv (uppgifter, tips, frågor) utan att krascha")]
    public void LinkWithoutListenerDoesNotThrow()
        => Ui.Run(() =>
    {
        var view = new MarkdownView();
        view.SetMarkdown("En [länk](https://example.com/e) i en uppgift.");
        var window = new Window { Width = 600, Height = 200, Content = view };
        window.Show();
        Dispatcher.UIThread.RunJobs();
        var link = view.GetVisualDescendants().OfType<TextBlock>().First(t => ToolTip.GetTip(t) as string == "https://example.com/e");
        var centre = link.TranslatePoint(new Point(link.Bounds.Width / 2, link.Bounds.Height / 2), window)!.Value;
        window.MouseDown(centre, MouseButton.Left);
        window.MouseUp(centre, MouseButton.Left);
        Dispatcher.UIThread.RunJobs();
        window.Close();
    });
}
