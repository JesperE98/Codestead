using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;

namespace Codestead.UI.Controls.Game;

// A tool's progress in one row (the hub's tool cards).

/// <summary>A tool's progress in one row (the hub's tool cards): level, XP bar, streak and achievements.</summary>
public static class ProfileRow
{
    public static Control Build(ProfileModel m, Action onOpen)
    {
        var box = new Border { CornerRadius = new CornerRadius(10), Padding = new Thickness(12, 8), Margin = new Thickness(0, 6, 0, 0) };
        box.Bind(Border.BackgroundProperty, "CsRewardSoft");
        var grid = new Grid { ColumnDefinitions = new ColumnDefinitions("Auto,*,Auto,Auto,Auto") };
        grid.Children.Add(Parts.LevelBadge(m.Level.Level, 30));
        var level = new StackPanel { Spacing = 3, Margin = new Thickness(10, 0, 16, 0), VerticalAlignment = VerticalAlignment.Center };
        level.Children.Add(Parts.Text($"{m.Level.Title} · {m.Level.Tooltip}", 13, FontWeight.SemiBold, "CsText"));
        level.Children.Add(Parts.Bar(m.Level.Fraction, 4));
        Grid.SetColumn(level, 1);
        grid.Children.Add(level);
        if (m.Streak.Days > 0)
        {
            var streak = Parts.Text($"🔥 {m.Streak.Days}", 13.5, FontWeight.Bold, m.Streak.Today ? "CsReward" : "CsTextMuted");
            streak.VerticalAlignment = VerticalAlignment.Center;
            streak.Margin = new Thickness(0, 0, 14, 0);
            ToolTip.SetTip(streak, m.Streak.Tooltip);
            Grid.SetColumn(streak, 2);
            grid.Children.Add(streak);
        }
        var trophies = Parts.Text($"🏆 {m.AchievementsText}", 13.5, FontWeight.Bold, "CsText");
        trophies.VerticalAlignment = VerticalAlignment.Center;
        trophies.Margin = new Thickness(0, 0, 12, 0);
        Grid.SetColumn(trophies, 3);
        grid.Children.Add(trophies);
        var open = new Button { Content = m.OpenText, VerticalAlignment = VerticalAlignment.Center };
        open.Classes.Add("secondary");
        open.Click += (_, _) => onOpen();
        Grid.SetColumn(open, 4);
        grid.Children.Add(open);
        box.Child = grid;
        return box;
    }
}
