using Codestead.GP.Gpu.Scene;

namespace Codestead.GP.Gpu.Raster;

// Rasterising triangles, lines and points into fragments, and the per-sample operations after the fragment shader:
// the stencil test, the depth test, blending and the write into the framebuffer – in the order OpenGL, Vulkan and
// Direct3D define them.
public static partial class Rasterizer
{
    /// <summary>
    /// Shades the fragments of a set-up primitive in the rows <paramref name="from"/> up to (not including)
    /// <paramref name="to"/> of its framebuffer, with <paramref name="stages"/> (those of the thread that runs it).
    /// </summary>
    private delegate void Fill(Stages stages, int from, int to);

    private static (double[] X, double[] Y, double[] Z, double[] InvW) ToScreen(ShadedVertex[] vs, Framebuffer fb, bool yDown, bool zMinusOneToOne)
    {
        int n = vs.Length;
        var sx = new double[n];
        var sy = new double[n];
        var sz = new double[n];
        var invW = new double[n];
        for (int i = 0; i < n; i++)
        {
            var c = vs[i].Clip;
            double nx = c[0] / c[3], ny = c[1] / c[3], nz = c[2] / c[3];
            sx[i] = (nx + 1) / 2 * fb.Width;
            sy[i] = yDown ? (1 + ny) / 2 * fb.Height : (1 - ny) / 2 * fb.Height;
            sz[i] = zMinusOneToOne ? (nz + 1) / 2 : nz;
            invW[i] = 1 / c[3];
        }
        return (sx, sy, sz, invW);
    }

    /// <summary>Sets up a triangle (null: culled or off screen) and the size of its bounding box in pixels.</summary>
    private static Fill? Triangle(ShadedVertex v0, ShadedVertex v1, ShadedVertex v2, DrawCall draw, Framebuffer fb, bool yDown, bool zMinusOneToOne, out long pixels)
    {
        pixels = 0;
        var vs = new[] { v0, v1, v2 };
        if (vs.Any(v => v.Clip[3] <= 1e-9)) return null;
        var (sx, sy, sz, invW) = ToScreen(vs, fb, yDown, zMinusOneToOne);
        // Signed area on screen (y down): negative means counter-clockwise as you look at the screen.
        double area = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (sy[1] - sy[0]);
        if (Math.Abs(area) < 1e-12) return null;
        bool ccw = area < 0;
        bool front = draw.FrontCcw ? ccw : !ccw;
        if (draw.Cull == CullMode.FrontAndBack || (draw.Cull == CullMode.Back && !front) || (draw.Cull == CullMode.Front && front)) return null;

        int width = fb.Width, height = fb.Height;
        int minX = Math.Max(0, (int)Math.Floor(sx.Min())), maxX = Math.Min(width - 1, (int)Math.Ceiling(sx.Max()));
        int minY = Math.Max(0, (int)Math.Floor(sy.Min())), maxY = Math.Min(height - 1, (int)Math.Ceiling(sy.Max()));
        if (minX > maxX || minY > maxY) return null;
        pixels = (long)(maxX - minX + 1) * (maxY - minY + 1);
        double[] edgeLen =
        [
            Math.Sqrt(Sq(sx[2] - sx[1]) + Sq(sy[2] - sy[1])),
            Math.Sqrt(Sq(sx[0] - sx[2]) + Sq(sy[0] - sy[2])),
            Math.Sqrt(Sq(sx[1] - sx[0]) + Sq(sy[1] - sy[0])),
        ];
        (double, double, double) Weights(double x, double y)
        {
            double w0 = ((sx[2] - sx[1]) * (y - sy[1]) - (sy[2] - sy[1]) * (x - sx[1])) / area;
            double w1 = ((sx[0] - sx[2]) * (y - sy[2]) - (sy[0] - sy[2]) * (x - sx[2])) / area;
            return (w0, w1, 1 - w0 - w1);
        }
        return (stages, from, to) =>
        {
            if (from > maxY || to <= minY) return;
            var zs = new double[fb.Samples];
            for (int py = Math.Max(minY, from); py <= maxY && py < to; py++)
            {
                for (int px = minX; px <= maxX; px++)
                {
                    int mask = 0;
                    for (int s = 0; s < fb.Samples; s++)
                    {
                        var (w0, w1, w2) = Weights(px + fb.Pattern[s].X, py + fb.Pattern[s].Y);
                        if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue;
                        mask |= 1 << s;
                        zs[s] = w0 * sz[0] + w1 * sz[1] + w2 * sz[2];
                    }
                    if (mask == 0) continue;
                    double x = px + 0.5, y = py + 0.5;
                    var (c0, c1, c2) = Weights(x, y);
                    if (draw.Wireframe)
                    {
                        double d0 = Math.Abs(c0 * area) / edgeLen[0], d1 = Math.Abs(c1 * area) / edgeLen[1], d2 = Math.Abs(c2 * area) / edgeLen[2];
                        if (Math.Min(d0, Math.Min(d1, d2)) > 0.8) continue;
                    }
                    double z = c0 * sz[0] + c1 * sz[1] + c2 * sz[2];
                    // Perspective-correct weights.
                    double p0 = c0 * invW[0], p1 = c1 * invW[1], p2 = c2 * invW[2];
                    double sum = p0 + p1 + p2;
                    p0 /= sum;
                    p1 /= sum;
                    p2 /= sum;
                    // The weights one pixel to the right and one down: how the varyings change across pixels (a GPU's
                    // derivatives, for the mip level of a texture read).
                    var (rx0, rx1, rx2) = Perspective(Weights(x + 1, y), invW);
                    var (ry0, ry1, ry2) = Perspective(Weights(x, y + 1), invW);
                    var derivatives = (rx0 - p0, rx1 - p1, rx2 - p2, ry0 - p0, ry1 - p1, ry2 - p2);
                    WriteFragment(fb, py * width + px, mask, zs, draw, stages, () => stages.Fragment(vs, p0, p1, p2, x, y, z, sum, front, derivatives));
                }
            }
        };
    }

