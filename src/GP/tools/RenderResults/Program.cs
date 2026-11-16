using System.Globalization;
using Codestead.GP.Gpu;
using Codestead.GP.Gpu.Raster;

// Renders the result of every chapter – the course's own OpenGL solution, built and run by the simulated GPU – as
// frames for the chapter texts: one frame for a still scene, a short loop for an animated one. The frames are raw
// RGB files (out/<chapter>/<n>.rgb with size.txt); make_results.py turns them into WebP pictures.
//   dotnet run --project src/GP/tools/RenderResults -- <content dir> <out dir> [chapter ...]
var content = args[0];
var output = args[1];
var only = args.Skip(2).ToHashSet(StringComparer.Ordinal);
const int Width = 480;
const double Seconds = 3.0;
const int Fps = 10;
foreach (var chapterDir in Directory.GetDirectories(Path.Combine(content, "projects", "opengl")).Order(StringComparer.Ordinal))
{
    var chapter = Path.GetFileName(chapterDir);
    if (only.Count > 0 && !only.Contains(chapter)) continue;
    // Already rendered (a run that was stopped carries on where it was).
    if (only.Count == 0 && File.Exists(Path.Combine(output, chapter, "size.txt"))) continue;
    var solution = Path.Combine(chapterDir, "solution");
    if (!Directory.Exists(solution)) continue;
    var project = new GpuProject();
    foreach (var file in Directory.GetFiles(solution, "*", SearchOption.AllDirectories).Order(StringComparer.Ordinal))
    {
        var rel = Path.GetRelativePath(solution, file).Replace('\\', '/');
        if (IsAsset(rel)) project.Assets[rel] = File.ReadAllBytes(file);
        else project.Files[rel] = File.ReadAllText(file).Replace("\r\n", "\n");
    }
    var result = Simulator.Build(project, "opengl");
    if (result.Scene is not { ShowsFrames: true } scene)
    {
        Console.WriteLine($"{chapter}: no frames");
        continue;
    }
    var dir = Path.Combine(output, chapter);
    Directory.CreateDirectory(dir);
    int frames = scene.Animated ? (int)(Seconds * Fps) : 1;
    var watch = System.Diagnostics.Stopwatch.StartNew();
    int w = 0, h = 0;
    for (int i = 0; i < frames; i++)
    {
        double time = scene.Animated ? 1.0 + i / (double)Fps : 1.0;
        var frame = Rasterizer.Render(scene, Width, time);
        w = frame.Width;
        h = frame.Height;
        var rgb = new byte[w * h * 3];
        for (int p = 0; p < w * h; p++)
        {
            rgb[p * 3] = frame.Pixels[p * 4 + 2];
            rgb[p * 3 + 1] = frame.Pixels[p * 4 + 1];
            rgb[p * 3 + 2] = frame.Pixels[p * 4];
        }
        File.WriteAllBytes(Path.Combine(dir, i.ToString("D3", CultureInfo.InvariantCulture) + ".rgb"), rgb);
    }
    File.WriteAllText(Path.Combine(dir, "size.txt"), FormattableString.Invariant($"{w} {h} {1000 / Fps} {frames}"));
    Console.WriteLine(FormattableString.Invariant($"{chapter}: {frames} frame(s) {w}x{h} in {watch.Elapsed.TotalSeconds:0.0} s"));
}

static bool IsAsset(string path) =>
    new[] { ".png", ".jpg", ".hdr", ".obj", ".mtl", ".otf", ".ttf", ".gltf", ".bin" }.Any(e => path.EndsWith(e, StringComparison.OrdinalIgnoreCase));
