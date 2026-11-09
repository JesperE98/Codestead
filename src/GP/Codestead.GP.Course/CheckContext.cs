using System.Text.RegularExpressions;
using Codestead.GP.Gpu;
using Codestead.GP.Gpu.Build;
using Codestead.GP.Gpu.Raster;
using Codestead.GP.Gpu.Readers;

namespace Codestead.GP.Course;

/// <summary>
/// What a task's check looks at after a "Build &amp; run": the project's code (comments removed, whitespace
/// collapsed), the build, and – when it ran – the scene and a rendered frame.
/// </summary>
public sealed class CheckContext
{
    public string Api { get; }
    public GpuProject Project { get; }
    public BuildResult Build { get; }
    private Frame? frame;
    private readonly Dictionary<string, string> code = new(StringComparer.Ordinal);

    public CheckContext(string api, GpuProject project, BuildResult build)
    {
        Api = api;
        Project = project;
        Build = build;
    }

    public Gpu.Scene.Scene? Scene => Build.Scene;

    /// <summary>It compiled.</summary>
    public bool Built => Build.Succeeded;

    /// <summary>It compiled, the window stays open and frames are shown.</summary>
    public bool Shows => Built && Scene?.ShowsFrames == true;

    /// <summary>The frame at time 1 s, 160 pixels wide (null when nothing is shown).</summary>
    public Frame? Frame => Shows ? frame ??= Rasterizer.Render(Scene!, 160) : null;

    /// <summary>A file's code with comments removed and whitespace collapsed to single spaces ("" if missing).</summary>
    public string Code(string file)
    {
        if (!code.TryGetValue(file, out var c))
        {
            var path = Project.PathOf(file);
            var text = path is null ? "" : Project.Files[path];
            code[file] = c = Regex.Replace(CppSource.BlankComments(text), @"\s+", " ");
        }
        return c;
    }

    /// <summary>All C++ code of the project, normalised.</summary>
    public string Cpp => string.Join(" ", Project.CppFiles.Select(f => Code(f.Key)));

    /// <summary>The shader code (every shader file), normalised.</summary>
    public string Shaders => string.Join(" ", Project.Files.Keys.Where(k => !Project.CppFiles.Any(c => c.Key == k)).Select(Code));

    /// <summary>A regular expression found in the C++ code (spaces in the pattern match any whitespace).</summary>
    public bool Has(string pattern) => Regex.IsMatch(Cpp, Spaces(pattern));

    /// <summary>A regular expression found in a file.</summary>
    public bool HasIn(string file, string pattern) => Regex.IsMatch(Code(file), Spaces(pattern));

    /// <summary>A regular expression found in the shaders (files, or for OpenGL also the shader strings in main.cpp).</summary>
    public bool HasInShaders(string pattern) => Regex.IsMatch(Shaders + " " + Cpp, Spaces(pattern));

    private static string Spaces(string pattern) => pattern.Replace(" ", @"\s*");

    public int Count(string pattern) => Regex.Matches(Cpp, Spaces(pattern)).Count;

    /// <summary>The window is cleared to a colour (±0.01).</summary>
    public bool ClearedTo(double r, double g, double b) =>
        Shows && Scene!.ClearColor is { } c && Near(c[0], r) && Near(c[1], g) && Near(c[2], b);

    /// <summary>The colour at a point of the frame (0–1 of width and height, from the top left).</summary>
    public double[]? Pixel(double x, double y) => Frame?.AtRelative(x, y);

    /// <summary>The pixel at a point has a colour (±0.02 per channel).</summary>
    public bool PixelIs(double x, double y, double r, double g, double b) =>
        Pixel(x, y) is { } p && Near(p[0], r, 0.02) && Near(p[1], g, 0.02) && Near(p[2], b, 0.02);

    /// <summary>Something was drawn: a pixel differs from the clear colour.</summary>
    public bool Drew
    {
        get
        {
            if (Frame is not { } f || Scene!.Draws.Count == 0) return false;
            var clear = Scene.ClearColor ?? [0, 0, 0, 1];
            for (int y = 0; y < f.Height; y += 2)
                for (int x = 0; x < f.Width; x += 2)
                {
                    var p = f.At(x, y);
                    if (!Near(p[0], clear[0], 0.02) || !Near(p[1], clear[1], 0.02) || !Near(p[2], clear[2], 0.02)) return true;
                }
            return false;
        }
    }

    /// <summary>The share of the frame (0–1) whose colour differs from the clear colour.</summary>
    public double Covered
    {
        get
        {
            if (Frame is not { } f) return 0;
            var clear = Scene!.ClearColor ?? [0, 0, 0, 1];
            int n = 0;
            for (int y = 0; y < f.Height; y++)
                for (int x = 0; x < f.Width; x++)
                {
                    var p = f.At(x, y);
                    if (!Near(p[0], clear[0], 0.02) || !Near(p[1], clear[1], 0.02) || !Near(p[2], clear[2], 0.02)) n++;
                }
            return n / (double)(f.Width * f.Height);
        }
    }

    /// <summary>The pixel at a point shows the clear colour (nothing drawn there).</summary>
    public bool IsClear(double x, double y)
    {
        if (Pixel(x, y) is not { } p) return false;
        var clear = Scene!.ClearColor ?? [0, 0, 0, 1];
        return Near(p[0], clear[0], 0.02) && Near(p[1], clear[1], 0.02) && Near(p[2], clear[2], 0.02);
    }

    /// <summary>Something is drawn at a point (the frame is shown and the pixel is not the clear colour).</summary>
    public bool DrawnAt(double x, double y) => Frame is not null && !IsClear(x, y);

    /// <summary>The strongest channel at a point: 'r', 'g' or 'b' (by a clear margin), else '?'.</summary>
    public char Dominant(double x, double y)
    {
        if (Pixel(x, y) is not { } p) return '?';
        var max = Math.Max(p[0], Math.Max(p[1], p[2]));
        int i = p[0] == max ? 0 : p[1] == max ? 1 : 2;
        var others = new[] { p[0], p[1], p[2] }.Where((_, k) => k != i);
        return others.All(o => o < max - 0.25) ? "rgb"[i] : '?';
    }

    /// <summary>Some drawn pixel (not the clear colour) satisfies a test.</summary>
    public bool AnyDrawnPixel(Func<double[], bool> test)
    {
        if (Frame is not { } f) return false;
        var clear = Scene!.ClearColor ?? [0, 0, 0, 1];
        for (int y = 0; y < f.Height; y++)
            for (int x = 0; x < f.Width; x++)
            {
                var p = f.At(x, y);
                if (Near(p[0], clear[0], 0.02) && Near(p[1], clear[1], 0.02) && Near(p[2], clear[2], 0.02)) continue;
                if (test(p)) return true;
            }
        return false;
    }

    /// <summary>The picture changes over time: the frame at 2.3 s differs from the one at 1 s in more than a few pixels.</summary>
    public bool ChangesOverTime
    {
        get
        {
            if (Frame is not { } f || !Scene!.Animated) return false;
            var later = Rasterizer.Render(Scene, 160, 2.3);
            int differ = 0;
            for (int i = 0; i < f.Pixels.Length; i += 4)
                if (Math.Abs(f.Pixels[i] - later.Pixels[i]) + Math.Abs(f.Pixels[i + 1] - later.Pixels[i + 1]) + Math.Abs(f.Pixels[i + 2] - later.Pixels[i + 2]) > 12) differ++;
            return differ > 20;
        }
    }

    public static bool Near(double a, double b, double tolerance = 0.01) => Math.Abs(a - b) <= tolerance;
}
