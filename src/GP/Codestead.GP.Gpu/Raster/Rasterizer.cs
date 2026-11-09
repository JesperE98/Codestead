using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Raster;

/// <summary>
/// The simulated GPU: runs the vertex shader on every vertex, assembles triangles, culls, rasterises them with
/// perspective-correct interpolation and a depth test, and runs the fragment shader per pixel. The shader stages
/// are in Rasterizer.Stages.cs.
/// </summary>
public static partial class Rasterizer
{
    /// <summary>Renders one frame of a scene at a width in pixels (the height follows the window's aspect ratio).</summary>
    public static Frame Render(Scene.Scene scene, int width, double time = 1.0)
    {
        // A program that reads the clock is read again at that time (its uniforms, transforms … change).
        if (scene.Animated && scene.AtTime is { } at && time != 1.0) scene = at(time);
        int height = Math.Max(1, (int)Math.Round(width * (double)scene.Height / Math.Max(1, scene.Width)));
        var pixels = new byte[width * height * 4];
        var depth = new double[width * height];
        Array.Fill(depth, double.MaxValue);
        var clear = scene.ClearColor ?? [0, 0, 0, 1];
        for (int i = 0; i < width * height; i++) Put(pixels, i, clear);
        var errors = new List<string>();
        bool yDown = scene.Api == Apis.Vulkan;
        bool zMinusOneToOne = scene.Api == Apis.OpenGL;
        double scale = scene.Width / (double)width;
        foreach (var draw in scene.Draws)
        {
            try
            {
                DrawOne(draw, time, width, height, scale, yDown, zMinusOneToOne, pixels, depth);
            }
            catch (ShaderRuntimeException e)
            {
                errors.Add(e.Line > 0 ? $"line {e.Line}: {e.Message}" : e.Message);
            }
        }
        return new Frame(width, height, pixels, errors);
    }

    private static void Put(byte[] pixels, int index, double[] rgba)
    {
        int i = index * 4;
        pixels[i] = ToByte(rgba[2]);
        pixels[i + 1] = ToByte(rgba[1]);
        pixels[i + 2] = ToByte(rgba[0]);
        pixels[i + 3] = 255;
    }

    private static byte ToByte(double v) => (byte)Math.Round(Math.Clamp(double.IsNaN(v) ? 0 : v, 0, 1) * 255);

    private static void DrawOne(DrawCall draw, double time, int width, int height, double scale, bool yDown, bool zMinusOneToOne, byte[] pixels, double[] depth)
    {
        var stages = new Stages(draw, time, height, scale, yDown);
        for (int instance = 0; instance < Math.Max(1, draw.Instances); instance++)
        {
            var order = draw.Indices ?? Enumerable.Range(draw.First, Math.Max(0, draw.Count)).ToArray();
            var cache = new Dictionary<int, ShadedVertex>();
            ShadedVertex Vertex(int index)
            {
                if (!cache.TryGetValue(index, out var v)) cache[index] = v = stages.Vertex(index, instance);
                return v;
            }
            foreach (var (a, b, c) in Triangles(order, draw.Topology))
                foreach (var (p, q, r) in ClipNear(Vertex(a), Vertex(b), Vertex(c), zMinusOneToOne))
                    Triangle(p, q, r, draw, stages, width, height, yDown, zMinusOneToOne, pixels, depth);
        }
    }

    /// <summary>
    /// Clips a triangle against the near plane (OpenGL: z ≥ -w, Vulkan and Direct3D: z ≥ 0) in clip space, as the GPU
    /// does, so geometry crossing the camera's near plane is cut instead of dropped.
    /// </summary>
    private static List<(ShadedVertex, ShadedVertex, ShadedVertex)> ClipNear(ShadedVertex a, ShadedVertex b, ShadedVertex c, bool zMinusOneToOne)
    {
        double D(ShadedVertex v) => zMinusOneToOne ? v.Clip[2] + v.Clip[3] : v.Clip[2];
        var input = new[] { a, b, c };
        if (input.All(v => D(v) >= 0)) return [(a, b, c)];
        if (input.All(v => D(v) < 0)) return [];
        var poly = new List<ShadedVertex>();
        for (int i = 0; i < 3; i++)
        {
            var cur = input[i];
            var next = input[(i + 1) % 3];
            double dc = D(cur), dn = D(next);
            if (dc >= 0) poly.Add(cur);
            if ((dc >= 0) != (dn >= 0)) poly.Add(Lerp(cur, next, dc / (dc - dn)));
        }
        var result = new List<(ShadedVertex, ShadedVertex, ShadedVertex)>();
        for (int i = 1; i + 1 < poly.Count; i++) result.Add((poly[0], poly[i], poly[i + 1]));
        return result;
    }

