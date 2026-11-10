using System.Collections.Concurrent;
using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;
using Codestead.GP.Gpu.Textures;

namespace Codestead.GP.Gpu.Raster;

/// <summary>
/// The simulated GPU: runs the vertex shader on every vertex (and a geometry shader on every primitive), assembles
/// triangles, lines and points, culls, rasterises them with perspective-correct interpolation and runs the fragment
/// shader per pixel, then the per-sample tests and blending (Rasterizer.Fragments.cs). The window and every off-screen
/// target is a <see cref="Framebuffer"/>; a target drawn earlier in the frame can be sampled as a texture.
/// </summary>
public static partial class Rasterizer
{
    /// <summary>
    /// The targets of the frame being rendered on this thread (render-target textures read them); the workers that
    /// shade a draw's fragments get the context of the thread that renders the frame.
    /// </summary>
    [ThreadStatic] private static RenderContext? current;

    private sealed class RenderContext(Func<string, Framebuffer> target, bool bottomUp)
    {
        // Read by the fragment workers side by side; an image is made once, by the first thread that needs it.
        private readonly ConcurrentDictionary<(string, int, bool), Image> images = new();
        public Func<string, Framebuffer> Target { get; } = target;
        public bool BottomUp { get; } = bottomUp;

        public Image Image(string id, int attachment, bool depth)
        {
            if (images.TryGetValue((id, attachment, depth), out var image)) return image;
            lock (images)
            {
                if (!images.TryGetValue((id, attachment, depth), out image))
                {
                    var fb = Target(id);
                    images[(id, attachment, depth)] = image = depth ? fb.DepthImage(BottomUp) : fb.ColorImage(BottomUp, attachment);
                }
                return image;
            }
        }

        /// <summary>A target was drawn into, cleared or copied to (between draws): its images are made again.</summary>
        public void Changed(string? id)
        {
            if (id is null) return;
            // A layered target's layers ("id@1" … "id@5") change with it.
            foreach (var key in images.Keys.Where(k => k.Item1 == id || k.Item1.StartsWith(id + "@", StringComparison.Ordinal)).ToList()) images.TryRemove(key, out _);
        }
    }

    /// <summary>
    /// The image of a render target as drawn so far in the frame being rendered (null outside a render): its colour
    /// attachment, or its depth (shadow maps).
    /// </summary>
    public static Image? TargetImage(string id, int attachment = 0, bool depth = false) => current?.Image(id, attachment, depth);

    /// <summary>Renders one frame of a scene at a width in pixels (the height follows the window's aspect ratio).</summary>
    public static Frame Render(Scene.Scene scene, int width, double time = 1.0)
    {
        // A program that reads the clock is read again at that time (its uniforms, transforms … change).
        if (scene.Animated && scene.AtTime is { } at && time != 1.0) scene = at(time);
        int height = Math.Max(1, (int)Math.Round(width * (double)scene.Height / Math.Max(1, scene.Width)));
        double scale = scene.Width / (double)width;
        var errors = new List<string>();
        bool yDown = scene.Api == Apis.Vulkan;
        bool zMinusOneToOne = scene.Api == Apis.OpenGL;

        var window = new Framebuffer(width, height, scene.Samples);
        window.Clear(scene.ClearColor ?? [0, 0, 0, 1], 1.0, 0);
        var targets = new Dictionary<string, Framebuffer>(StringComparer.Ordinal);
        Framebuffer Fb(string? id)
        {
            if (id is null) return window;
            if (!targets.TryGetValue(id, out var fb))
            {
                // A layer of a layered target ("id@3": a cube map's face) has the target's size and format.
                var baseId = id.Contains('@') ? id[..id.IndexOf('@')] : id;
                var t = scene.Targets.GetValueOrDefault(baseId) ?? new RenderTarget(id);
                int w = t.Width > 0 ? Math.Max(1, (int)Math.Round(t.Width / scale)) : width;
                int h = t.Height > 0 ? Math.Max(1, (int)Math.Round(t.Height / scale)) : height;
                targets[id] = fb = new Framebuffer(w, h, t.Samples, t.Float, t.ColorAttachments) { HasDepth = t.Depth };
            }
            return fb;
        }
        // The size in the program's own pixels (gl_FragCoord) of a target.
        double LogicalWidth(string? id) => id is not null && scene.Targets.GetValueOrDefault(id) is { Width: > 0 } t ? t.Width : scene.Width;

        var previous = current;
        var context = new RenderContext(id => Fb(id), zMinusOneToOne);
        current = context;
        try
        {
            void Ops(Func<int, bool> when)
            {
                foreach (var op in scene.Ops.Where(o => when(o.BeforeDraw)))
                {
                    switch (op)
                    {
                        case ClearOp c:
                            Fb(c.Target).Clear(c.Color, c.Depth, c.Stencil);
                            // A layered target is cleared in every layer.
                            if (c.Target is not null && scene.Targets.GetValueOrDefault(c.Target) is { Layers: > 1 } layered)
                                for (int l = 1; l < layered.Layers; l++) Fb(c.Target + "@" + l).Clear(c.Color, c.Depth, c.Stencil);
                            context.Changed(c.Target);
                            break;
                        case CopyOp c:
                            Fb(c.To).CopyFrom(Fb(c.From), c.Color, c.Depth);
                            context.Changed(c.To);
                            break;
                    }
                }
            }
            for (int i = 0; i < scene.Draws.Count; i++)
            {
                int at2 = i;
                Ops(b => b == at2);
                var draw = scene.Draws[i];
                var fb = Fb(draw.Target);
                try
                {
                    var target = draw.Target;
                    DrawOne(draw, time, fb, LogicalWidth(draw.Target) / fb.Width, yDown, zMinusOneToOne,
                        layer => layer <= 0 || target is null || scene.Targets.GetValueOrDefault(target) is not { Layers: > 1 } lt || layer >= lt.Layers ? fb : Fb(target + "@" + layer));
                }
                catch (ShaderRuntimeException e)
                {
                    errors.Add(e.Line > 0 ? $"line {e.Line}: {e.Message}" : e.Message);
                }
                context.Changed(draw.Target);
            }
            int count = scene.Draws.Count;
            Ops(b => b >= count);
        }
        finally
        {
            current = previous;
        }

        var pixels = new byte[width * height * 4];
        for (int y = 0; y < height; y++)
            for (int x = 0; x < width; x++)
            {
                var c = window.Resolved(x, y);
                if (scene.WindowSrgb) c = [SrgbCurve.FromLinear(c[0]), SrgbCurve.FromLinear(c[1]), SrgbCurve.FromLinear(c[2]), c.Length > 3 ? c[3] : 1];
                int i = (y * width + x) * 4;
                pixels[i] = ToByte(c[2]);
                pixels[i + 1] = ToByte(c[1]);
                pixels[i + 2] = ToByte(c[0]);
                pixels[i + 3] = 255;
            }
        return new Frame(width, height, pixels, errors);
    }

