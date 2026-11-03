using Avalonia;
using Avalonia.Animation;
using Avalonia.Animation.Easings;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Media;
using Avalonia.Media.Transformation;
using Avalonia.Threading;

namespace Codestead.UI.Controls.Game;

/// <summary>
/// Short, calm animations (180–350 ms). Things only move up and down, never sideways, so right-to-left
/// languages need nothing special. <see cref="Enabled"/> = false shows the end state at once (tests, screenshots).
/// </summary>
public static class Motion
{
    public static bool Enabled { get; set; } = true;

    private static void After(int delayMs, Action action)
    {
        if (delayMs <= 0) Dispatcher.UIThread.Post(action, DispatcherPriority.Background);
        else DispatcherTimer.RunOnce(action, TimeSpan.FromMilliseconds(delayMs));
    }

    /// <summary>Fades in while sliding <paramref name="dy"/> pixels into place.</summary>
    public static void FadeSlideIn(Control c, double dy = 12, int delayMs = 0, int durationMs = 260)
    {
        if (!Enabled) return;
        c.Opacity = 0;
        c.RenderTransform = TransformOperations.Parse($"translate(0px, {dy.ToString(System.Globalization.CultureInfo.InvariantCulture)}px)");
        c.Transitions = new Transitions
        {
            new DoubleTransition { Property = Visual.OpacityProperty, Duration = TimeSpan.FromMilliseconds(durationMs), Easing = new CubicEaseOut() },
            new TransformOperationsTransition { Property = Visual.RenderTransformProperty, Duration = TimeSpan.FromMilliseconds(durationMs), Easing = new CubicEaseOut() },
        };
        After(delayMs, () =>
        {
            c.Opacity = 1;
            c.RenderTransform = TransformOperations.Parse("translate(0px, 0px)");
        });
    }

    /// <summary>Fades out and then calls <paramref name="done"/>.</summary>
    public static void FadeOut(Control c, Action done, int durationMs = 220)
    {
        if (!Enabled)
        {
            done();
            return;
        }
        c.Transitions ??= new Transitions();
        c.Transitions.Add(new DoubleTransition { Property = Visual.OpacityProperty, Duration = TimeSpan.FromMilliseconds(durationMs) });
        c.Opacity = 0;
        DispatcherTimer.RunOnce(done, TimeSpan.FromMilliseconds(durationMs));
    }

    /// <summary>Grows from small to full size with a slight overshoot – for a check mark or a medal.</summary>
    public static void Pop(Control c, int delayMs = 0)
    {
        if (!Enabled) return;
        c.RenderTransformOrigin = RelativePoint.Center;
        c.RenderTransform = TransformOperations.Parse("scale(0.5)");
        c.Transitions = new Transitions
        {
            new TransformOperationsTransition { Property = Visual.RenderTransformProperty, Duration = TimeSpan.FromMilliseconds(350), Easing = new BackEaseOut() },
        };
        After(delayMs, () => c.RenderTransform = TransformOperations.Parse("scale(1)"));
    }

    /// <summary>Moves a bar's value from <paramref name="from"/> to <paramref name="to"/>.</summary>
    public static void AnimateValue(RangeBase bar, double from, double to, int delayMs = 150)
    {
        if (!Enabled)
        {
            bar.Value = to;
            return;
        }
        bar.Value = from;
        bar.Transitions = new Transitions
        {
            new DoubleTransition { Property = RangeBase.ValueProperty, Duration = TimeSpan.FromMilliseconds(700), Easing = new CubicEaseInOut() },
        };
        After(delayMs, () => bar.Value = to);
    }
}
