namespace Codestead.GP.Gpu.Raster;

/// <summary>
/// A storage image a compute shader writes and reads (GLSL image2D, a Vulkan storage image, an HLSL RWTexture2D): RGBA
/// floats, row 0 first (the texture's v = 0).
/// </summary>
public sealed class StorageImage(int width, int height, double[]? data = null)
{
    public int Width { get; } = width;
    public int Height { get; } = height;
    public double[] Data { get; } = data ?? new double[width * height * 4];

    /// <summary>The image as a texture image (floats, and bytes clamped to 0 … 1).</summary>
    public Textures.Image ToImage()
    {
        var bytes = new byte[Data.Length];
        for (int i = 0; i < Data.Length; i++) bytes[i] = (byte)Math.Round(Math.Clamp(double.IsNaN(Data[i]) ? 0 : Data[i], 0, 1) * 255);
        return new Textures.Image(Width, Height, 4, bytes, (double[])Data.Clone());
    }

    /// <summary>A texture image's texels as a storage image (its floats, else its bytes / 255).</summary>
    public static StorageImage From(Textures.Image? image, int width, int height)
    {
        if (image is null || image.Width != width || image.Height != height) return new StorageImage(Math.Max(1, width), Math.Max(1, height));
        var data = image.Floats is { } f && f.Length == width * height * 4 ? (double[])f.Clone() : image.Rgba.Select(b => b / 255.0).ToArray();
        return new StorageImage(width, height, data);
    }
}
