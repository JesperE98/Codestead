using System.Runtime.InteropServices;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Layout;
using Avalonia.Media;
using Avalonia.Media.Imaging;
using Avalonia.Platform;
using Avalonia.Threading;
using Codestead.GP.Gpu;
using Codestead.GP.Gpu.Build;
using Codestead.GP.Gpu.Raster;
using Codestead.GP.Gpu.Scene;

namespace Codestead.GP.Workbench;

// The bottom of the workbench: the build output (commands, compiler messages, what the run did) and the preview
// of the window, animated when the frame changes over time.
public sealed partial class ProjectView
{
    private static readonly IBrush ErrorBrush = new SolidColorBrush(Color.Parse("#ff7b72"));
    private static readonly IBrush WarningBrush = new SolidColorBrush(Color.Parse("#e3b341"));
    private static readonly IBrush OkBrush = new SolidColorBrush(Color.Parse("#7ee787"));

    private readonly StackPanel output = new() { Spacing = 2, Margin = new Thickness(12, 8) };
    private readonly ScrollViewer outputScroll = new();
    private readonly TextBlock previewTitle = new() { Foreground = Dim, FontSize = 11.5, VerticalAlignment = VerticalAlignment.Center, TextTrimming = TextTrimming.CharacterEllipsis };
    private readonly Image previewImage = new() { Stretch = Stretch.Uniform };
    private readonly TextBlock previewText = new() { Foreground = Dim, FontSize = 12, TextWrapping = TextWrapping.Wrap, TextAlignment = TextAlignment.Center, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(10) };
    private readonly Button previewButton = new() { Padding = new Thickness(0), Background = Brushes.Transparent, BorderThickness = new Thickness(0), HorizontalContentAlignment = HorizontalAlignment.Stretch, VerticalContentAlignment = VerticalAlignment.Stretch };
    private readonly DispatcherTimer animation = new() { Interval = TimeSpan.FromMilliseconds(100) };
    private Scene? scene;
    private ApiInfo? openApi;
    private BuildResult? result;
    private double time = 1.0;
    private const int PreviewWidth = 240;

    /// <summary>The learner clicked the preview: show it bigger.</summary>
    public event Action<Control>? EnlargeRequested;

    private Control BuildBottom()
    {
        outputScroll.Content = output;
        var previewInner = new Grid();
        previewInner.Children.Add(previewImage);
        previewInner.Children.Add(previewText);
        var previewBar = new Border { Background = new SolidColorBrush(Color.Parse("#2b323c")), Padding = new Thickness(8, 3), Child = previewTitle };
        var previewDock = new DockPanel();
        DockPanel.SetDock(previewBar, Dock.Top);
        previewDock.Children.Add(previewBar);
        previewDock.Children.Add(new Border { Background = Brushes.Black, Child = previewInner });
        previewButton.Content = new Border { CornerRadius = new CornerRadius(6), ClipToBounds = true, BorderThickness = new Thickness(1), BorderBrush = new SolidColorBrush(Color.Parse("#3d444d")), Child = previewDock };
        previewButton.Click += (_, _) => Enlarge();
        animation.Tick += (_, _) =>
        {
            if (scene is null || !IsEffectivelyVisible)
            {
                animation.Stop();
                return;
            }
            time += animation.Interval.TotalSeconds;
            Draw();
        };

        var grid = new Grid { ColumnDefinitions = new ColumnDefinitions("*,Auto") };
        grid.Children.Add(outputScroll);
        var previewHost = new Border { Width = PreviewWidth, Margin = new Thickness(0, 8, 10, 8), Child = previewButton };
        Grid.SetColumn(previewHost, 1);
        grid.Children.Add(previewHost);
        return new Border { Background = Dark, Child = grid };
    }

    private void Enlarge()
    {
        if (scene is null || !scene.ShowsFrames) return;
        var big = Rasterizer.Render(scene, 640, time);
        var image = new Image { Source = ToBitmap(big), Stretch = Stretch.Uniform, MaxWidth = 640 };
        var title = new TextBlock { Text = WindowTitle(), FontWeight = FontWeight.SemiBold, Margin = new Thickness(0, 0, 0, 8) };
        var panel = new StackPanel();
        panel.Children.Add(title);
        panel.Children.Add(new Border { CornerRadius = new CornerRadius(6), ClipToBounds = true, Child = image });
        EnlargeRequested?.Invoke(panel);
    }

    private string WindowTitle() => scene is null ? "" : $"{(scene.WindowTitle == "" ? "—" : scene.WindowTitle)}  ·  {scene.Width}×{scene.Height}";

