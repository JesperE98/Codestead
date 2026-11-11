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
        var original = scene;
        if (scene.Animated && scene.AtTime is { } at && time != 1.0) scene = at(time);
        int height = Math.Max(1, (int)Math.Round(width * (double)scene.Height / Math.Max(1, scene.Width)));
        double scale = scene.Width / (double)width;
        var errors = new List<string>();
        bool yDown = scene.Api == Apis.Vulkan;
        bool zMinusOneToOne = scene.Api == Apis.OpenGL;

        var window = new Framebuffer(width, height, scene.Samples);
        window.Clear(scene.ClearColor ?? [0, 0, 0, 1], 1.0, 0);
        var targets = new Dictionary<string, Framebuffer>(StringComparer.Ordinal);
        var setupTargets = SetupTargets(scene);
        // What the program draws once before its render loop (an environment captured into a cube map, a look-up
        // table) is drawn for the first frame and kept for the next ones, as the program keeps it.
        var setupOwner = original;
        // Kept on the scene, or – for another scene with the same setup (the program built again: the same passes) – in
        // a small cache shared by all scenes.
        if (scene.SetupDraws > 0 && setupOwner.SetupCache is null && SharedSetups.TryGetValue(SetupKey(scene), out var shared)) setupOwner.SetupCache = shared;
        var setup = setupOwner.SetupCache as SetupResult;
        bool setupDone = scene.SetupDraws > 0 && setup is not null && (setup.Width == 0 || setup.Width == width) && setup.Draws == scene.SetupDraws;
        if (setupDone)
        {
            foreach (var (id, kept) in setup!.Targets) targets[id] = kept;
            errors.AddRange(setup.Errors);
        }
        Framebuffer Fb(string? id)
        {
            if (id is null) return window;
            if (!targets.TryGetValue(id, out var fb))
            {
                // A layer of a layered target ("id@3": a cube map's face) has the target's size and format.
                var baseId = id.Contains('@') ? id[..id.IndexOf('@')] : id;
                var t = scene.Targets.GetValueOrDefault(baseId) ?? new RenderTarget(id);
                // What is drawn once before the render loop has the same size at every preview size (so it can be kept
                // between frames, and a cube map's mip levels halve exactly): its own size – or a quarter of it when
                // its shader loops over many samples per pixel (a convolution, a pre-filter), which the simulator's
                // CPU could not afford at full size. The frame's own targets follow the preview's scale.
                int w, h;
                if (setupTargets.TryGetValue(Family(id), out bool heavy))
                {
                    // (A small mip level keeps its own size up to 8 texels: a pre-filter's 4 × 4 level stays 4 × 4.)
                    w = t.Width > 0 ? (heavy ? Math.Max(Math.Min(t.Width, 8), t.Width / HeavySetupDivisor) : t.Width) : width;
                    h = t.Height > 0 ? (heavy ? Math.Max(Math.Min(t.Height, 8), t.Height / HeavySetupDivisor) : t.Height) : height;
                }
                else
                {
                    w = t.Width > 0 ? Math.Max(1, (int)Math.Round(t.Width / scale)) : width;
                    h = t.Height > 0 ? Math.Max(1, (int)Math.Round(t.Height / scale)) : height;
                }
                // A depth buffer shared with another target is that target's own.
                var depthOf = t.DepthOf is { } owner && owner != id ? Fb(owner) : null;
                targets[id] = fb = new Framebuffer(w, h, t.Samples, t.Float, t.ColorAttachments, depthOf) { HasDepth = t.Depth || depthOf is not null, Channels = t.Channels };
            }
            return fb;
        }
        // The size in the program's own pixels (gl_FragCoord) of a target.
        double LogicalWidth(string? id) => id is not null && scene.Targets.GetValueOrDefault(id.Contains('@') ? id[..id.IndexOf('@')] : id) is { Width: > 0 } t ? t.Width : scene.Width;

        var previous = current;
        var context = new RenderContext(id => Fb(id), zMinusOneToOne);
        current = context;
        try
        {
            // The ops of the setup draws are the first SetupOps of the list; the frame's own follow.
            void Ops(Func<int, bool> when, bool ofSetup = false)
            {
                int setupOps = Math.Min(scene.SetupOps, scene.Ops.Count);
                foreach (var op in (ofSetup ? scene.Ops.Take(setupOps) : scene.Ops.Skip(setupOps)).Where(o => when(o.BeforeDraw)))
                {
                    switch (op)
                    {
                        case ClearOp c:
                            Fb(c.Target).Clear(c.Color, c.Depth, c.Stencil, c.Attachment);
                            // A layered target is cleared in every layer.
                            if (c.Target is not null && scene.Targets.GetValueOrDefault(c.Target) is { Layers: > 1 } layered)
                                for (int l = 1; l < layered.Layers; l++) Fb(c.Target + "@" + l).Clear(c.Color, c.Depth, c.Stencil, c.Attachment);
                            context.Changed(c.Target);
                            break;
                        case CopyOp c:
                            Fb(c.To).CopyFrom(Fb(c.From), c.Color, c.Depth, c.Average);
                            context.Changed(c.To);
                            break;
                    }
                }
            }
            int setupDraws = Math.Min(scene.SetupDraws, scene.Draws.Count);
            for (int i = setupDone ? setupDraws : 0; i < scene.Draws.Count; i++)
            {
                int at2 = i;
                if (i < setupDraws) Ops(b => b == at2, true);
                else
                {
                    if (i == setupDraws && setupDraws > 0 && !setupDone)
                    {
                        // The setup is over: its last ops (mip levels made after the last capture), then it is kept.
                        Ops(b => b >= setupDraws, true);
                        KeepSetup(setupOwner, scene, width, targets, errors);
                    }
                    Ops(b => b == at2);
                }
                var draw = scene.Draws[i];
                var fb = Fb(draw.Target);
                var simTimer = SimTime ? System.Diagnostics.Stopwatch.StartNew() : null;
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
                // The depth it shares with another target was drawn into too.
                if (draw.Target is not null && scene.Targets.GetValueOrDefault(draw.Target)?.DepthOf is { } sharedDepth) context.Changed(sharedDepth);
                if (simTimer is not null) Console.Error.WriteLine($"SIMTIME draw {i} target={draw.Target ?? "window"} {fb.Width}x{fb.Height} {simTimer.ElapsedMilliseconds} ms");
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

    private static readonly bool SimTime = Environment.GetEnvironmentVariable("SIMTIME") == "1";

    /// <summary>A setup target whose shader loops is drawn at 1 / this of its size.</summary>
    private const int HeavySetupDivisor = 4;

    /// <summary>A target's family: the texture behind "name~mip@face" (its mip levels and cube faces).</summary>
    private static string Family(string id)
    {
        int i = id.IndexOfAny(['~', '@']);
        return i < 0 ? id : id[..i];
    }

    /// <summary>
    /// The targets the setup draws fill, by family: true when one of their fragment shaders loops (many samples per
    /// pixel).
    /// </summary>
    private static Dictionary<string, bool> SetupTargets(Scene.Scene scene)
    {
        var result = new Dictionary<string, bool>(StringComparer.Ordinal);
        foreach (var draw in scene.Draws.Take(scene.SetupDraws))
        {
            if (draw.Target is not { } target) continue;
            var family = Family(target);
            result[family] = result.GetValueOrDefault(family) || HasLoop(draw.FragmentShader);
        }
        return result;
    }

    private static bool HasLoop(ShaderProgram shader)
    {
        static bool In(IEnumerable<ShaderAst.Stmt> body) => body.Any(s => s switch
        {
            ShaderAst.For or ShaderAst.ForEach => true,
            ShaderAst.If i => In(i.Then) || (i.Else is not null && In(i.Else)),
            _ => false,
        });
        return shader.Functions.Any(f => In(f.Body));
    }

    /// <summary>The targets the setup draws filled, at a preview width.</summary>
    private sealed record SetupResult(int Width, int Draws, Dictionary<string, Framebuffer> Targets, List<string> Errors);

    /// <summary>
    /// Keeps what the setup draws left in their targets for the next frames – unless the frame itself draws into one of
    /// them (then every frame starts from scratch).
    /// </summary>
    private static void KeepSetup(Scene.Scene owner, Scene.Scene scene, int width, Dictionary<string, Framebuffer> targets, List<string> errors)
    {
        static string Base(string id) => id.Contains('@') ? id[..id.IndexOf('@')] : id;
        var later = scene.Draws.Skip(scene.SetupDraws).Select(d => d.Target)
            .Concat(scene.Ops.Skip(scene.SetupOps).SelectMany(o => o switch { ClearOp c => new[] { c.Target }, CopyOp c => [c.To], _ => [] }))
            .Where(t => t is not null).Select(t => Base(t!)).ToHashSet(StringComparer.Ordinal);
        if (targets.Keys.Any(id => later.Contains(Base(id)))) return;
        // Targets with a size of their own are the same at every preview width.
        bool anyWidth = targets.Keys.All(id => scene.Targets.GetValueOrDefault(Base(id)) is { Width: > 0, Height: > 0 });
        var result = new SetupResult(anyWidth ? 0 : width, scene.SetupDraws, new Dictionary<string, Framebuffer>(targets, StringComparer.Ordinal), errors.ToList());
        owner.SetupCache = result;
        if (anyWidth)
        {
            lock (SharedSetups)
            {
                if (SharedSetups.Count >= 12) SharedSetups.Clear();
                SharedSetups[SetupKey(scene)] = result;
            }
        }
    }

    /// <summary>Setups drawn before, by what they draw (<see cref="SetupKey"/>).</summary>
    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, SetupResult> SharedSetups = new(StringComparer.Ordinal);

    /// <summary>
    /// What a scene's setup draws: each draw's shaders, state, vertices, uniforms and what its textures read at a few
    /// points (loaded images; targets drawn by earlier setup draws are covered by those draws), its ops and its targets.
    /// Two scenes with the same key draw the same setup pictures.
    /// </summary>
    private static string SetupKey(Scene.Scene scene)
    {
        if (scene.SetupKey is { } known) return known;
        var sb = new System.Text.StringBuilder();
        static string Numbers(double[]? v) => v is null ? "-" : string.Join(",", v.Select(x => x.ToString("R", System.Globalization.CultureInfo.InvariantCulture)));
        foreach (var d in scene.Draws.Take(scene.SetupDraws))
        {
            sb.Append(d.VertexShader.Source.GetHashCode()).Append('|').Append(d.FragmentShader.Source.GetHashCode()).Append('|').Append(d.GeometryShader?.Source.GetHashCode())
              .Append('|').Append(d.VertexEntry).Append(d.FragmentEntry).Append('|').Append(d.Target).Append('|').Append(d.Topology).Append(d.First).Append(',').Append(d.Count)
              .Append(',').Append(d.Instances).Append('|').Append(d.Cull).Append(d.FrontCcw).Append(d.DepthTest).Append(d.DepthFunc).Append(d.DepthWrite)
              .Append(d.Blend).Append(d.Stencil).Append(string.Join("", d.ColorMask)).Append('|');
            var hash = new HashCode();
            foreach (var v in d.Vertices) foreach (var (k, x) in v) { hash.Add(k); if (x.V is { } nums) foreach (var n in nums) hash.Add(n); }
            if (d.Indices is { } ix) foreach (var i in ix) hash.Add(i);
            sb.Append(hash.ToHashCode()).Append('|');
            foreach (var (k, v) in d.Uniforms(1.0).OrderBy(kv => kv.Key, StringComparer.Ordinal)) sb.Append(k).Append('=').Append(v).Append(';');
            foreach (var g in d.VertexShader.Globals.Concat(d.FragmentShader.Globals).Where(g => g.Type.StartsWith("sampler", StringComparison.Ordinal) || g.Type.StartsWith("Texture", StringComparison.Ordinal)))
            {
                sb.Append(g.Id).Append(':');
                foreach (var id in new[] { g.Id }.Concat(d.Hlsl ? d.FragmentShader.Globals.Where(s => s.Type.StartsWith("Sampler", StringComparison.Ordinal)).Select(s => g.Id + "|" + s.Id) : []))
                {
                    sb.Append(Numbers(d.Textures?.Invoke(id, 0.31, 0.27))).Append(Numbers(d.Textures?.Invoke(id, 0.77, 0.61)));
                    sb.Append(Numbers(d.CubeTextures?.Invoke(id, 0.3, 0.8, -0.5))).Append(Numbers(d.CubeTextures?.Invoke(id, -0.9, -0.2, 0.4)));
                }
            }
            sb.Append('\n');
        }
        foreach (var op in scene.Ops.Take(scene.SetupOps))
            sb.Append(op switch
            {
                ClearOp c => $"clear {c.BeforeDraw} {c.Target} {Numbers(c.Color)} {c.Depth} {c.Stencil} {c.Attachment}",
                CopyOp c => $"copy {c.BeforeDraw} {c.From} {c.To} {c.Color} {c.Depth} {c.Average}",
                _ => op.ToString(),
            }).Append('\n');
        foreach (var t in scene.Targets.Values.OrderBy(t => t.Id, StringComparer.Ordinal)) sb.Append(t).Append('\n');
        return scene.SetupKey = sb.ToString();
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
        var fragments = new FragmentBatch(stages, baseFb.Height, () => new Stages(draw, uniforms, shared ??= textures.Shared(), time, baseFb.Height, scale, yDown)) { Heavy = HasLoop(draw.FragmentShader) };
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
                // Tessellation: each patch of control points becomes the primitives the tessellator makes.
                IEnumerable<(Topology Kind, ShadedVertex[] Vertices)> Assembled()
                {
                    if (stages.HasTessellation)
                    {
                        int size = Math.Max(1, draw.PatchVertices);
                        for (int p = 0; p + size <= order.Length; p += size)
                            foreach (var made in stages.Tessellate(order[p..(p + size)].Select(Vertex).ToArray(), p / size)) yield return made;
                        yield break;
                    }
                    foreach (var primitive in Primitives(order, draw.Topology)) yield return (KindOf(draw.Topology), primitive.Select(Vertex).ToArray());
                }
                foreach (var (assembledKind, input) in Assembled())
                {
                    var output = stages.HasGeometry ? stages.Geometry(input) : [(assembledKind, input)];
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
