using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;

namespace Codestead.UI.Controls.Game;

// The notices that slide in at the top corner.

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
