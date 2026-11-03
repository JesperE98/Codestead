using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using Codestead.Common;

namespace Codestead.UI.App;

/// <summary>The parts of the settings dialog that every app has: language, theme and the version line.</summary>
public static class SettingsSections
{
    public static TextBlock Title(string text) => UiParts.Text(text, 21, FontWeight.Bold);

    public static TextBlock Heading(string text) => UiParts.Text(text, 15, FontWeight.SemiBold);

    /// <summary>One chip per offered language; <paramref name="onPick"/> gets the chosen code.</summary>
    public static WrapPanel Languages(string current, Action<string> onPick, double minWidth = 120)
    {
        var langs = new WrapPanel();
        foreach (var l in Codestead.Common.Languages.Offered)
        {
            var b = new Button { Content = l.Name, Margin = new Thickness(0, 0, 8, 8), MinWidth = minWidth };
            b.Classes.Add("chip");
            if (l.Code == current) b.Classes.Add("active");
            var code = l.Code;
            b.Click += (_, _) => onPick(code);
            langs.Children.Add(b);
        }
        return langs;
    }

    /// <summary>System / light / dark; <paramref name="onPick"/> gets null, "light" or "dark".</summary>
    public static StackPanel Theme(string? current, string system, string light, string dark, Action<string?> onPick)
    {
        var themes = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8 };
        foreach (var (value, label) in new (string?, string)[] { (null, system), ("light", light), ("dark", dark) })
        {
            var b = new Button { Content = label };
            b.Classes.Add("chip");
            if (current == value) b.Classes.Add("active");
            var v = value;
            b.Click += (_, _) => onPick(v);
            themes.Children.Add(b);
        }
        return themes;
    }

    /// <summary>The primary close button at the end of the dialog.</summary>
    public static Button Close(string label, Action onClose)
    {
        var close = new Button { Content = label, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 8, 0, 0) };
        close.Classes.Add("primary");
        close.Click += (_, _) => onClose();
        return close;
    }

    /// <summary>"Name 1.2.3", and a "What's new" button when there is a changelog.</summary>
    public static StackPanel Version(ProductMeta product, string? whatsNewLabel = null, Action? onWhatsNew = null)
    {
        var version = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 10 };
        version.Children.Add(UiParts.Text($"{product.Name} {product.Version}", 11.5, null, "muted"));
        if (whatsNewLabel is not null && onWhatsNew is not null)
        {
            var news = new Button { Content = whatsNewLabel, Padding = new Thickness(8, 2), FontSize = 11.5 };
            news.Classes.Add("secondary");
            news.Click += (_, _) => onWhatsNew();
            version.Children.Add(news);
        }
        return version;
    }
}
