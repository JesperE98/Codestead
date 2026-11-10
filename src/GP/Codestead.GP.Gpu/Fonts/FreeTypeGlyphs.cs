using System.Security.Cryptography;
using System.Text.Json;

namespace Codestead.GP.Gpu.Fonts;

/// <summary>
/// The simulator's stand-in for FreeType: what FT_Load_Char(face, c, FT_LOAD_RENDER) gives for the fonts the course
/// ships, at the pixel sizes it uses – made with FreeType itself (content/textures/make_practice.py) and found by the
/// font file's SHA-256, so a font the simulator does not know is reported as one it cannot load.
/// </summary>
public static class FreeTypeGlyphs
{
    /// <summary>One rendered glyph: the 8-bit coverage bitmap (rows top first) and its metrics in pixels (advance in 1/64).</summary>
    public sealed record Glyph(int Width, int Rows, int Pitch, int Left, int Top, int Advance, byte[] Bitmap);

    private sealed record Font(string Sha256, Dictionary<int, Dictionary<int, Glyph>> Sizes);

    private static readonly Lazy<List<Font>> Fonts = new(Load);

    private static List<Font> Load()
    {
        var list = new List<Font>();
        var assembly = typeof(FreeTypeGlyphs).Assembly;
        foreach (var name in assembly.GetManifestResourceNames().Where(n => n.StartsWith("fonts/", StringComparison.Ordinal) && n.EndsWith(".glyphs.json", StringComparison.Ordinal)))
        {
            using var stream = assembly.GetManifestResourceStream(name)!;
            using var doc = JsonDocument.Parse(stream);
            var sizes = new Dictionary<int, Dictionary<int, Glyph>>();
            foreach (var size in doc.RootElement.GetProperty("sizes").EnumerateObject())
            {
                var glyphs = new Dictionary<int, Glyph>();
                foreach (var g in size.Value.EnumerateObject())
                {
                    var v = g.Value;
                    glyphs[int.Parse(g.Name)] = new Glyph(v.GetProperty("width").GetInt32(), v.GetProperty("rows").GetInt32(), v.GetProperty("pitch").GetInt32(),
                        v.GetProperty("left").GetInt32(), v.GetProperty("top").GetInt32(), v.GetProperty("advance").GetInt32(), Convert.FromBase64String(v.GetProperty("bitmap").GetString() ?? ""));
                }
                sizes[int.Parse(size.Name)] = glyphs;
            }
            list.Add(new Font(doc.RootElement.GetProperty("sha256").GetString() ?? "", sizes));
        }
        return list;
    }

    /// <summary>The font id of a font file the simulator knows (its SHA-256), or null.</summary>
    public static string? Identify(byte[] fontFile)
    {
        var hash = Convert.ToHexStringLower(SHA256.HashData(fontFile));
        return Fonts.Value.Any(f => f.Sha256 == hash) ? hash : null;
    }

    /// <summary>The pixel sizes known for a font.</summary>
    public static IReadOnlyCollection<int> SizesOf(string font) => Fonts.Value.FirstOrDefault(f => f.Sha256 == font)?.Sizes.Keys ?? (IReadOnlyCollection<int>)[];

    /// <summary>A character at a pixel size, or null when the font, the size or the character is not in the table.</summary>
    public static Glyph? Get(string font, int pixelSize, int character) =>
        Fonts.Value.FirstOrDefault(f => f.Sha256 == font) is { } f && f.Sizes.TryGetValue(pixelSize, out var glyphs) && glyphs.TryGetValue(character, out var g) ? g : null;
}
