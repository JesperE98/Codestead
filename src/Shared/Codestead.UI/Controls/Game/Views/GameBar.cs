using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;

namespace Codestead.UI.Controls.Game;

// The top-bar widget: streak, level and XP bar.

/// <summary>
/// The top-bar widget: the day streak (🔥), the level badge with its title and a thin XP bar.
/// Click opens the achievements (<see cref="Clicked"/>).
/// </summary>
public sealed class GameBar : UserControl
{
    private readonly Button button = new() { Padding = new Thickness(8, 3), Cursor = new Avalonia.Input.Cursor(Avalonia.Input.StandardCursorType.Hand) };
    private readonly Canvas gains = new() { IsHitTestVisible = false };
    private bool compact;

    public event Action? Clicked;

    public GameBar()
    {
        button.Classes.Add("flat");
        button.Click += (_, _) => Clicked?.Invoke();
        var host = new Grid();
        host.Children.Add(button);
        host.Children.Add(gains);
        Content = host;
    }

    /// <summary>Hides the level title on narrow windows (the badge and the bar stay).</summary>
    public bool Compact
    {
        get => compact;
        set
        {
            compact = value;
            if (lastLevel is not null && lastStreak is not null) Update(lastLevel, lastStreak);
        }
    }

    private LevelModel? lastLevel;
    private StreakModel? lastStreak;

    public void Update(LevelModel level, StreakModel streak)
    {
        lastLevel = level;
        lastStreak = streak;
        var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 10, VerticalAlignment = VerticalAlignment.Center };
        if (streak.Days > 0)
        {
            var flame = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 3, VerticalAlignment = VerticalAlignment.Center };
            var fire = Parts.Emoji("🔥", 15);
            fire.Opacity = streak.Today ? 1 : 0.45;
            flame.Children.Add(fire);
            flame.Children.Add(Parts.Text(streak.Days.ToString(System.Globalization.CultureInfo.InvariantCulture), 13.5, FontWeight.Bold, streak.Today ? "CsReward" : "CsTextMuted"));
            ToolTip.SetTip(flame, streak.Tooltip);
            row.Children.Add(flame);
        }
        var chip = new Border { CornerRadius = new CornerRadius(14), Padding = new Thickness(4, 3, compact ? 6 : 10, 3) };
        chip.Bind(Border.BackgroundProperty, "CsRewardSoft");
        var inner = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 7 };
        inner.Children.Add(Parts.LevelBadge(level.Level, 22));
        var texts = new StackPanel { Spacing = 3, VerticalAlignment = VerticalAlignment.Center, Width = compact ? 46 : double.NaN, MinWidth = 90 };
        if (!compact) texts.Children.Add(Parts.Text(level.Title, 12, FontWeight.SemiBold, "CsText"));
        texts.Children.Add(Parts.Bar(level.Fraction, 3));
        inner.Children.Add(texts);
        chip.Child = inner;
        ToolTip.SetTip(chip, level.Tooltip);
        row.Children.Add(chip);
        button.Content = row;
    }

    /// <summary>A short "+15 XP" that rises above the widget and fades away.</summary>
    public void ShowGain(string text)
    {
        var label = Parts.Text(text, 12.5, FontWeight.Bold, "CsReward");
        Canvas.SetRight(label, 6);
        Canvas.SetTop(label, -2);
        gains.Children.Add(label);
        if (!Motion.Enabled)
        {
            gains.Children.Remove(label);
            return;
        }
        Motion.FadeSlideIn(label, 10);
        Avalonia.Threading.DispatcherTimer.RunOnce(() => Motion.FadeOut(label, () => gains.Children.Remove(label)), TimeSpan.FromMilliseconds(1300));
    }
}
