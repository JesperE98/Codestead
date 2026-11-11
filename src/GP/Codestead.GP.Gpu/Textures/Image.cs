namespace Codestead.GP.Gpu.Textures;

/// <summary>
/// A decoded image: RGBA bytes, top row first, and how many channels the file had (what stbi_load reports). A
/// floating-point image (a rendered HDR or depth target) also has <see cref="Floats"/>: RGBA values that are not
/// limited to 0–1 or to 8 bits.
/// </summary>
public sealed record Image(int Width, int Height, int Channels, byte[] Rgba, double[]? Floats = null)
{
    /// <summary>
    /// The size in the program's own texels (0: <see cref="Width"/> × <see cref="Height"/>). A render target drawn
    /// smaller than the program made it (the preview's scale) keeps the program's size here: texelFetch / Load address
    /// its texels in the program's units (gl_FragCoord is in the program's pixels too).
    /// </summary>
    public int ProgramWidth { get; init; }
    public int ProgramHeight { get; init; }

    /// <summary>The size the program addresses the image's texels in (see <see cref="ProgramWidth"/>).</summary>
    public (int Width, int Height) ProgramSize => (ProgramWidth > 0 ? ProgramWidth : Width, ProgramHeight > 0 ? ProgramHeight : Height);

    /// <summary>The rows in the opposite order (stbi_set_flip_vertically_on_load(true)).</summary>
    public Image FlippedVertically()
    {
        var flipped = new byte[Rgba.Length];
        int stride = Width * 4;
        for (int y = 0; y < Height; y++) Array.Copy(Rgba, y * stride, flipped, (Height - 1 - y) * stride, stride);
        double[]? floats = null;
        if (Floats is not null)
        {
            floats = new double[Floats.Length];
            for (int y = 0; y < Height; y++) Array.Copy(Floats, y * stride, floats, (Height - 1 - y) * stride, stride);
        }
        return this with { Rgba = flipped, Floats = floats };
    }
}
