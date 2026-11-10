namespace Codestead.GP.Gpu.Textures;

/// <summary>
/// A texture as the simulated GPU samples it: an image and a sampler state. Texture coordinate v = 0 is the first row
/// of the uploaded data (the top of the file, unless it was flipped when loaded – OpenGL programs flip it, because
/// OpenGL puts v = 0 at the bottom of an image).
/// </summary>
public sealed class Texture
{
    private static readonly Image Empty = new(1, 1, 4, [0, 0, 0, 255]);
    private readonly Image? image;
    private readonly Func<Image?>? source;

    public Texture(Image image, SamplerState sampler)
    {
        this.image = image;
        Sampler = sampler;
    }

    /// <summary>A texture whose image is made while the frame renders (a render target's colour or depth).</summary>
    public Texture(Func<Image?> source, SamplerState sampler)
    {
        this.source = source;
        Sampler = sampler;
    }

    public Image Image => image ?? source?.Invoke() ?? Empty;
    public SamplerState Sampler { get; }
    /// <summary>The colour channels the shader sees (3: alpha reads as 1).</summary>
    public int Components { get; init; } = 4;

    /// <summary>
    /// An sRGB texture (GL_SRGB, VK_FORMAT_R8G8B8A8_SRGB, DXGI_FORMAT_R8G8B8A8_UNORM_SRGB): sampling returns the
    /// colours decoded to linear values (alpha stays as stored).
    /// </summary>
    public bool Srgb { get; init; }

    private static readonly double[] SrgbToLinear = Enumerable.Range(0, 256).Select(i => Raster.SrgbCurve.ToLinear(i / 255.0)).ToArray();

    /// <summary>
    /// The texture has mip levels (glGenerateMipmap with a *_MIPMAP_* minification filter; a Vulkan image whose levels
    /// were blitted): a minified texture is read from the smaller levels, as a GPU does, instead of from level 0.
    /// </summary>
    public bool Mipmapped { get; init; }

    /// <summary>Blend the two nearest levels (GL_LINEAR_MIPMAP_LINEAR, VK_SAMPLER_MIPMAP_MODE_LINEAR); else the nearest.</summary>
    public bool MipLinear { get; init; } = true;

    /// <summary>
    /// How the texture coordinates change from one pixel of the window to the next where the fragment being shaded
    /// reads (du/dx, dv/dx, du/dy, dv/dy, in the program's own pixels), set by the shader runner around a texture() call:
    /// a GPU picks the mip level from it. Null: level 0.
    /// </summary>
    [ThreadStatic] internal static (double DuDx, double DvDx, double DuDy, double DvDy)? Footprint;

    private static readonly System.Runtime.CompilerServices.ConditionalWeakTable<Image, Image[]> MipChains = new();

    /// <summary>Level 0 and the smaller levels (each the average of 2 × 2 texels of the one above), made once per image.</summary>
    private Image[] Levels(Image img)
    {
        if (MipChains.TryGetValue(img, out var levels)) return levels;
        lock (MipChains)
        {
            if (MipChains.TryGetValue(img, out levels)) return levels;
            var list = new List<Image> { img };
            var current = img;
            // Linear values (an sRGB texture's colours decoded first, as a GPU filters them), as floats.
            var values = new double[current.Width * current.Height * 4];
            for (int i = 0; i < current.Width * current.Height; i++)
            {
                var t = Texel(current, i % current.Width, i / current.Width, false);
                for (int k = 0; k < 4; k++) values[i * 4 + k] = t[k];
            }
            int w = current.Width, h = current.Height;
            while (w > 1 || h > 1)
            {
                int nw = Math.Max(1, w / 2), nh = Math.Max(1, h / 2);
                var next = new double[nw * nh * 4];
                var bytes = new byte[nw * nh * 4];
                for (int y = 0; y < nh; y++)
                    for (int x = 0; x < nw; x++)
                        for (int k = 0; k < 4; k++)
                        {
                            double sum = 0;
                            int n = 0;
                            for (int dy = 0; dy < 2; dy++)
                                for (int dx = 0; dx < 2; dx++)
                                {
                                    int sx = Math.Min(w - 1, x * 2 + dx), sy = Math.Min(h - 1, y * 2 + dy);
                                    sum += values[(sy * w + sx) * 4 + k];
                                    n++;
                                }
                            next[(y * nw + x) * 4 + k] = sum / n;
                            bytes[(y * nw + x) * 4 + k] = (byte)Math.Round(Math.Clamp(sum / n, 0, 1) * 255);
                        }
                list.Add(new Image(nw, nh, 4, bytes, next));
                (values, w, h) = (next, nw, nh);
            }
            levels = list.ToArray();
            MipChains.AddOrUpdate(img, levels);
            return levels;
        }
    }

