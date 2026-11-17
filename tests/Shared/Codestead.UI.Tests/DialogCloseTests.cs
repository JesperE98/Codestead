using System.Text.RegularExpressions;
using Avalonia.Controls;
using Avalonia.Headless;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Threading;
using Avalonia.VisualTree;
using Codestead.UI.Controls;

namespace Codestead.UI.Tests;

/// <summary>Every dialog can be closed: with Escape (also when nothing in it can take the focus) and with its ✕.</summary>
public class DialogCloseTests
{
    private static (Window Window, OverlayHost Overlay) Open()
    {
        var overlay = new OverlayHost(new TextBlock { Text = "content" });
        var window = new Window { Width = 800, Height = 600, Content = overlay };
        window.Show();
        // A dialog with nothing focusable in it, like the enlarged picture of an expected result.
        overlay.ShowDialog(new Border { Width = 300, Height = 200 }, overlay.CloseDialog);
        Dispatcher.UIThread.RunJobs();
        return (window, overlay);
    }

    [Fact(DisplayName = "Escape stänger en dialog utan knappar")]
    public void EscapeCloses()
        => Ui.Run(() =>
    {
        var (window, overlay) = Open();
        Assert.True(overlay.DialogOpen);
        window.KeyPress(Key.Escape, RawInputModifiers.None, PhysicalKey.Escape, null);
        Dispatcher.UIThread.RunJobs();
        Assert.False(overlay.DialogOpen);
        window.Close();
    });

    [Fact(DisplayName = "✕ i hörnet stänger varje dialog")]
    public void CloseButtonCloses()
        => Ui.Run(() =>
    {
        var (window, overlay) = Open();
        var close = overlay.GetVisualDescendants().OfType<Button>().Single(b => b.Classes.Contains("dialog-close"));
        close.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));
        Dispatcher.UIThread.RunJobs();
        Assert.False(overlay.DialogOpen);
        window.Close();
    });

    [Fact(DisplayName = "ingen dialog öppnas med en stängning som inte gör något")]
    public void NoDialogHasAnEmptyClose()
    {
        var root = CodeLayoutTests.RepoRoot();
        var empty = Directory.GetFiles(Path.Combine(root, "src"), "*.cs", SearchOption.AllDirectories)
            .Where(f => Regex.IsMatch(File.ReadAllText(f), @"ShowDialog\([^;]*\(\)\s*=>\s*\{\s*\}"))
            .Select(f => Path.GetRelativePath(root, f)).ToList();
        Assert.Empty(empty);
    }
}