    /// <summary>
    /// Sets up a line one pixel wide (glLineWidth beyond 1 is not part of the core profile) and the number of steps
    /// along it.
    /// </summary>
    private static (double, double, double) Perspective((double C0, double C1, double C2) c, double[] invW)
    {
        double p0 = c.C0 * invW[0], p1 = c.C1 * invW[1], p2 = c.C2 * invW[2], sum = p0 + p1 + p2;
        return sum == 0 ? (0, 0, 0) : (p0 / sum, p1 / sum, p2 / sum);
    }

    private static Fill? Line(ShadedVertex a, ShadedVertex b, DrawCall draw, Framebuffer fb, bool yDown, bool zMinusOneToOne, out long pixels)
    {
        pixels = 0;
        var vs = new[] { a, b, b };
        if (a.Clip[3] <= 1e-9 || b.Clip[3] <= 1e-9) return null;
        var (sx, sy, sz, invW) = ToScreen([a, b], fb, yDown, zMinusOneToOne);
        double dx = sx[1] - sx[0], dy = sy[1] - sy[0];
        int steps = Math.Max(1, (int)Math.Ceiling(Math.Max(Math.Abs(dx), Math.Abs(dy))));
        int full = (1 << fb.Samples) - 1;
        pixels = steps;
        return (stages, from, to) =>
        {
            var zs = new double[fb.Samples];
            int last = -1;
            // The whole line is walked; the pixels in the rows asked for are shaded.
            for (int i = 0; i < steps; i++)
            {
                double t = (i + 0.5) / steps;
                double x = sx[0] + dx * t, y = sy[0] + dy * t;
                int px = (int)Math.Floor(x), py = (int)Math.Floor(y);
                if (px < 0 || py < 0 || px >= fb.Width || py >= fb.Height) continue;
                int index = py * fb.Width + px;
                if (index == last) continue;
                last = index;
                if (py < from || py >= to) continue;
                double z = sz[0] + (sz[1] - sz[0]) * t;
                Array.Fill(zs, z);
                double q0 = (1 - t) * invW[0], q1 = t * invW[1], sum = q0 + q1;
                double p0 = q0 / sum, p1 = q1 / sum;
                WriteFragment(fb, index, full, zs, draw, stages, () => stages.Fragment(vs, p0, p1, 0, px + 0.5, py + 0.5, z, sum, true));
            }
        };
    }

