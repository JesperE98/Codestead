using System.IO.Compression;

namespace Codestead.GP.Gpu.Textures;

/// <summary>
/// Decodes PNG files (8 bits per channel: grey, grey + alpha, RGB, RGBA and palette, not interlaced) into RGBA –
/// enough for the course's images, with no dependency on a UI toolkit.
/// </summary>
public static class Png
{
    public static Image? Decode(byte[] data)
    {
        try
        {
            return DecodeOrThrow(data);
        }
        catch (Exception e) when (e is InvalidDataException or IndexOutOfRangeException or ArgumentException or OverflowException)
        {
            return null;
        }
    }

    private static Image? DecodeOrThrow(byte[] data)
    {
        byte[] signature = [137, 80, 78, 71, 13, 10, 26, 10];
        if (data.Length < 8 || !data.AsSpan(0, 8).SequenceEqual(signature)) return null;
        int pos = 8, width = 0, height = 0, colorType = 0, bitDepth = 0, interlace = 0;
        byte[]? palette = null, transparency = null;
        using var idat = new MemoryStream();
        while (pos + 8 <= data.Length)
        {
            int length = (data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3];
            var type = System.Text.Encoding.ASCII.GetString(data, pos + 4, 4);
            int body = pos + 8;
            switch (type)
            {
                case "IHDR":
                    width = Int(data, body);
                    height = Int(data, body + 4);
                    bitDepth = data[body + 8];
                    colorType = data[body + 9];
                    interlace = data[body + 12];
                    break;
                case "PLTE":
                    palette = data[body..(body + length)];
                    break;
                case "tRNS":
                    transparency = data[body..(body + length)];
                    break;
                case "IDAT":
                    idat.Write(data, body, length);
                    break;
                case "IEND":
                    pos = data.Length;
                    continue;
            }
            pos = body + length + 4;
        }
        if (bitDepth != 8 || interlace != 0 || width <= 0 || height <= 0) return null;
        int channels = colorType switch { 0 => 1, 2 => 3, 3 => 1, 4 => 2, 6 => 4, _ => 0 };
        if (channels == 0) return null;
        idat.Position = 0;
        using var z = new ZLibStream(idat, CompressionMode.Decompress);
        using var raw = new MemoryStream();
        z.CopyTo(raw);
        var bytes = raw.ToArray();
        int stride = width * channels;
        var pixels = new byte[stride * height];
        var previous = new byte[stride];
        for (int y = 0; y < height; y++)
        {
            int filter = bytes[y * (stride + 1)];
            var line = bytes.AsSpan(y * (stride + 1) + 1, stride);
            var output = pixels.AsSpan(y * stride, stride);
            for (int x = 0; x < stride; x++)
            {
                int a = x >= channels ? output[x - channels] : 0, b = previous[x], c = x >= channels ? previous[x - channels] : 0;
                int v = line[x] + filter switch
                {
                    1 => a,
                    2 => b,
                    3 => (a + b) / 2,
                    4 => Paeth(a, b, c),
                    _ => 0,
                };
                output[x] = (byte)v;
            }
            output.CopyTo(previous);
        }
        var rgba = new byte[width * height * 4];
        for (int i = 0; i < width * height; i++)
        {
            byte r, g, b, al = 255;
            switch (colorType)
            {
                case 0: r = g = b = pixels[i]; break;
                case 4: r = g = b = pixels[i * 2]; al = pixels[i * 2 + 1]; break;
                case 2: r = pixels[i * 3]; g = pixels[i * 3 + 1]; b = pixels[i * 3 + 2]; break;
                case 3:
                    int p = pixels[i];
                    r = palette![p * 3]; g = palette[p * 3 + 1]; b = palette[p * 3 + 2];
                    if (transparency is not null && p < transparency.Length) al = transparency[p];
                    break;
                default: r = pixels[i * 4]; g = pixels[i * 4 + 1]; b = pixels[i * 4 + 2]; al = pixels[i * 4 + 3]; break;
            }
            rgba[i * 4] = r;
            rgba[i * 4 + 1] = g;
            rgba[i * 4 + 2] = b;
            rgba[i * 4 + 3] = al;
        }
        return new Image(width, height, colorType is 4 or 6 || (colorType == 3 && transparency is not null) ? 4 : colorType is 0 ? 1 : 3, rgba);
    }

    private static int Int(byte[] d, int at) => (d[at] << 24) | (d[at + 1] << 16) | (d[at + 2] << 8) | d[at + 3];

    private static int Paeth(int a, int b, int c)
    {
        int p = a + b - c, pa = Math.Abs(p - a), pb = Math.Abs(p - b), pc = Math.Abs(p - c);
        return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    }
}
