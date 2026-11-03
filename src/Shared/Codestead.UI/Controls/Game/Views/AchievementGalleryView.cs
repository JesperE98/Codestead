using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;

namespace Codestead.UI.Controls.Game;

// The gallery of all achievements.

/// <summary>All achievements: unlocked ones with their date, locked ones dimmed with progress, hidden ones as "???".</summary>
public static class AchievementGalleryView
{
    /// <summary>Show it with <c>OverlayHost.ShowDialog(..., 780, scroll: false)</c>.</summary>
    public static Control Build(GalleryTexts texts, LevelModel level, IReadOnlyList<AchievementSection> sections, Action onClose)
    {
        // Header: level, XP bar, counts.
        var header = new Grid { ColumnDefinitions = new ColumnDefinitions("Auto,*"), Margin = new Thickness(0, 0, 0, 12) };
        header.Children.Add(Parts.LevelBadge(level.Level, 52));
        var info = new StackPanel { Spacing = 4, Margin = new Thickness(14, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center };
        info.Children.Add(Parts.Text(texts.Title, 21, FontWeight.Bold, "CsText"));
        info.Children.Add(Parts.Text($"{level.Title} · {level.Tooltip}", 13, FontWeight.SemiBold, "CsReward"));
        info.Children.Add(Parts.Bar(level.Fraction, 6));
        info.Children.Add(Parts.Text($"{texts.CountText}   ·   {texts.StreakText}", 12.5, null, "CsTextMuted"));
        Grid.SetColumn(info, 1);
        header.Children.Add(info);

        var list = new StackPanel { Spacing = 8 };
        foreach (var section in sections)
        {
            var h = Parts.Text(section.Title, 15, FontWeight.Bold, "CsText");
            h.Margin = new Thickness(0, 8, 0, 0);
            list.Children.Add(h);
            var wrap = new WrapPanel();
            foreach (var card in section.Cards) wrap.Children.Add(Tile(card));
            list.Children.Add(wrap);
        }

        var close = new Button { Content = texts.Close, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 12, 0, 0) };
        close.Classes.Add("primary");
        close.Click += (_, _) => onClose();

        var layout = new DockPanel();
        DockPanel.SetDock(header, Dock.Top);
        DockPanel.SetDock(close, Dock.Bottom);
        layout.Children.Add(header);
        layout.Children.Add(close);
        layout.Children.Add(new ScrollViewer { Content = list, Padding = new Thickness(0, 0, 10, 0) });
        return layout;
    }

    private static Control Tile(AchievementCard c)
    {
        var tile = new Border { Width = 228, Margin = new Thickness(0, 0, 10, 10), Padding = new Thickness(12, 10), CornerRadius = new CornerRadius(10), BorderThickness = new Thickness(1) };
        tile.Bind(Border.BackgroundProperty, c.Unlocked ? "CsSurface" : "CsSurface2");
        tile.Bind(Border.BorderBrushProperty, c.Unlocked ? "CsRewardStrong" : "CsBorder");
        var grid = new Grid { ColumnDefinitions = new ColumnDefinitions("Auto,*") };
        var medal = Parts.Medal(c.Unlocked || !c.Hidden ? c.Icon : "❔", 40, c.Unlocked);
        medal.VerticalAlignment = VerticalAlignment.Top;
        grid.Children.Add(medal);
        var texts = new StackPanel { Spacing = 2, Margin = new Thickness(10, 0, 0, 0) };
        texts.Children.Add(Parts.Text(c.Title, 13.5, FontWeight.SemiBold, c.Unlocked ? "CsText" : "CsTextMuted"));
        texts.Children.Add(Parts.Text(c.Description, 12, null, "CsTextMuted"));
        if (c.Unlocked && c.UnlockedText is not null) texts.Children.Add(Parts.Text("✓ " + c.UnlockedText, 11.5, FontWeight.SemiBold, "CsSuccess"));
        else if (!c.Unlocked && c.Target > 0)
        {
            var bar = Parts.Bar(Math.Clamp(c.Current / (double)c.Target, 0, 1), 4, "CsAccent");
            bar.Margin = new Thickness(0, 4, 0, 0);
            texts.Children.Add(bar);
            if (c.ProgressText is not null) texts.Children.Add(Parts.Text(c.ProgressText, 11, null, "CsTextMuted"));
        }
        Grid.SetColumn(texts, 1);
        grid.Children.Add(texts);
        tile.Child = grid;
        return tile;
    }
}
