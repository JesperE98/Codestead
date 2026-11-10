namespace Codestead.GP.Gpu.Textures;

/// <summary>
/// Radiance HDR images (.hdr, RGBE) as stb_image's stbi_loadf reads them: three floats per pixel, linear radiance
/// that may be far above 1.0 (an environment map for image based lighting). Flat and run-length encoded scanlines.
/// </summary>
public static class RadianceHdr
{
    public static bool IsHdr(byte[] bytes) =>
        bytes.Length > 10 && bytes[0] == '#' && bytes[1] == '?' && (StartsWith(bytes, "#?RADIANCE") || StartsWith(bytes, "#?RGBE"));

    private static bool StartsWith(byte[] bytes, string text) => bytes.Length >= text.Length && text.Select((c, i) => bytes[i] == c).All(x => x);

    /// <summary>The image (top row first), with its floats; null when the file is not a readable .hdr.</summary>
    public static Image? Decode(byte[] bytes)
    {
        if (!IsHdr(bytes)) return null;
        int pos = 0;
        string? Line()
        {
            if (pos >= bytes.Length) return null;
            int start = pos;
            while (pos < bytes.Length && bytes[pos] != '\n') pos++;
            var line = System.Text.Encoding.ASCII.GetString(bytes, start, pos - start);
            pos++;
            return line;
        }
        // The header ends with an empty line; then the resolution line "-Y height +X width".
        while (Line() is { } header && header.Length > 0) { }
        var parts = (Line() ?? "").Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 4 || parts[0] != "-Y" || parts[2] != "+X" || !int.TryParse(parts[1], out int height) || !int.TryParse(parts[3], out int width)
            || width <= 0 || height <= 0 || (long)width * height > 64_000_000) return null;

        var rgbe = new byte[width * height * 4];
        for (int y = 0; y < height; y++)
        {
            int row = y * width * 4;
            // A run-length encoded scanline starts with 2, 2 and the width in two bytes; anything else is flat pixels.
            bool rle = width >= 8 && width < 32768 && pos + 4 <= bytes.Length && bytes[pos] == 2 && bytes[pos + 1] == 2 && (bytes[pos + 2] & 0x80) == 0
                && ((bytes[pos + 2] << 8) | bytes[pos + 3]) == width;
            if (!rle)
            {
                if (pos + width * 4 > bytes.Length) return null;
                Array.Copy(bytes, pos, rgbe, row, width * 4);
                pos += width * 4;
                continue;
            }
            pos += 4;
            for (int channel = 0; channel < 4; channel++)
            {
                int x = 0;
                while (x < width)
                {
                    if (pos >= bytes.Length) return null;
                    int count = bytes[pos++];
                    if (count > 128)
                    {
                        count -= 128;
                        if (pos >= bytes.Length || x + count > width) return null;
                        byte value = bytes[pos++];
                        for (int i = 0; i < count; i++) rgbe[row + (x++) * 4 + channel] = value;
                    }
                    else
                    {
                        if (count == 0 || pos + count > bytes.Length || x + count > width) return null;
                        for (int i = 0; i < count; i++) rgbe[row + (x++) * 4 + channel] = bytes[pos++];
                    }
                }
            }
        }

        var floats = new double[width * height * 4];
        var rgba = new byte[width * height * 4];
        for (int i = 0; i < width * height; i++)
        {
            int e = rgbe[i * 4 + 3];
            double scale = e == 0 ? 0 : Math.Pow(2, e - 136);   // 2^(e - 128) / 256
            for (int k = 0; k < 3; k++)
            {
                double v = rgbe[i * 4 + k] * scale;
                floats[i * 4 + k] = v;
                rgba[i * 4 + k] = (byte)Math.Round(Math.Clamp(v, 0, 1) * 255);
            }
            floats[i * 4 + 3] = 1;
            rgba[i * 4 + 3] = 255;
        }
        return new Image(width, height, 3, rgba, floats);
    }
}
