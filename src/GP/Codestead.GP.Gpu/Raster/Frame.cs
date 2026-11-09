namespace Codestead.GP.Gpu.Raster;

/// <summary>A rendered frame: BGRA pixels (top row first) and what went wrong while shading.</summary>
public sealed record Frame(int Width, int Height, byte[] Pixels, IReadOnlyList<string> Errors)
{
    /// <summary>The colour at a pixel as RGBA in 0–1 (for tests and checks).</summary>
    public double[] At(int x, int y)
    {
        int i = (y * Width + x) * 4;
        return [Pixels[i + 2] / 255.0, Pixels[i + 1] / 255.0, Pixels[i] / 255.0, Pixels[i + 3] / 255.0];
    }

    /// <summary>The colour at a point given in 0–1 of the width and height (0, 0 = top left).</summary>
    public double[] AtRelative(double x, double y) => At(Math.Clamp((int)(x * Width), 0, Width - 1), Math.Clamp((int)(y * Height), 0, Height - 1));
}