    private static ShadedVertex Lerp(ShadedVertex a, ShadedVertex b, double t)
    {
        var clip = new double[4];
        for (int i = 0; i < 4; i++) clip[i] = a.Clip[i] + (b.Clip[i] - a.Clip[i]) * t;
        var outputs = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
        foreach (var (k, va) in a.Outputs)
        {
            if (va.V is null || va.IsMatrix || !b.Outputs.TryGetValue(k, out var vb) || vb.V is null)
            {
                outputs[k] = va;
                continue;
            }
            outputs[k] = ShaderValue.Vec(va.V.Select((x, i) => x + (vb.V[Math.Min(i, vb.V.Length - 1)] - x) * t).ToArray());
        }
        return new ShadedVertex(clip, outputs);
    }

    private static IEnumerable<(int, int, int)> Triangles(int[] order, Topology topology)
    {
        switch (topology)
        {
            case Topology.Triangles:
                for (int i = 0; i + 2 < order.Length; i += 3) yield return (order[i], order[i + 1], order[i + 2]);
                break;
            case Topology.TriangleStrip:
                for (int i = 0; i + 2 < order.Length; i++)
                    yield return i % 2 == 0 ? (order[i], order[i + 1], order[i + 2]) : (order[i + 1], order[i], order[i + 2]);
                break;
            case Topology.TriangleFan:
                for (int i = 1; i + 1 < order.Length; i++) yield return (order[0], order[i], order[i + 1]);
                break;
        }
    }

    private static void Triangle(ShadedVertex v0, ShadedVertex v1, ShadedVertex v2, DrawCall draw, Stages stages, int width, int height, bool yDown, bool zMinusOneToOne, byte[] pixels, double[] depth)
    {
        var vs = new[] { v0, v1, v2 };
        if (vs.Any(v => v.Clip[3] <= 1e-9)) return;
        var sx = new double[3];
        var sy = new double[3];
        var sz = new double[3];
        var invW = new double[3];
        for (int i = 0; i < 3; i++)
        {
            var c = vs[i].Clip;
            double nx = c[0] / c[3], ny = c[1] / c[3], nz = c[2] / c[3];
            sx[i] = (nx + 1) / 2 * width;
            sy[i] = yDown ? (1 + ny) / 2 * height : (1 - ny) / 2 * height;
            sz[i] = zMinusOneToOne ? (nz + 1) / 2 : nz;
            invW[i] = 1 / c[3];
        }
        // Signed area on screen (y down): negative means counter-clockwise as you look at the screen.
        double area = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (sy[1] - sy[0]);
        if (Math.Abs(area) < 1e-12) return;
        bool ccw = area < 0;
        bool front = draw.FrontCcw ? ccw : !ccw;
        if (draw.Cull == CullMode.FrontAndBack || (draw.Cull == CullMode.Back && !front) || (draw.Cull == CullMode.Front && front)) return;

        int minX = Math.Max(0, (int)Math.Floor(sx.Min())), maxX = Math.Min(width - 1, (int)Math.Ceiling(sx.Max()));
        int minY = Math.Max(0, (int)Math.Floor(sy.Min())), maxY = Math.Min(height - 1, (int)Math.Ceiling(sy.Max()));
        double[] edgeLen =
        [
            Math.Sqrt(Sq(sx[2] - sx[1]) + Sq(sy[2] - sy[1])),
            Math.Sqrt(Sq(sx[0] - sx[2]) + Sq(sy[0] - sy[2])),
            Math.Sqrt(Sq(sx[1] - sx[0]) + Sq(sy[1] - sy[0])),
        ];
        for (int py = minY; py <= maxY; py++)
        {
            for (int px = minX; px <= maxX; px++)
            {
                double x = px + 0.5, y = py + 0.5;
                double w0 = ((sx[2] - sx[1]) * (y - sy[1]) - (sy[2] - sy[1]) * (x - sx[1])) / area;
                double w1 = ((sx[0] - sx[2]) * (y - sy[2]) - (sy[0] - sy[2]) * (x - sx[2])) / area;
                double w2 = 1 - w0 - w1;
                if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue;
                if (draw.Wireframe)
                {
                    double d0 = Math.Abs(w0 * area) / edgeLen[0], d1 = Math.Abs(w1 * area) / edgeLen[1], d2 = Math.Abs(w2 * area) / edgeLen[2];
                    if (Math.Min(d0, Math.Min(d1, d2)) > 0.8) continue;
                }
                double z = w0 * sz[0] + w1 * sz[1] + w2 * sz[2];
                int index = py * width + px;
                if (draw.DepthTest)
                {
                    if (z >= depth[index] || z < 0 || z > 1) continue;
                }
                // Perspective-correct weights.
                double p0 = w0 * invW[0], p1 = w1 * invW[1], p2 = w2 * invW[2];
                double sum = p0 + p1 + p2;
                p0 /= sum;
                p1 /= sum;
                p2 /= sum;
                var color = stages.Fragment(vs, p0, p1, p2, x, y, z, sum);
                if (color is null) continue;
                if (draw.DepthTest) depth[index] = z;
                Put(pixels, index, color);
            }
        }
    }

    private static double Sq(double v) => v * v;
}
