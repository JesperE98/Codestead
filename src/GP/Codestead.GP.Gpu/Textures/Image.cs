namespace Codestead.GP.Gpu.Textures;

/// <summary>A decoded image: RGBA bytes, top row first, and how many channels the file had (what stbi_load reports).</summary>
public sealed record Image(int Width, int Height, int Channels, byte[] Rgba)
{
    /// <summary>The rows in the opposite order (stbi_set_flip_vertically_on_load(true)).</summary>
    public Image FlippedVertically()
    {
        var flipped = new byte[Rgba.Length];
        int stride = Width * 4;
        for (int y = 0; y < Height; y++) Array.Copy(Rgba, y * stride, flipped, (Height - 1 - y) * stride, stride);
        return this with { Rgba = flipped };
    }
}
