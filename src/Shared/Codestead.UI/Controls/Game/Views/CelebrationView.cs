using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;

namespace Codestead.UI.Controls.Game;

/// <summary>The dialog shown when a chapter, a whole part or an exam is done.</summary>
public static class CelebrationView
{
    /// <summary>Show it with <c>OverlayHost.ShowDialog(..., 540, scroll: false)</c>.</summary>
    public static Control Build(CelebrationModel m, Action onClose, Action? onNext)
    {
        var body = new StackPanel { Spacing = 14 };

        // The medal and the heading.
        var medal = Parts.Medal(m.Icon, m.Big ? 92 : 72, true, gold: m.Big);
        medal.HorizontalAlignment = HorizontalAlignment.Center;
        body.Children.Add(medal);
        Motion.Pop(medal, 80);
        var title = Parts.Text(m.Title, m.Big ? 26 : 22, FontWeight.Bold, "CsText");
        title.TextAlignment = TextAlignment.Center;
        body.Children.Add(title);
        if (m.Subtitle is not null)
        {
            var sub = Parts.Text(m.Subtitle, 14, null, "CsTextMuted");
            sub.TextAlignment = TextAlignment.Center;
            sub.Margin = new Thickness(0, -8, 0, 0);
            body.Children.Add(sub);
        }

        // XP and level.
        var xp = new Border { CornerRadius = new CornerRadius(10), Padding = new Thickness(14, 10) };
        xp.Bind(Border.BackgroundProperty, "CsRewardSoft");
        var xpRow = new Grid { ColumnDefinitions = new ColumnDefinitions("Auto,*,Auto"), RowDefinitions = new RowDefinitions("Auto,Auto") };
        var badge = Parts.LevelBadge(m.Level.Level, 30);
        Grid.SetRowSpan(badge, 2);
        xpRow.Children.Add(badge);
        var levelTitle = Parts.Text(m.Level.Title, 14, FontWeight.SemiBold, "CsText");
        levelTitle.Margin = new Thickness(10, 0, 10, 0);
        Grid.SetColumn(levelTitle, 1);
        xpRow.Children.Add(levelTitle);
        var gain = Parts.Text(m.XpText, 15, FontWeight.Bold, "CsReward");
        Grid.SetColumn(gain, 2);
        xpRow.Children.Add(gain);
        var bar = Parts.Bar(m.LevelBefore.Level == m.Level.Level ? m.LevelBefore.Fraction : 0, 6);
        bar.Margin = new Thickness(10, 6, 0, 0);
        Grid.SetRow(bar, 1);
        Grid.SetColumn(bar, 1);
        Grid.SetColumnSpan(bar, 2);
        xpRow.Children.Add(bar);
        Motion.AnimateValue(bar, bar.Value, m.Level.Fraction, 250);
        var xpBox = new StackPanel { Spacing = 6 };
        xpBox.Children.Add(xpRow);
        if (m.LevelUpText is not null) xpBox.Children.Add(Parts.Text("⬆ " + m.LevelUpText, 13.5, FontWeight.Bold, "CsReward"));
        xp.Child = xpBox;
        body.Children.Add(xp);

        // The commands practised.
        if (m.Commands.Count > 0 && m.CommandsHeading is not null)
        {
            body.Children.Add(Parts.Text(m.CommandsHeading, 13, FontWeight.SemiBold, "CsTextMuted"));
            var chips = new WrapPanel { FlowDirection = FlowDirection.LeftToRight, Margin = new Thickness(0, -8, 0, 0) };
            foreach (var c in m.Commands)
            {
                var chip = new Border { CornerRadius = new CornerRadius(6), Padding = new Thickness(8, 3), Margin = new Thickness(0, 0, 6, 6) };
                chip.Bind(Border.BackgroundProperty, "CsInlineCodeBg");
                var t = Parts.Text(c, 13, FontWeight.SemiBold, "CsCodeText");
                t.FontFamily = new FontFamily("Cascadia Mono, DejaVu Sans Mono, Liberation Mono, monospace");
                chip.Child = t;
                chips.Children.Add(chip);
            }
            body.Children.Add(chips);
        }
        if (m.TimeText is not null) body.Children.Add(Parts.Text("⏱ " + m.TimeText, 13, null, "CsTextMuted"));

        // New achievements.
        if (m.Achievements.Count > 0 && m.AchievementsHeading is not null)
        {
            body.Children.Add(Parts.Text(m.AchievementsHeading, 13, FontWeight.SemiBold, "CsTextMuted"));
            int i = 0;
            foreach (var a in m.Achievements)
            {
                var row = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 10, Margin = new Thickness(0, -6, 0, 0) };
                row.Children.Add(Parts.Medal(a.Icon, 34));
                var texts = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
                texts.Children.Add(Parts.Text(a.Title, 14, FontWeight.SemiBold, "CsText"));
                texts.Children.Add(Parts.Text(a.Description, 12.5, null, "CsTextMuted"));
                row.Children.Add(texts);
                body.Children.Add(row);
                Motion.FadeSlideIn(row, 10, 400 + 90 * i++);
            }
        }

        // Buttons stay in view; the rest scrolls if needed.
        var buttons = new StackPanel { Orientation = Orientation.Horizontal, Spacing = 8, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 16, 0, 0) };
        var close = new Button { Content = m.CloseText };
        close.Classes.Add(onNext is not null && m.NextText is not null ? "secondary" : "primary");
        close.Click += (_, _) => onClose();
        buttons.Children.Add(close);
        if (onNext is not null && m.NextText is not null)
        {
            var next = new Button { Content = m.NextText };
            next.Classes.Add("primary");
            next.Click += (_, _) => onNext();
            buttons.Children.Add(next);
        }
        var layout = new DockPanel();
        DockPanel.SetDock(buttons, Dock.Bottom);
        layout.Children.Add(buttons);
        layout.Children.Add(new ScrollViewer { Content = body });
        return layout;
    }
}