    private static byte ToByte(double v) => (byte)Math.Round(Math.Clamp(double.IsNaN(v) ? 0 : v, 0, 1) * 255);

    private static void DrawOne(DrawCall draw, double time, Framebuffer fb, double scale, bool yDown, bool zMinusOneToOne, Func<int, Framebuffer>? layers = null)
    {
        var baseFb = fb;
        var uniforms = draw.Uniforms(time);
        var textures = TextureReads.Of(draw);
        var stages = new Stages(draw, uniforms, textures, time, baseFb.Height, scale, yDown);
        // The vertex and geometry stages run here, in order; the fragments of the primitives they make are shaded in
        // batches on every core (Rasterizer.Parallel.cs).
        TextureReads? shared = null;
        var fragments = new FragmentBatch(stages, baseFb.Height, () => new Stages(draw, uniforms, shared ??= textures.Shared(), time, baseFb.Height, scale, yDown));
        try
        {
            for (int instance = 0; instance < Math.Max(1, draw.Instances); instance++)
            {
                var order = draw.Indices ?? Enumerable.Range(draw.First, Math.Max(0, draw.Count)).ToArray();
                var cache = new Dictionary<int, ShadedVertex>();
                ShadedVertex Vertex(int index)
                {
                    if (!cache.TryGetValue(index, out var v)) cache[index] = v = stages.Vertex(index, instance);
                    return v;
                }
                foreach (var primitive in Primitives(order, draw.Topology))
                {
                    var input = primitive.Select(Vertex).ToArray();
                    var output = stages.HasGeometry ? stages.Geometry(input) : [(KindOf(draw.Topology), input)];
                    foreach (var (kind, v) in output)
                    {
                        // A geometry shader may send the primitive to a layer of a layered target (gl_Layer).
                        fb = v[0].Layer != 0 && layers is not null ? layers(v[0].Layer) : baseFb;
                        long pixels;
                        switch (kind)
                        {
                            case Topology.Points:
                                fragments.Add(Point(v[0], draw, fb, scale, yDown, zMinusOneToOne, out pixels), pixels);
                                break;
                            case Topology.Lines:
                                foreach (var (p, q) in ClipNearLine(v[0], v[1], zMinusOneToOne))
                                    fragments.Add(Line(p, q, draw, fb, yDown, zMinusOneToOne, out pixels), pixels);
                                break;
                            default:
                                foreach (var (p, q, r) in ClipNear(v[0], v[1], v[2], zMinusOneToOne))
                                    fragments.Add(Triangle(p, q, r, draw, fb, yDown, zMinusOneToOne, out pixels), pixels);
                                break;
                        }
                    }
                }
            }
        }
        catch
        {
            // An error in the vertex or geometry stage comes after the fragments of the primitives before it.
            fragments.Run();
            throw;
        }
        fragments.Run();
    }

    /// <summary>The kind of primitive a topology makes: points, lines or triangles.</summary>
    private static Topology KindOf(Topology t) => t switch
    {
        Topology.Points => Topology.Points,
        Topology.Lines or Topology.LineStrip => Topology.Lines,
        _ => Topology.Triangles,
    };

