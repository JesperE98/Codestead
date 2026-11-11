using Codestead.GP.Gpu.Textures;

namespace Codestead.GP.Gpu.Raster;

/// <summary>
/// The memory a frame is drawn into: colour (RGBA as numbers), depth and stencil, with one or more samples per pixel
/// (multisampling). Rows are stored top row first, as they appear on the screen.
/// </summary>
internal sealed class Framebuffer
{
    public int Width { get; }
    public int Height { get; }
    public int Samples { get; }
    /// <summary>Floating-point colour (GL_RGBA16F …): not clamped to 0–1.</summary>
    public bool Float { get; }
    public bool HasColor => Colors.Length > 0;
    /// <summary>The colour attachments (several for multiple render targets: a G-buffer).</summary>
    public double[][] Colors { get; }
    public double[] Color => Colors[0];
    public double[] Depth { get; }
    public int[] Stencil { get; }
    /// <summary>Sample positions inside a pixel (0–1), the standard 4× pattern for multisampling.</summary>
    public (double X, double Y)[] Pattern { get; }

    /// <summary>The channels each colour attachment keeps (R8: 1); null: all four.</summary>
    public IReadOnlyList<int>? Channels { get; init; }

    /// <summary>A depth attachment: without one (a ping-pong blur target) the depth test and depth writes do nothing.</summary>
    public bool HasDepth { get; init; } = true;

    /// <param name="depthOf">A framebuffer of the same size whose depth and stencil this one uses (one depth texture
    /// attached to two framebuffers).</param>
    public Framebuffer(int width, int height, int samples = 1, bool isFloat = false, int attachments = 1, Framebuffer? depthOf = null)
    {
        Width = width;
        Height = height;
        Samples = samples <= 1 ? 1 : samples >= 4 ? 4 : 2;
        Float = isFloat;
        Colors = Enumerable.Range(0, Math.Max(0, attachments)).Select(_ => new double[width * height * Samples * 4]).ToArray();
        if (depthOf is not null && depthOf.Width == width && depthOf.Height == height && depthOf.Samples == Samples)
        {
            Depth = depthOf.Depth;
            Stencil = depthOf.Stencil;
        }
        else
        {
            Depth = new double[width * height * Samples];
            Stencil = new int[width * height * Samples];
            Array.Fill(Depth, 1.0);
        }
        Pattern = Samples switch
        {
            1 => [(0.5, 0.5)],
            2 => [(0.75, 0.75), (0.25, 0.25)],
            _ => [(0.375, 0.125), (0.875, 0.375), (0.125, 0.625), (0.625, 0.875)],
        };
    }

    public void Clear(double[]? color, double? depth, int? stencil, int? attachment = null)
    {
        if (color is not null)
        {
            var c = color.Length >= 4 ? color : [.. color, .. new double[4 - color.Length]];
            foreach (var buffer in attachment is int only ? Colors.Skip(only).Take(1) : Colors)
                for (int i = 0; i < buffer.Length; i += 4)
                    for (int k = 0; k < 4; k++) buffer[i + k] = Float ? c[k] : Math.Clamp(c[k], 0, 1);
        }
        if (depth is { } d) Array.Fill(Depth, Math.Clamp(d, 0, 1));
        if (stencil is { } s) Array.Fill(Stencil, s & 0xFF);
    }

    /// <summary>The colour of a pixel: the average of its samples (what a multisample resolve gives).</summary>
    public double[] Resolved(int x, int y, int attachment = 0)
    {
        var r = new double[4];
        if (attachment >= Colors.Length) return r;
        var color = Colors[attachment];
        int baseIndex = (y * Width + x) * Samples;
        for (int s = 0; s < Samples; s++)
            for (int k = 0; k < 4; k++) r[k] += color[(baseIndex + s) * 4 + k];
        for (int k = 0; k < 4; k++) r[k] /= Samples;
        return r;
    }

