using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;

namespace Codestead.UI.Controls;

/// <summary>Texts of the "What's new" dialog, in the app's language.</summary>
/// <param name="Title">The heading, e.g. "What's new in Codestead Linux".</param>
/// <param name="Version">The heading of each version, with {version} and {date}, e.g. "Version {version} · {date}".</param>
/// <param name="Close">The button that closes the dialog.</param>
public sealed record WhatsNewTexts(string Title, string Version, string Close);

/// <summary>The content of the "What's new" dialog: one section per version, newest first, each a bullet list.</summary>
public static class WhatsNewView
{
    public static Control Build(WhatsNewTexts texts, IEnumerable<ChangelogEntry> entries, string lang, Action onClose)
    {
        var panel = new StackPanel { Spacing = 10 };
        panel.Children.Add(new TextBlock { Text = texts.Title, FontSize = 21, FontWeight = FontWeight.Bold, TextWrapping = TextWrapping.Wrap });
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
            panel.Children.Add(heading);
            var list = new MarkdownView { BaseFontSize = 14 };
            list.SetMarkdown(string.Join("\n", entry.ChangesFor(lang).Select(c => "- " + c)));
            panel.Children.Add(list);
        }
        var close = new Button { Content = texts.Close, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 8, 0, 0) };
        close.Classes.Add("primary");
        close.Click += (_, _) => onClose();
        panel.Children.Add(close);
        return panel;
    }
}