    /// <summary>
    /// Sets up a point: a square of gl_PointSize (or glPointSize) pixels around the vertex (null: clipped or off
    /// screen), and the size of the square in pixels.
    /// </summary>
    private static Fill? Point(ShadedVertex v, DrawCall draw, Framebuffer fb, double scale, bool yDown, bool zMinusOneToOne, out long pixels)
    {
        pixels = 0;
        if (v.Clip[3] <= 1e-9 || NearDistance(v, zMinusOneToOne) < 0) return null;
        var (sx, sy, sz, invW) = ToScreen([v], fb, yDown, zMinusOneToOne);
        double size = (draw.ProgramPointSize && v.PointSize is { } ps ? ps : draw.PointSize) / scale;
        size = Math.Max(size, 1 / scale);
        double half = size / 2;
        var vs = new[] { v, v, v };
        int minX = Math.Max(0, (int)Math.Floor(sx[0] - half)), maxX = Math.Min(fb.Width - 1, (int)Math.Ceiling(sx[0] + half));
        int minY = Math.Max(0, (int)Math.Floor(sy[0] - half)), maxY = Math.Min(fb.Height - 1, (int)Math.Ceiling(sy[0] + half));
        if (minX > maxX || minY > maxY) return null;
        pixels = (long)(maxX - minX + 1) * (maxY - minY + 1);
        return (stages, from, to) =>
        {
            if (from > maxY || to <= minY) return;
            var zs = new double[fb.Samples];
            Array.Fill(zs, sz[0]);
            for (int py = Math.Max(minY, from); py <= maxY && py < to; py++)
                for (int px = minX; px <= maxX; px++)
                {
                    int mask = 0;
                    for (int s = 0; s < fb.Samples; s++)
                    {
                        double x = px + fb.Pattern[s].X, y = py + fb.Pattern[s].Y;
                        if (x >= sx[0] - half && x < sx[0] + half && y >= sy[0] - half && y < sy[0] + half) mask |= 1 << s;
                    }
                    if (mask == 0) continue;
                    int cx = px, cy = py;
                    WriteFragment(fb, py * fb.Width + px, mask, zs, draw, stages, () => stages.Fragment(vs, 1, 0, 0, cx + 0.5, cy + 0.5, sz[0], invW[0], true));
                }
        };
    }

    /// <summary>
    /// The per-sample operations for a fragment covering the samples in <paramref name="mask"/>: depth clipping, the
    /// stencil test, the depth test, the stencil update, the depth write, blending and the colour write. The fragment
    /// shader runs once (<paramref name="shade"/>; null = discarded) – and not at all when every sample fails a test
    /// that changes nothing.
    /// </summary>
    private static void WriteFragment(Framebuffer fb, int pixel, int mask, double[] zs, DrawCall draw, Stages stages, Func<double[]?[]?> shade)
    {
        // A fragment shader that writes its depth (gl_FragDepth, SV_Depth): it runs first, its depth is tested.
        if (stages.WritesDepth)
        {
            if (mask == 0) return;
            var shaded = shade();
            if (shaded is null || stages.FragDepth is not double written) return;
            zs = Enumerable.Repeat(written, zs.Length).ToArray();
            var once = shaded;
            shade = () => once;
        }
        int samples = fb.Samples;
        for (int s = 0; s < samples; s++)
            if ((mask & (1 << s)) != 0 && (zs[s] < -1e-7 || zs[s] > 1 + 1e-7)) mask &= ~(1 << s);
        if (mask == 0) return;
        var stencil = draw.Stencil;
        bool Passes(int idx, int s) =>
            (stencil is null || StencilPasses(stencil, fb.Stencil[idx])) && (!draw.DepthTest || !fb.HasDepth || Compare(draw.DepthFunc, zs[s], fb.Depth[idx]));
        bool sideEffectsOnFail = stencil is not null && (stencil.StencilFail != StencilOp.Keep || stencil.DepthFail != StencilOp.Keep);
        if (!sideEffectsOnFail)
        {
            bool any = false;
            for (int s = 0; s < samples && !any; s++)
                if ((mask & (1 << s)) != 0 && Passes(pixel * samples + s, s)) any = true;
            if (!any) return;
        }
        var colors = shade();
        if (colors is null) return;
        stages.Log?.Before(fb, pixel);
        for (int s = 0; s < samples; s++)
        {
            if ((mask & (1 << s)) == 0) continue;
            int idx = pixel * samples + s;
            if (stencil is not null && !StencilPasses(stencil, fb.Stencil[idx]))
            {
                UpdateStencil(fb, idx, stencil, stencil.StencilFail);
                continue;
            }
            if (draw.DepthTest && fb.HasDepth && !Compare(draw.DepthFunc, zs[s], fb.Depth[idx]))
            {
                if (stencil is not null) UpdateStencil(fb, idx, stencil, stencil.DepthFail);
                continue;
            }
            if (stencil is not null) UpdateStencil(fb, idx, stencil, stencil.Pass);
            if (draw.DepthTest && draw.DepthWrite && fb.HasDepth) fb.Depth[idx] = Math.Clamp(zs[s], 0, 1);
            for (int a = 0; a < fb.Colors.Length && a < colors.Length; a++)
                if (colors[a] is { } color) WriteColor(fb, fb.Colors[a], idx * 4, color, draw, draw.AttachmentBlends is { } blends && a < blends.Count ? blends[a] : draw.Blend);
        }
    }