    private static IEnumerable<int[]> Primitives(int[] order, Topology topology)
    {
        switch (topology)
        {
            case Topology.Triangles:
                for (int i = 0; i + 2 < order.Length; i += 3) yield return [order[i], order[i + 1], order[i + 2]];
                break;
            case Topology.TriangleStrip:
                for (int i = 0; i + 2 < order.Length; i++)
                    yield return i % 2 == 0 ? [order[i], order[i + 1], order[i + 2]] : [order[i + 1], order[i], order[i + 2]];
                break;
            case Topology.TriangleFan:
                for (int i = 1; i + 1 < order.Length; i++) yield return [order[0], order[i], order[i + 1]];
                break;
            case Topology.Lines:
                for (int i = 0; i + 1 < order.Length; i += 2) yield return [order[i], order[i + 1]];
                break;
            case Topology.LineStrip:
                for (int i = 0; i + 1 < order.Length; i++) yield return [order[i], order[i + 1]];
                break;
            case Topology.Points:
                foreach (var i in order) yield return [i];
                break;
        }
    }

    /// <summary>Distance to the near plane in clip space (OpenGL: z ≥ -w, Vulkan and Direct3D: z ≥ 0).</summary>
    private static double NearDistance(ShadedVertex v, bool zMinusOneToOne) => zMinusOneToOne ? v.Clip[2] + v.Clip[3] : v.Clip[2];

    /// <summary>
    /// Clips a triangle against the near plane in clip space, as the GPU does, so geometry crossing the camera's near
    /// plane is cut instead of dropped.
    /// </summary>
    private static List<(ShadedVertex, ShadedVertex, ShadedVertex)> ClipNear(ShadedVertex a, ShadedVertex b, ShadedVertex c, bool zMinusOneToOne)
    {
        var input = new[] { a, b, c };
        if (input.All(v => NearDistance(v, zMinusOneToOne) >= 0)) return [(a, b, c)];
        if (input.All(v => NearDistance(v, zMinusOneToOne) < 0)) return [];
        var poly = new List<ShadedVertex>();
        for (int i = 0; i < 3; i++)
        {
            var cur = input[i];
            var next = input[(i + 1) % 3];
            double dc = NearDistance(cur, zMinusOneToOne), dn = NearDistance(next, zMinusOneToOne);
            if (dc >= 0) poly.Add(cur);
            if ((dc >= 0) != (dn >= 0)) poly.Add(Lerp(cur, next, dc / (dc - dn)));
        }
        var result = new List<(ShadedVertex, ShadedVertex, ShadedVertex)>();
        for (int i = 1; i + 1 < poly.Count; i++) result.Add((poly[0], poly[i], poly[i + 1]));
        return result;
    }

    private static List<(ShadedVertex, ShadedVertex)> ClipNearLine(ShadedVertex a, ShadedVertex b, bool zMinusOneToOne)
    {
        double da = NearDistance(a, zMinusOneToOne), db = NearDistance(b, zMinusOneToOne);
        if (da >= 0 && db >= 0) return [(a, b)];
        if (da < 0 && db < 0) return [];
        var cut = Lerp(a, b, da / (da - db));
        return da >= 0 ? [(a, cut)] : [(cut, b)];
    }

    private static ShadedVertex Lerp(ShadedVertex a, ShadedVertex b, double t)
    {
        var clip = new double[4];
        for (int i = 0; i < 4; i++) clip[i] = a.Clip[i] + (b.Clip[i] - a.Clip[i]) * t;
        var outputs = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
        foreach (var (k, va) in a.Outputs)
            outputs[k] = b.Outputs.TryGetValue(k, out var vb) ? Mix(va, vb, 1 - t, t) : va;
        return new ShadedVertex(clip, outputs, a.PointSize);
    }

    /// <summary>a·wa + b·wb for numbers, fields and array items (other values: a's).</summary>
    private static ShaderValue Mix(ShaderValue a, ShaderValue b, double wa, double wb)
    {
        if (a.V is not null && !a.IsMatrix && b.V is not null)
        {
            var r = new double[a.V.Length];
            for (int i = 0; i < r.Length; i++) r[i] = wa * a.V[i] + wb * b.V[Math.Min(i, b.V.Length - 1)];
            return ShaderValue.Vec(r);
        }
        if (a.Fields is not null && b.Fields is not null)
            return ShaderValue.Struct(a.Fields.ToDictionary(kv => kv.Key, kv => b.Fields.TryGetValue(kv.Key, out var fb) ? Mix(kv.Value, fb, wa, wb) : kv.Value));
        if (a.Items is not null && b.Items is not null && a.Items.Length == b.Items.Length)
            return ShaderValue.Array(a.Items.Select((x, i) => Mix(x, b.Items[i], wa, wb)).ToArray());
        return a;
    }

    private static double Sq(double v) => v * v;
}
