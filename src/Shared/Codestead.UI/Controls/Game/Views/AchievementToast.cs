using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;

namespace Codestead.UI.Controls.Game;

// The notice for a new achievement or level.

/// <summary>The notice for a new achievement (or a new level): medal, eyebrow, title and description.</summary>
public static class AchievementToast
{
    public static Control Build(string eyebrow, string icon, string title, string description, bool level = false)
    {
        var card = new Border { CornerRadius = new CornerRadius(10), BorderThickness = new Thickness(1), BoxShadow = BoxShadows.Parse("0 6 24 0 #33000000") };
        card.Bind(Border.BackgroundProperty, "CsSurface");
        card.Bind(Border.BorderBrushProperty, "CsBorder");
        var stripe = new Border { Width = 4, CornerRadius = new CornerRadius(10, 0, 0, 10) };
        stripe.Bind(Border.BackgroundProperty, "CsRewardStrong");
        var grid = new Grid { ColumnDefinitions = new ColumnDefinitions("Auto,Auto,*") };
        grid.Children.Add(stripe);
        Control medal = level ? Parts.LevelBadge(int.TryParse(icon, out var n) ? n : 1, 44) : Parts.Medal(icon, 44);
        medal.Margin = new Thickness(12, 12, 10, 12);
        medal.VerticalAlignment = VerticalAlignment.Center;
        Grid.SetColumn(medal, 1);
        grid.Children.Add(medal);
        var texts = new StackPanel { Spacing = 2, Margin = new Thickness(0, 10, 14, 10), VerticalAlignment = VerticalAlignment.Center };
        var eb = Parts.Text(eyebrow.ToUpperInvariant(), 10.5, FontWeight.Bold, "CsReward");
        eb.LetterSpacing = 0.7;
        texts.Children.Add(eb);
        texts.Children.Add(Parts.Text(title, 15, FontWeight.Bold, "CsText"));
        texts.Children.Add(Parts.Text(description, 12.5, null, "CsTextMuted"));
        Grid.SetColumn(texts, 2);
        grid.Children.Add(texts);
        card.Child = grid;
        return card;
    }

    /// <summary>A one-line notice (e.g. "+2 more achievements", "5 days in a row").</summary>
    public static Control Simple(string text, Action? onClick = null)
    {
        var card = new Border { CornerRadius = new CornerRadius(10), BorderThickness = new Thickness(1), Padding = new Thickness(14, 9), BoxShadow = BoxShadows.Parse("0 6 24 0 #33000000") };
        card.Bind(Border.BackgroundProperty, "CsSurface");
        card.Bind(Border.BorderBrushProperty, "CsBorder");
        card.Child = Parts.Text(text, 13, FontWeight.SemiBold, "CsText");
        if (onClick is not null)
        {
            card.Cursor = new Avalonia.Input.Cursor(Avalonia.Input.StandardCursorType.Hand);
            card.PointerPressed += (_, _) => onClick();
        }
        return card;
    }
}