    private static bool Compare(CompareFunc func, double value, double stored) => func switch
    {
        CompareFunc.Never => false,
        CompareFunc.Less => value < stored,
        CompareFunc.Equal => Math.Abs(value - stored) < 1e-9,
        CompareFunc.LessEqual => value <= stored + 1e-9,
        CompareFunc.Greater => value > stored,
        CompareFunc.NotEqual => Math.Abs(value - stored) >= 1e-9,
        CompareFunc.GreaterEqual => value >= stored - 1e-9,
        _ => true,
    };

    private static bool StencilPasses(StencilState st, int stored)
    {
        int r = st.Ref & st.ReadMask, v = stored & st.ReadMask;
        return st.Func switch
        {
            CompareFunc.Never => false,
            CompareFunc.Less => r < v,
            CompareFunc.Equal => r == v,
            CompareFunc.LessEqual => r <= v,
            CompareFunc.Greater => r > v,
            CompareFunc.NotEqual => r != v,
            CompareFunc.GreaterEqual => r >= v,
            _ => true,
        };
    }

    private static void UpdateStencil(Framebuffer fb, int idx, StencilState st, StencilOp op)
    {
        int old = fb.Stencil[idx];
        int value = op switch
        {
            StencilOp.Zero => 0,
            StencilOp.Replace => st.Ref,
            StencilOp.Increment => Math.Min(255, old + 1),
            StencilOp.IncrementWrap => (old + 1) & 0xFF,
            StencilOp.Decrement => Math.Max(0, old - 1),
            StencilOp.DecrementWrap => (old - 1) & 0xFF,
            StencilOp.Invert => ~old & 0xFF,
            _ => old,
        };
        fb.Stencil[idx] = ((old & ~st.WriteMask) | (value & st.WriteMask)) & 0xFF;
    }

    private static void WriteColor(Framebuffer fb, double[] buffer, int o, double[] src, DrawCall draw, BlendState? blend)
    {
        // A vec3 output leaves alpha at 1.
        double[] s = [src.Length > 0 ? src[0] : 0, src.Length > 1 ? src[1] : 0, src.Length > 2 ? src[2] : 0, src.Length > 3 ? src[3] : 1];
        if (!fb.Float)
            for (int k = 0; k < 4; k++) s[k] = Math.Clamp(double.IsNaN(s[k]) ? 0 : s[k], 0, 1);
        var result = s;
        if (blend is { } b)
        {
            double[] d = [buffer[o], buffer[o + 1], buffer[o + 2], buffer[o + 3]];
            var constant = b.Constant ?? [0, 0, 0, 0];
            result = new double[4];
            for (int k = 0; k < 4; k++)
            {
                bool alpha = k == 3;
                double fs = Factor(alpha ? b.SrcAlpha : b.SrcColor, k, s, d, constant);
                double fd = Factor(alpha ? b.DstAlpha : b.DstColor, k, s, d, constant);
                result[k] = (alpha ? b.AlphaOp : b.ColorOp) switch
                {
                    BlendOp.Subtract => s[k] * fs - d[k] * fd,
                    BlendOp.ReverseSubtract => d[k] * fd - s[k] * fs,
                    BlendOp.Min => Math.Min(s[k], d[k]),
                    BlendOp.Max => Math.Max(s[k], d[k]),
                    _ => s[k] * fs + d[k] * fd,
                };
            }
        }
        for (int k = 0; k < 4; k++)
            if (k >= draw.ColorMask.Length || draw.ColorMask[k])
                buffer[o + k] = fb.Float ? result[k] : Math.Clamp(double.IsNaN(result[k]) ? 0 : result[k], 0, 1);
    }

    private static double Factor(BlendFactor f, int k, double[] s, double[] d, double[] c) => f switch
    {
        BlendFactor.Zero => 0,
        BlendFactor.One => 1,
        BlendFactor.SrcColor => s[k],
        BlendFactor.OneMinusSrcColor => 1 - s[k],
        BlendFactor.DstColor => d[k],
        BlendFactor.OneMinusDstColor => 1 - d[k],
        BlendFactor.SrcAlpha => s[3],
        BlendFactor.OneMinusSrcAlpha => 1 - s[3],
        BlendFactor.DstAlpha => d[3],
        BlendFactor.OneMinusDstAlpha => 1 - d[3],
        BlendFactor.ConstantColor => c[k],
        BlendFactor.OneMinusConstantColor => 1 - c[k],
        BlendFactor.ConstantAlpha => c[3],
        BlendFactor.OneMinusConstantAlpha => 1 - c[3],
        _ => 1,
    };
}
