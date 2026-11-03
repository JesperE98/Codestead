using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;

namespace Codestead.UI.Controls.Game;

// Small building blocks shared by the gamification views.

/// <summary>Small building blocks shared by the gamification views.</summary>
internal static class Parts
{
    /// <summary>Colour emoji fonts (Windows, Linux, macOS); without them, emoji may be drawn as grey outlines.</summary>
    public static readonly FontFamily EmojiFont = new("Segoe UI Emoji, Noto Color Emoji, Apple Color Emoji, Twemoji Mozilla, sans-serif");

    public static TextBlock Emoji(string icon, double size) => new()
    {
        Text = icon,
        FontSize = size,
        FontFamily = EmojiFont,
        HorizontalAlignment = HorizontalAlignment.Center,
        VerticalAlignment = VerticalAlignment.Center,
        FlowDirection = FlowDirection.LeftToRight,
    };

    public static T Bind<T>(this T c, AvaloniaProperty property, string resource) where T : Control
    {
        c.Bind(property, c.GetResourceObservable(resource));
        return c;
    }

    public static TextBlock Text(string text, double size, FontWeight? weight = null, string? brush = null)
    {
        var t = new TextBlock { Text = text, FontSize = size, TextWrapping = TextWrapping.Wrap };
        if (weight is { } w) t.FontWeight = w;
        if (brush is not null) t.Bind(TextBlock.ForegroundProperty, brush);
        return t;
    }

    /// <summary>An icon (emoji) on a round, tinted medal.</summary>
    public static Border Medal(string icon, double size, bool unlocked = true, bool gold = true)
    {
        var medal = new Border
        {
            Width = size,
            Height = size,
            CornerRadius = new CornerRadius(size / 2),
            BorderThickness = new Thickness(Math.Max(2, size / 18)),
            Child = Emoji(icon, size * 0.46),
        };
        medal.Bind(Border.BackgroundProperty, unlocked ? (gold ? "CsRewardSoft" : "CsSuccessSoft") : "CsSurface2");
        medal.Bind(Border.BorderBrushProperty, unlocked ? (gold ? "CsRewardStrong" : "CsSuccess") : "CsBorder");
        if (!unlocked) medal.Opacity = 0.6;
        return medal;
    }

    /// <summary>A thin progress bar.</summary>
    public static ProgressBar Bar(double fraction, double height, string brush = "CsReward")
    {
        var bar = new ProgressBar { Minimum = 0, Maximum = 1, Value = fraction, Height = height, MinHeight = height, MinWidth = 0, CornerRadius = new CornerRadius(height / 2) };
        bar.Bind(ProgressBar.ForegroundProperty, brush);
        bar.Bind(ProgressBar.BackgroundProperty, "CsSurface2");
        return bar;
    }

    /// <summary>The round level badge with the level number.</summary>
    public static Border LevelBadge(int level, double size)
    {
        var badge = new Border
        {
            Width = size,
            Height = size,
            CornerRadius = new CornerRadius(size / 2),
            Child = new TextBlock
            {
                Text = level.ToString(System.Globalization.CultureInfo.InvariantCulture),
                FontSize = size * 0.5,
                FontWeight = FontWeight.Bold,
                Foreground = new SolidColorBrush(Color.Parse("#2b1d00")),
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
            },
        };
        badge.Bind(Border.BackgroundProperty, "CsRewardStrong");
        return badge;
    }
}
