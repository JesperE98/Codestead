using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Platform;
using Avalonia.Threading;
using SkiaSharp;

namespace Codestead.UI.Controls;

/// <summary>
/// A picture in a text: a still image (PNG, JPEG, WebP) or an animation (animated GIF or WebP), decoded with Skia and
/// played in a loop. A click pauses and resumes the animation. The picture is never wider than its natural size.
/// </summary>
public sealed class AnimatedImage : Border
{
    private readonly Image image = new() { Stretch = Stretch.Uniform };
    private readonly List<(Bitmap Frame, TimeSpan Duration)> frames = [];
    private DispatcherTimer? timer;
    private int current;
    private bool paused;

    public AnimatedImage(byte[] bytes, string? hint = null)
    {
        Child = image;
        HorizontalAlignment = Avalonia.Layout.HorizontalAlignment.Left;
        var decoded = Decode(bytes);
        frames.AddRange(decoded);
        if (frames.Count == 0) return;
        image.Source = frames[0].Frame;
        MaxWidth = frames[0].Frame.PixelSize.Width;
        if (frames.Count > 1)
        {
            Cursor = new Cursor(StandardCursorType.Hand);
            if (hint is { Length: > 0 }) ToolTip.SetTip(this, hint);
            PointerPressed += (_, e) =>
            {
                if (!e.GetCurrentPoint(this).Properties.IsLeftButtonPressed) return;
                e.Handled = true;
                paused = !paused;
            };
        }
    }

    /// <summary>How many frames the picture has (1 for a still image, 0 when it could not be read).</summary>
    public int FrameCount => frames.Count;

    protected override void OnAttachedToVisualTree(VisualTreeAttachmentEventArgs e)
    {
        base.OnAttachedToVisualTree(e);
        if (frames.Count < 2) return;
        timer = new DispatcherTimer { Interval = frames[current].Duration };
        timer.Tick += (_, _) =>
        {
            if (paused) return;
            current = (current + 1) % frames.Count;
            image.Source = frames[current].Frame;
            timer!.Interval = frames[current].Duration;
        };
        timer.Start();
    }

    protected override void OnDetachedFromVisualTree(VisualTreeAttachmentEventArgs e)
    {
        base.OnDetachedFromVisualTree(e);
        timer?.Stop();
        timer = null;
    }

    /// <summary>Every frame of the picture with how long it is shown; animations are composed frame by frame.</summary>
    public static List<(Bitmap Frame, TimeSpan Duration)> Decode(byte[] bytes)
    {
        var result = new List<(Bitmap, TimeSpan)>();
        using var data = SKData.CreateCopy(bytes);
        using var codec = SKCodec.Create(data);
        if (codec is null) return result;
        var info = new SKImageInfo(codec.Info.Width, codec.Info.Height, SKColorType.Bgra8888, SKAlphaType.Premul);
        var frameInfo = codec.FrameInfo;
        int count = Math.Max(1, frameInfo.Length);
        var composed = new SKBitmap[count];
        try
        {
            for (int i = 0; i < count; i++)
            {
                var bitmap = new SKBitmap(info);
                int required = frameInfo.Length > 0 ? frameInfo[i].RequiredFrame : -1;
                if (required >= 0 && composed[required] is { } prior) prior.CopyTo(bitmap);
                else bitmap.Erase(SKColors.Transparent);
                var options = new SKCodecOptions(i, required);
                var status = codec.GetPixels(info, bitmap.GetPixels(), options);
                if (status is not (SKCodecResult.Success or SKCodecResult.IncompleteInput))
                {
                    bitmap.Dispose();
                    break;
                }
                composed[i] = bitmap;
                int ms = frameInfo.Length > 0 ? frameInfo[i].Duration : 0;
                result.Add((ToAvalonia(bitmap), TimeSpan.FromMilliseconds(Math.Max(20, ms <= 0 ? 100 : ms))));
            }
        }
        finally
        {
            foreach (var b in composed) b?.Dispose();
        }
        return result;
    }

    private static Bitmap ToAvalonia(SKBitmap bitmap)
    {
        var wb = new WriteableBitmap(new PixelSize(bitmap.Width, bitmap.Height), new Vector(96, 96), PixelFormat.Bgra8888, AlphaFormat.Premul);
        using var fb = wb.Lock();
        int rowBytes = bitmap.Width * 4;
        var row = new byte[rowBytes];
        var src = bitmap.GetPixels();
        for (int y = 0; y < bitmap.Height; y++)
        {
            System.Runtime.InteropServices.Marshal.Copy(src + y * bitmap.RowBytes, row, 0, rowBytes);
            System.Runtime.InteropServices.Marshal.Copy(row, 0, fb.Address + y * fb.RowBytes, rowBytes);
        }
        return wb;
    }
}
