using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;

namespace Codestead.UI.Controls;

/// <summary>The content of the "What's new" dialog: one section per version, newest first, each a bullet list.</summary>
public static class WhatsNewView
{
    /// <summary>
    /// The dialog's content. The list of versions scrolls, while the heading and the close button stay in view;
    /// show it with <c>OverlayHost.ShowDialog(..., scroll: false)</c>.
    /// </summary>
    public static Control Build(WhatsNewTexts texts, IEnumerable<ChangelogEntry> entries, string lang, Action onClose)
    {
        var list = new StackPanel { Spacing = 10 };
        foreach (var entry in entries)
        {
            var heading = new TextBlock
            {
                Text = texts.Version.Replace("{version}", entry.Version, StringComparison.Ordinal).Replace("{date}", entry.Date, StringComparison.Ordinal),
                FontSize = 14,
                FontWeight = FontWeight.SemiBold,
                Margin = new Thickness(0, 6, 0, 0),
            };
            heading.Bind(TextBlock.ForegroundProperty, heading.GetResourceObservable("CsAccent"));
            list.Children.Add(heading);
            var changes = new MarkdownView { BaseFontSize = 14 };
            changes.SetMarkdown(string.Join("\n", entry.ChangesFor(lang).Select(c => "- " + c)));
            list.Children.Add(changes);
        }

        var title = new TextBlock { Text = texts.Title, FontSize = 21, FontWeight = FontWeight.Bold, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 4) };
        var close = new Button { Content = texts.Close, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 12, 0, 0) };
        close.Classes.Add("primary");
        close.Click += (_, _) => onClose();

        var layout = new DockPanel();
        DockPanel.SetDock(title, Dock.Top);
        DockPanel.SetDock(close, Dock.Bottom);
        layout.Children.Add(title);
        layout.Children.Add(close);
        layout.Children.Add(new ScrollViewer { Content = list, Padding = new Thickness(0, 0, 8, 0) });
        return layout;
    }
}
