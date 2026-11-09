namespace Codestead.GP.Gpu.Textures;

/// <summary>
/// A texture as the simulated GPU samples it: an image and a sampler state. Texture coordinate v = 0 is the first row
/// of the uploaded data (the top of the file, unless it was flipped when loaded – OpenGL programs flip it, because
/// OpenGL puts v = 0 at the bottom of an image).
/// </summary>
public sealed class Texture(Image image, SamplerState sampler)
{
    public Image Image { get; } = image;
    public SamplerState Sampler { get; } = sampler;
    /// <summary>The colour channels the shader sees (3: alpha reads as 1).</summary>
    public int Components { get; init; } = 4;

    public double[] Sample(double u, double v)
    {
        int w = Image.Width, h = Image.Height;
        if (!Sampler.Linear)
            return Texel(Coord(u * w - 0.5 + 0.5, w, Sampler.WrapS, out var outS), Coord(v * h, h, Sampler.WrapT, out var outT), outS || outT);
        double x = u * w - 0.5, y = v * h - 0.5;
        int x0 = (int)Math.Floor(x), y0 = (int)Math.Floor(y);
        double fx = x - x0, fy = y - y0;
        var r = new double[4];
        for (int dy = 0; dy <= 1; dy++)
            for (int dx = 0; dx <= 1; dx++)
            {
                double weight = (dx == 0 ? 1 - fx : fx) * (dy == 0 ? 1 - fy : fy);
                if (weight == 0) continue;
                var t = Texel(Coord(x0 + dx + 0.5, w, Sampler.WrapS, out var o1), Coord(y0 + dy + 0.5, h, Sampler.WrapT, out var o2), o1 || o2);
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

    private double[] Texel(int x, int y, bool outside)
    {
        if (outside) return Sampler.Border ?? [0, 0, 0, 0];
        int i = (y * Image.Width + x) * 4;
        var d = Image.Rgba;
        return [d[i] / 255.0, d[i + 1] / 255.0, d[i + 2] / 255.0, Components == 4 ? d[i + 3] / 255.0 : 1.0];
    }
}