    public double[] Sample(double u, double v)
    {
        var img = Image;
        if (Mipmapped && Footprint is { } f && img.Width * img.Height > 1)
        {
            // The level of detail: log2 of how many texels one pixel covers (the longer of its two directions).
            double rx = Math.Sqrt(Sq(f.DuDx * img.Width) + Sq(f.DvDx * img.Height)), ry = Math.Sqrt(Sq(f.DuDy * img.Width) + Sq(f.DvDy * img.Height));
            double lod = Math.Log2(Math.Max(rx, ry));
            if (lod > 0 && !double.IsNaN(lod))
            {
                var levels = Levels(img);
                lod = Math.Min(lod, levels.Length - 1);
                if (!MipLinear) return SampleLevel(levels[(int)Math.Round(lod)], u, v);
                int lower = (int)Math.Floor(lod);
                double t = lod - lower;
                var a = SampleLevel(levels[lower], u, v);
                if (t <= 0 || lower + 1 >= levels.Length) return a;
                var b = SampleLevel(levels[lower + 1], u, v);
                for (int k = 0; k < 4; k++) a[k] += (b[k] - a[k]) * t;
                return a;
            }
        }
        return SampleLevel(img, u, v);
    }

    private static double Sq(double x) => x * x;

    /// <summary>Bilinear (or nearest) filtering in one level; a smaller level holds linear values already.</summary>
    private double[] SampleLevel(Image img, double u, double v)
    {
        int w = img.Width, h = img.Height;
        if (!Sampler.Linear)
            return Texel(img, Coord(u * w - 0.5 + 0.5, w, Sampler.WrapS, out var outS), Coord(v * h, h, Sampler.WrapT, out var outT), outS || outT);
        double x = u * w - 0.5, y = v * h - 0.5;
        int x0 = (int)Math.Floor(x), y0 = (int)Math.Floor(y);
        double fx = x - x0, fy = y - y0;
        var r = new double[4];
        for (int dy = 0; dy <= 1; dy++)
            for (int dx = 0; dx <= 1; dx++)
            {
                double weight = (dx == 0 ? 1 - fx : fx) * (dy == 0 ? 1 - fy : fy);
                if (weight == 0) continue;
                var t = Texel(img, Coord(x0 + dx + 0.5, w, Sampler.WrapS, out var o1), Coord(y0 + dy + 0.5, h, Sampler.WrapT, out var o2), o1 || o2);
                for (int k = 0; k < 4; k++) r[k] += weight * t[k];
            }
        return r;
    }

    /// <summary>The texel index for a coordinate in texels, after wrapping; <paramref name="outside"/> for the border colour.</summary>
    private static int Coord(double t, int size, Wrap wrap, out bool outside)
    {
        outside = false;
        int i = (int)Math.Floor(t);
        switch (wrap)
        {
            case Wrap.Repeat:
                return ((i % size) + size) % size;
            case Wrap.MirroredRepeat:
            {
                int period = 2 * size;
                int m = ((i % period) + period) % period;
                return m < size ? m : period - 1 - m;
            }
            case Wrap.ClampToBorder:
                outside = i < 0 || i >= size;
                return Math.Clamp(i, 0, size - 1);
            default:
                return Math.Clamp(i, 0, size - 1);
        }
    }

    /// <summary>The texel at integer coordinates (texelFetch, Load).</summary>
    public double[] Fetch(int x, int y)
    {
        var img = Image;
        return Texel(img, Math.Clamp(x, 0, img.Width - 1), Math.Clamp(y, 0, img.Height - 1), x < 0 || y < 0 || x >= img.Width || y >= img.Height);
    }

    private double[] Texel(Image img, int x, int y, bool outside)
    {
        if (outside) return Sampler.Border ?? [0, 0, 0, 0];
        int i = (y * img.Width + x) * 4;
        if (img.Floats is { } f) return [f[i], f[i + 1], f[i + 2], Components == 4 ? f[i + 3] : 1.0];
        var d = img.Rgba;
        if (Srgb) return [SrgbToLinear[d[i]], SrgbToLinear[d[i + 1]], SrgbToLinear[d[i + 2]], Components == 4 ? d[i + 3] / 255.0 : 1.0];
        return [d[i] / 255.0, d[i + 1] / 255.0, d[i + 2] / 255.0, Components == 4 ? d[i + 3] / 255.0 : 1.0];
    }
}
