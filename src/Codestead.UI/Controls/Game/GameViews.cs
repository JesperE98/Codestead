using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Layout;
using Avalonia.Media;

namespace Codestead.UI.Controls.Game;

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

/// <summary>Notices that slide in at the top corner (achievements, level up). At most three at once.</summary>
public sealed class NoticeLayer : StackPanel
{
    public const int MaxVisible = 3;
    private int hidden;
    private Control? moreNotice;

    /// <summary>Called with the number of notices that did not fit ("+N more").</summary>
    public Func<int, string>? MoreText { get; set; }
    public Action? MoreClicked { get; set; }

    public NoticeLayer()
    {
        Spacing = 10;
        Margin = new Thickness(0, 64, 18, 0);
        HorizontalAlignment = HorizontalAlignment.Right;
        VerticalAlignment = VerticalAlignment.Top;
        Width = 340;
    }

    public void Show(Control notice, double seconds = 5, Action? onClick = null)
    {
        if (Children.Count(c => c != moreNotice) >= MaxVisible)
        {
            hidden++;
            if (MoreText is not null)
            {
                if (moreNotice is not null) Children.Remove(moreNotice);
                moreNotice = AchievementToast.Simple(MoreText(hidden), MoreClicked);
                Children.Add(moreNotice);
            }
            return;
        }
        if (onClick is not null)
        {
            notice.Cursor = new Avalonia.Input.Cursor(Avalonia.Input.StandardCursorType.Hand);
            notice.PointerPressed += (_, _) => onClick();
        }
        Children.Insert(moreNotice is null ? Children.Count : Children.IndexOf(moreNotice), notice);
        Motion.FadeSlideIn(notice, -14);
        Avalonia.Threading.DispatcherTimer.RunOnce(() => Motion.FadeOut(notice, () =>
        {
            Children.Remove(notice);
            if (Children.Count == 1 && moreNotice is not null)
            {
                Children.Remove(moreNotice);
                moreNotice = null;
                hidden = 0;
            }
        }), TimeSpan.FromSeconds(seconds));
    }
}

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