    /// <summary>
    /// The colour as a texture image. <paramref name="bottomUp"/>: OpenGL's texture row 0 is the bottom of what was
    /// drawn, Vulkan's and Direct3D's is the top.
    /// </summary>
    public Image ColorImage(bool bottomUp, int attachment = 0)
    {
        var bytes = new byte[Width * Height * 4];
        var floats = Float ? new double[Width * Height * 4] : null;
        int kept = Channels is { } channels && attachment < channels.Count ? channels[attachment] : 4;
        for (int y = 0; y < Height; y++)
            for (int x = 0; x < Width; x++)
            {
                var c = Resolved(x, y, attachment);
                // A format without green, blue or alpha reads them as 0, 0 and 1.
                if (kept < 4)
                    for (int k = kept; k < 4; k++) c[k] = k == 3 ? 1 : 0;
                int row = bottomUp ? Height - 1 - y : y;
                int i = (row * Width + x) * 4;
                for (int k = 0; k < 4; k++)
                {
                    bytes[i + k] = (byte)Math.Round(Math.Clamp(double.IsNaN(c[k]) ? 0 : c[k], 0, 1) * 255);
                    if (floats is not null) floats[i + k] = c[k];
                }
            }
        // An 8-bit target is read back as 8-bit values, like a real one.
        return new Image(Width, Height, 4, bytes, floats ?? ToDoubles(bytes));
    }

    /// <summary>The depth as a texture image (the depth in every channel, alpha 1), for shadow maps and depth views.</summary>
    public Image DepthImage(bool bottomUp)
    {
        var bytes = new byte[Width * Height * 4];
        var floats = new double[Width * Height * 4];
        for (int y = 0; y < Height; y++)
            for (int x = 0; x < Width; x++)
            {
                double d = Depth[(y * Width + x) * Samples];
                int row = bottomUp ? Height - 1 - y : y;
                int i = (row * Width + x) * 4;
                for (int k = 0; k < 3; k++)
                {
                    floats[i + k] = d;
                    bytes[i + k] = (byte)Math.Round(d * 255);
                }
                floats[i + 3] = 1;
                bytes[i + 3] = 255;
            }
        return new Image(Width, Height, 4, bytes, floats);
    }

    /// <summary>
    /// A smaller copy of another framebuffer's colour: each pixel the average of the pixels it covers there (a mip
    /// level made from the level above).
    /// </summary>
    private void AverageFrom(Framebuffer other)
    {
        for (int a = 0; a < Colors.Length; a++)
            for (int y = 0; y < Height; y++)
            {
                int y0 = y * other.Height / Height, y1 = Math.Max(y0 + 1, (y + 1) * other.Height / Height);
                for (int x = 0; x < Width; x++)
                {
                    int x0 = x * other.Width / Width, x1 = Math.Max(x0 + 1, (x + 1) * other.Width / Width);
                    var sum = new double[4];
                    int count = 0;
                    for (int sy = y0; sy < y1 && sy < other.Height; sy++)
                        for (int sx = x0; sx < x1 && sx < other.Width; sx++)
                        {
                            var c = other.Resolved(sx, sy, a);
                            for (int k = 0; k < 4; k++) sum[k] += c[k];
                            count++;
                        }
                    for (int s = 0; s < Samples; s++)
                        for (int k = 0; k < 4; k++)
                        {
                            double v = count == 0 ? 0 : sum[k] / count;
                            Colors[a][((y * Width + x) * Samples + s) * 4 + k] = Float ? v : Math.Clamp(v, 0, 1);
                        }
                }
            }
    }

    private static double[] ToDoubles(byte[] bytes) => bytes.Select(b => b / 255.0).ToArray();

    /// <summary>Copies (and resolves or scales) another framebuffer's colour into this one, like glBlitFramebuffer.</summary>
    public void CopyFrom(Framebuffer other, bool color = true, bool depth = false, bool average = false)
    {
        if (average && color)
        {
            AverageFrom(other);
            color = false;
        }
        if (depth)
            for (int y = 0; y < Height; y++)
                for (int x = 0; x < Width; x++)
                {
                    int sx = Math.Min(other.Width - 1, x * other.Width / Width), sy = Math.Min(other.Height - 1, y * other.Height / Height);
                    int from = (sy * other.Width + sx) * other.Samples;
                    for (int s = 0; s < Samples; s++)
                    {
                        Depth[(y * Width + x) * Samples + s] = other.Depth[from];
                        Stencil[(y * Width + x) * Samples + s] = other.Stencil[from];
                    }
                }
        if (!color) return;
        for (int a = 0; a < Colors.Length; a++)
            for (int y = 0; y < Height; y++)
                for (int x = 0; x < Width; x++)
                {
                    int sx = Math.Min(other.Width - 1, x * other.Width / Width), sy = Math.Min(other.Height - 1, y * other.Height / Height);
                    var c = other.Resolved(sx, sy, a);
                    for (int s = 0; s < Samples; s++)
                        for (int k = 0; k < 4; k++) Colors[a][((y * Width + x) * Samples + s) * 4 + k] = Float ? c[k] : Math.Clamp(c[k], 0, 1);
                }
    }
}
