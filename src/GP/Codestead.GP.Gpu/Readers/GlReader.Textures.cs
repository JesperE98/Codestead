using Codestead.GP.Gpu.Scene;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Readers;

// glTexImage2D and the images it reads: the bound texture, stb_image's data, formats with other channel counts.
public sealed partial class GlReader
{
    private GlState.TextureObject? BoundTexture => namedTexture ??
        (gl.Units.TryGetValue(gl.ActiveUnit, out var name) && gl.TextureObjects.TryGetValue(name, out var t) ? t : null);

    /// <summary>
    /// glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, data): the image stb_image loaded
    /// into <c>data</c>. A format with another number of channels than the data reads the bytes wrongly, as on a real GPU.
    /// </summary>
    private void TexImage(IReadOnlyList<string> a, int line)
    {
        if (BoundTexture is not { } tex || a.Count < 9)
        {
            scene.Notes.Add(SimNote.Warning("noTextureBound", ("line", line.ToString())));
            return;
        }
        // Not a texture target (glTexImage2D(GL_FRAMEBUFFER, …): learnopengl's debugging mistake): an error, no upload.
        var targetName = a[0].Trim();
        if (System.Text.RegularExpressions.Regex.IsMatch(targetName, @"^GL_[A-Z0-9_]+$") && !System.Text.RegularExpressions.Regex.IsMatch(targetName, @"^GL_(?:PROXY_)?TEXTURE_(?:2D|1D_ARRAY|RECTANGLE|CUBE_MAP)"))
        {
            GlError(GlInvalidEnum, $"GL_INVALID_ENUM in glTexImage2D(target={targetName})");
            return;
        }
        // A cube map face: GL_TEXTURE_CUBE_MAP_POSITIVE_X + i.
        int face = -1;
        var faceMatch = System.Text.RegularExpressions.Regex.Match(a[0].Trim(), @"GL_TEXTURE_CUBE_MAP_(POSITIVE|NEGATIVE)_([XYZ])\s*(?:\+\s*(.+))?$");
        if (faceMatch.Success)
        {
            face = "XYZ".IndexOf(faceMatch.Groups[2].Value[0]) * 2 + (faceMatch.Groups[1].Value == "NEGATIVE" ? 1 : 0)
                + (faceMatch.Groups[3].Success ? Int(faceMatch.Groups[3].Value) ?? 0 : 0);
            tex.IsCube = true;
        }
        var data = DataName(a[8]);
        if (data is "NULL" or "nullptr" or "0" || Eval(data)?.Text is "nullptr" or "NULL")
        {
            // No data: the texture is drawn into (a framebuffer's colour or depth attachment).
            tex.Width = Int(a[3]) ?? 0;
            tex.Height = Int(a[4]) ?? 0;
            tex.Float = IsFloatFormat(a[2]);
            tex.IsDepth = a[2].Contains("DEPTH", StringComparison.Ordinal);
            tex.Components = 4;
            tex.Channels = FormatChannels.Of(a[2]);
            // An empty image (a space's glyph: 0 × 0): a texture with nothing in it, which reads 0.
            if (tex.Width == 0 || tex.Height == 0) tex.Image = new Textures.Image(1, 1, 4, [0, 0, 0, 0], [0, 0, 0, 0]);
            return;
        }
        // The image the data names: one loaded while the program ran (its variable holds its name), or the last
        // stbi_load into a variable of that name before this call.
        var loaded = Eval(data)?.Text is { } held && loadedImages.TryGetValue(held, out var remembered) ? remembered
            : images.LastOrDefault(i => i.Variable == data && i.Offset < statementOffset);
        var image = loaded?.Image;
        if (loaded is not null && image is null && loaded.File == "" && Eval(loaded.Arg)?.Text is { } path)
        {
            // stbi_load(path, …) inside a helper: the path is the helper's argument.
            image = StbImage.Load(project, path, loaded.Flip, loaded.Wanted);
            if (image is null) scene.Notes.Add(SimNote.Error("textureFileMissing", ("file", path)));
            loaded = loaded with { File = path };
        }
        // Data computed by the program (the SSAO noise: std::vector<glm::vec3> ssaoNoise, &ssaoNoise[0]): its numbers,
        // GL_FLOAT values as they are, row by row from the bottom (OpenGL's first row is v = 0).
        if (image is null && loaded is null && Numbers(data) is { Count: > 0 } values && Int(a[3]) is int w && Int(a[4]) is int h && w > 0 && h > 0)
        {
            int per = Math.Max(1, Components(a[6]));
            // Bytes (GL_UNSIGNED_BYTE: a FreeType glyph's coverage) are 0–255; each row starts at a multiple of
            // GL_UNPACK_ALIGNMENT (4 unless glPixelStorei says otherwise) – learnopengl sets 1 for its glyphs.
            bool ofBytes = a[7].Contains("UNSIGNED_BYTE", StringComparison.Ordinal);
            int rowLength = ofBytes ? (w * per + gl.UnpackAlignment - 1) / gl.UnpackAlignment * gl.UnpackAlignment : w * per;
            var floats = new double[w * h * 4];
            var bytes = new byte[w * h * 4];
            for (int i = 0; i < w * h; i++)
                for (int k = 0; k < 4; k++)
                {
                    int at = i / w * rowLength + i % w * per + k;
                    double v = k < per ? (at < values.Count ? values[at] : 0) : (k == 3 ? 1 : 0);
                    if (ofBytes && k < per) v /= 255.0;
                    floats[i * 4 + k] = v;
                    bytes[i * 4 + k] = (byte)Math.Round(Math.Clamp(v, 0, 1) * 255);
                }
            tex.Components = per == 4 ? 4 : 3;
            tex.Float = IsFloatFormat(a[2]) || a[7].Contains("FLOAT", StringComparison.Ordinal);
            var computed = new Textures.Image(w, h, 4, bytes, floats);
            if (face >= 0) { if (face < 6) tex.Faces[face] = computed; }
            else tex.Image = computed;
            tex.Mipmaps = false;
            return;
        }
        if (image is null) return;
        // The internal format: GL_SRGB / GL_SRGB_ALPHA (also through a variable: learnopengl's loadTexture with gammaCorrection).
        tex.Srgb = a[2].Contains("SRGB", StringComparison.Ordinal) || (Eval(a[2])?.Text ?? "").Contains("SRGB", StringComparison.Ordinal);
        int components = Components(a[6]);
        // A format in a variable (learnopengl's loadTexture: GL_RED / GL_RGB / GL_RGBA by nrComponents) fits the image.
        tex.Components = components == 4 || (components == 0 && image.Channels == 4) ? 4 : 3;
        var uploaded = image.Channels == components || components == 0 ? image : Reinterpret(image, image.Channels, components);
        if (face >= 0)
        {
            if (face < 6) tex.Faces[face] = uploaded;
        }
        else tex.Image = uploaded;
        if (image.Channels != components && components != 0)
            scene.Notes.Add(SimNote.Warning("textureFormatMismatch", ("file", loaded!.File), ("channels", image.Channels.ToString()), ("format", a[6].Trim())));
        tex.Mipmaps = false;
    }

    private static int Components(string format) => format.Trim() switch
    {
        "GL_RGBA" or "GL_BGRA" => 4,
        "GL_RGB" or "GL_BGR" => 3,
        "GL_RG" => 2,
        "GL_RED" => 1,
        _ => 0,
    };

    /// <summary>The bytes of an image with <paramref name="actual"/> channels read as if it had <paramref name="assumed"/>.</summary>
    private static Textures.Image Reinterpret(Textures.Image image, int actual, int assumed)
    {
        int n = image.Width * image.Height;
        var packed = new byte[n * actual];
        for (int i = 0; i < n; i++)
            for (int k = 0; k < actual; k++) packed[i * actual + k] = image.Rgba[i * 4 + Math.Min(k, 3)];
        var rgba = new byte[n * 4];
        for (int i = 0; i < n; i++)
        {
            for (int k = 0; k < 4; k++)
            {
                int at = i * assumed + Math.Min(k, assumed - 1);
                rgba[i * 4 + k] = k < assumed ? (at < packed.Length ? packed[at] : (byte)0) : (k == 3 ? (byte)255 : rgba[i * 4]);
            }
        }
        return image with { Rgba = rgba, Channels = assumed };
    }
}
