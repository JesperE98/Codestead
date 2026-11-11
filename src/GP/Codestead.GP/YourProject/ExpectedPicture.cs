using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Platform;
using Avalonia.Threading;
using Codestead.GP.Course.Ide;
using Codestead.GP.Gpu.Raster;
using static Codestead.UI.App.UiParts;

namespace Codestead.GP.YourProject;

/// <summary>
/// What the current task's result should look like: the course's solution up to that task, drawn by the simulated GPU
/// in the background (a short wait first, so flicking through chapters draws nothing) and kept for the session.
/// Clicking it shows it larger.
/// </summary>
public sealed class ExpectedPicture : StackPanel
{
    public const int Width1 = 400;
    public const int Large = 720;

    private static readonly ConcurrentDictionary<string, Drawn> Cache = new(StringComparer.Ordinal);
    private readonly TextBlock caption = Text("", 14, FontWeight.SemiBold);
    private readonly Image image = new() { Stretch = Stretch.Uniform, MaxWidth = Width1 };
    private readonly TextBlock note = new() { FontSize = 12.5, TextWrapping = TextWrapping.Wrap, TextAlignment = TextAlignment.Center, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(12, 24) };
    private readonly Button frame = new() { Padding = new Thickness(0), BorderThickness = new Thickness(0), HorizontalAlignment = HorizontalAlignment.Left, HorizontalContentAlignment = HorizontalAlignment.Stretch };
    private readonly DispatcherTimer delay = new() { Interval = TimeSpan.FromMilliseconds(250) };
    private (string Chapter, string Api, int Task) wanted;
    private Tr t = (k, _) => k;

    /// <summary>The learner clicked the picture: show it larger (the control to show).</summary>
    public event Action<Control>? EnlargeRequested;

    public ExpectedPicture()
    {
        Spacing = 6;
        Margin = new Thickness(0, 6, 0, 0);
        var inner = new Grid { MinHeight = 120 };
        inner.Children.Add(image);
        inner.Children.Add(note);
        frame.Content = new Border { CornerRadius = new CornerRadius(6), ClipToBounds = true, Background = Brushes.Black, Child = inner };
        note.Foreground = new SolidColorBrush(Color.Parse("#9aa3b0"));
        frame.Click += (_, _) => _ = Enlarge();
        Children.Add(caption);
        Children.Add(frame);
        delay.Tick += (_, _) =>
        {
            delay.Stop();
            _ = Draw(wanted);
        };
    }

    public string Caption
    {
        get => caption.Text ?? "";
        set => caption.Text = value;
    }

    /// <summary>Shows the expected result of a task (drawn in the background unless it is already known).</summary>
    public void Show(string chapterId, string api, int taskIndex, Tr tr)
    {
        t = tr;
        ToolTip.SetTip(frame, t("expected.enlarge"));
        if (wanted == (chapterId, api, taskIndex) && image.Source is not null) return;
        wanted = (chapterId, api, taskIndex);
        if (Cache.TryGetValue(Key(wanted, Width1), out var known))
        {
            Apply(known);
            return;
        }
        image.Source = null;
        note.Text = t("expected.drawing");
        note.IsVisible = true;
        delay.Stop();
        delay.Start();
    }

    private static string Key((string Chapter, string Api, int Task) w, int width) => $"{w.Api}/{w.Chapter}/{w.Task}@{width}";

    private async Task Draw((string Chapter, string Api, int Task) w)
    {
        var drawn = await Render(w, Width1);
        if (w == wanted) Apply(drawn);
    }

    private static async Task<Drawn> Render((string Chapter, string Api, int Task) w, int width)
    {
        var key = Key(w, width);
        if (Cache.TryGetValue(key, out var known)) return known;
        var (frame, message) = await Task.Run(() =>
        {
            try
            {
                var scene = ExpectedResult.Scene(w.Chapter, w.Api, w.Task);
                if (scene is null) return ((Frame?)null, "expected.none");
                if (!scene.WindowCreated) return (null, "expected.noWindow");
                if (!scene.RenderLoop) return (null, "expected.closed");
                if (!scene.Presents) return (null, "expected.nothing");
                return (Rasterizer.Render(scene, width), "");
            }
            catch (Exception e) when (e is not OutOfMemoryException)
            {
                return (null, "expected.none");
            }
        });
        var drawn = new Drawn(frame is null ? null : ToBitmap(frame), message);
        Cache[key] = drawn;
        return drawn;
    }

    private void Apply(Drawn d)
    {
        image.Source = d.Bitmap;
        note.IsVisible = d.Bitmap is null;
        note.Text = d.Message == "" ? "" : t(d.Message);
    }

    private async Task Enlarge()
    {
        var w = wanted;
        if (w.Chapter == "") return;
        var drawn = await Render(w, Large);
        if (drawn.Bitmap is null) return;
        var panel = new StackPanel { Spacing = 8 };
        panel.Children.Add(Text(caption.Text ?? "", 15, FontWeight.SemiBold));
        panel.Children.Add(new Border { CornerRadius = new CornerRadius(6), ClipToBounds = true, Child = new Image { Source = drawn.Bitmap, Stretch = Stretch.Uniform, MaxWidth = Large } });
        EnlargeRequested?.Invoke(panel);
    }

    public static WriteableBitmap ToBitmap(Frame f)
    {
        var bmp = new WriteableBitmap(new PixelSize(f.Width, f.Height), new Vector(96, 96), PixelFormat.Bgra8888, AlphaFormat.Opaque);
        using var fb = bmp.Lock();
        for (int y = 0; y < f.Height; y++)
            Marshal.Copy(f.Pixels, y * f.Width * 4, fb.Address + y * fb.RowBytes, f.Width * 4);
        return bmp;
    }

    /// <summary>A drawn picture, or the text that says why there is none.</summary>
    private sealed record Drawn(WriteableBitmap? Bitmap, string Message);
}