    private void ClearResult(ApiInfo api)
    {
        openApi = api;
        animation.Stop();
        scene = null;
        result = null;
        output.Children.Clear();
        output.Children.Add(Line(t("project.ready", ("api", api.FullName)), Dim));
        previewImage.Source = null;
        previewTitle.Text = t("project.previewTitle");
        previewText.Text = t("project.previewEmpty");
        previewText.IsVisible = true;
    }

    private void ApplyOutputTexts()
    {
        if (result is not null) ShowResult(result, t, "");
        else if (openApi is not null) ClearResult(openApi);
    }

    private static SelectableTextBlock Line(string text, IBrush brush, bool mono = true) => new()
    {
        Text = text,
        Foreground = brush,
        FontFamily = mono ? Mono : FontFamily.Default,
        FontSize = 12.5,
        TextWrapping = TextWrapping.Wrap,
    };

    /// <summary>Shows what "Build &amp; run" gave: the output and the preview.</summary>
    public void ShowResult(BuildResult r, Tr tr, string lang)
    {
        t = tr;
        result = r;
        output.Children.Clear();
        foreach (var cmd in r.Commands.Take(r.Commands.Count - 1)) output.Children.Add(Line(cmd, Dim));
        foreach (var d in r.Diagnostics)
        {
            var link = new Button
            {
                Content = new TextBlock { Text = d.ToString(), FontFamily = Mono, FontSize = 12.5, TextWrapping = TextWrapping.Wrap, Foreground = d.IsError ? ErrorBrush : WarningBrush },
                Background = Brushes.Transparent,
                BorderThickness = new Thickness(0),
                Padding = new Thickness(0),
                HorizontalAlignment = HorizontalAlignment.Left,
            };
            ToolTip.SetTip(link, t("project.goToLine"));
            var diag = d;
            link.Click += (_, _) => GoTo(diag.File, diag.Line);
            output.Children.Add(link);
        }
        if (!r.Succeeded)
        {
            int errors = r.Diagnostics.Count(d => d.IsError);
            output.Children.Add(Line("✗ " + t("project.buildFailed", ("count", errors)), ErrorBrush, false));
            scene = null;
            animation.Stop();
            previewImage.Source = null;
            previewText.Text = t("project.previewFailed");
            previewText.IsVisible = true;
            outputScroll.ScrollToHome();
            return;
        }
        output.Children.Add(Line(r.Commands[^1], Dim));
        scene = r.Scene;
        foreach (var log in scene?.Log ?? []) output.Children.Add(Line(log, Light));
        foreach (var note in scene?.Notes ?? [])
        {
            var args = note.Args.Select(kv => (kv.Key, (object)kv.Value)).ToArray();
            var (icon, brush) = note.Level switch
            {
                NoteLevel.Error => ("✗ ", ErrorBrush),
                NoteLevel.Warning => ("⚠ ", WarningBrush),
                _ => ("ℹ ", Dim),
            };
            output.Children.Add(Line(icon + t("sim." + note.Key, args), brush, false));
        }
        time = 1.0;
        Draw();
        if (scene is { ShowsFrames: true })
        {
            output.Children.Add(Line("✓ " + t(scene.Draws.Count > 0 ? "project.ranDrew" : "project.ranShows"), OkBrush, false));
            if (scene.Approximate) output.Children.Add(Line(t("project.approximate"), Dim, false));
            if (scene.Animated) animation.Start();
        }
    }

    private void Draw()
    {
        previewTitle.Text = scene is null ? t("project.previewTitle") : WindowTitle();
        if (scene is null || !scene.WindowCreated)
        {
            previewImage.Source = null;
            previewText.Text = t("project.previewNoWindow");
            previewText.IsVisible = true;
            return;
        }
        if (!scene.RenderLoop)
        {
            previewImage.Source = null;
            previewText.Text = t("project.previewClosed");
            previewText.IsVisible = true;
            return;
        }
        if (!scene.Presents)
        {
            previewImage.Source = null;
            previewText.Text = t("project.previewNothing");
            previewText.IsVisible = true;
            return;
        }
        var frame = Rasterizer.Render(scene, PreviewWidth, time);
        previewImage.Source = ToBitmap(frame);
        previewText.IsVisible = false;
        if (frame.Errors.Count > 0 && time == 1.0)
            foreach (var e in frame.Errors) output.Children.Add(Line("✗ " + t("project.shaderRuntime", ("message", e)), ErrorBrush, false));
    }

    private static WriteableBitmap ToBitmap(Frame frame)
    {
        var bmp = new WriteableBitmap(new PixelSize(frame.Width, frame.Height), new Vector(96, 96), PixelFormat.Bgra8888, AlphaFormat.Opaque);
        using var fb = bmp.Lock();
        for (int y = 0; y < frame.Height; y++)
            Marshal.Copy(frame.Pixels, y * frame.Width * 4, fb.Address + y * fb.RowBytes, frame.Width * 4);
        return bmp;
    }
}
